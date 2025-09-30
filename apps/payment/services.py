"""
Wallet operations service for handling all payment and wallet transactions.
Integrates with Stripe for payment processing.
"""

import logging
import stripe
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from decimal import Decimal
from typing import Optional, Dict, Any

from .models import UserWallet, WalletTransaction, PaymentMethod, BankAccount
from django.contrib.auth import get_user_model

User = get_user_model()

# Get logger for secure logging
logger = logging.getLogger(__name__)

# Initialize Stripe with secret key
stripe.api_key = settings.STRIPE_SECRET_KEY


class WalletService:
    """Service class for wallet operations"""

    @staticmethod
    def get_or_create_wallet(user) -> UserWallet:
        """Get or create a wallet for the user"""
        wallet, created = UserWallet.objects.get_or_create(
            user=user,
            defaults={'stripe_customer_id': None}
        )

        # Create Stripe customer if not exists
        if not wallet.stripe_customer_id:
            customer = stripe.Customer.create(
                email=user.email,
                name=user.full_name,
                metadata={'user_id': str(user.id)}
            )
            wallet.stripe_customer_id = customer.id
            wallet.save()

        return wallet

    @staticmethod
    def create_deposit_intent(
        user,
        amount: Decimal,
        payment_method_id: str,
        description: str = ""
    ) -> Dict[str, Any]:
        """
        Create a Stripe PaymentIntent for deposit
        """
        wallet = WalletService.get_or_create_wallet(user)

        # Calculate fees (example: 2.9% + $0.30 Stripe fee)
        stripe_fee = amount * Decimal('0.029') + Decimal('0.30')
        platform_fee = amount * Decimal('0.01')  # 1% platform fee

        # Create transaction record
        transaction_record = WalletTransaction.objects.create(
            wallet=wallet,
            transaction_type='deposit',
            amount=amount,
            status='pending',
            description=description or "Deposit to wallet",
            platform_fee=platform_fee,
            stripe_fee=stripe_fee,
            balance_before=wallet.available_balance
        )

        try:
            # Create Stripe PaymentIntent
            payment_intent = stripe.PaymentIntent.create(
                amount=int(amount * 100),  # Convert to cents
                currency=settings.STRIPE_CURRENCY,
                customer=wallet.stripe_customer_id,
                payment_method=payment_method_id,
                confirm=True,
                return_url=f"{settings.FRONTEND_URL}/wallet/deposit/success",
                metadata={
                    'transaction_id': str(transaction_record.id),
                    'user_id': str(user.id),
                    'type': 'deposit'
                }
            )

            # Update transaction with Stripe data
            transaction_record.stripe_payment_intent_id = payment_intent.id
            transaction_record.status = 'processing'
            transaction_record.save()

            return {
                'success': True,
                'payment_intent': payment_intent,
                'transaction_id': transaction_record.id
            }

        except stripe.error.StripeError as e:
            transaction_record.status = 'failed'
            transaction_record.description += f" - Error: {str(e)}"
            transaction_record.save()

            return {
                'success': False,
                'error': str(e),
                'transaction_id': transaction_record.id
            }

    @staticmethod
    @transaction.atomic
    def complete_deposit(transaction_id: str, stripe_charge_id: str = None) -> bool:
        """
        Complete a deposit transaction after successful Stripe payment
        """
        try:
            wallet_transaction = WalletTransaction.objects.select_for_update().get(
                id=transaction_id,
                transaction_type='deposit'
            )

            if wallet_transaction.status != 'processing':
                return False

            wallet = wallet_transaction.wallet
            net_amount = wallet_transaction.net_amount

            # Update wallet balances
            wallet.available_balance += net_amount
            wallet.total_deposited += wallet_transaction.amount

            # Update transaction
            wallet_transaction.status = 'completed'
            wallet_transaction.stripe_charge_id = stripe_charge_id
            wallet_transaction.balance_after = wallet.available_balance
            wallet_transaction.completed_at = timezone.now()

            wallet.save()
            wallet_transaction.save()

            return True

        except WalletTransaction.DoesNotExist:
            return False

    @staticmethod
    @transaction.atomic
    def escrow_deposit(user, amount: Decimal, trade_id: str, description: str = "") -> Dict[str, Any]:
        """
        Move funds from available balance to escrow for a trade
        """
        wallet = WalletService.get_or_create_wallet(user)

        if not wallet.can_place_in_escrow(amount):
            return {
                'success': False,
                'error': 'Insufficient available balance for escrow deposit'
            }

        try:
            # Create transaction record
            transaction_record = WalletTransaction.objects.create(
                wallet=wallet,
                transaction_type='escrow_deposit',
                amount=amount,
                status='pending',
                description=description or f"Escrow deposit for trade {trade_id}",
                trade_id=trade_id,
                balance_before=wallet.available_balance
            )

            # Move funds to escrow
            wallet.move_to_escrow(amount)

            # Update transaction
            transaction_record.status = 'completed'
            transaction_record.balance_after = wallet.available_balance
            transaction_record.completed_at = timezone.now()
            transaction_record.save()

            return {
                'success': True,
                'transaction_id': transaction_record.id,
                'escrow_balance': wallet.escrow_balance
            }

        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }

    @staticmethod
    @transaction.atomic
    def release_escrow(user, amount: Decimal, trade_id: str, to_available: bool = True, description: str = "") -> Dict[str, Any]:
        """
        Release funds from escrow (either back to available balance or as payment)
        """
        wallet = WalletService.get_or_create_wallet(user)

        if amount > wallet.escrow_balance:
            return {
                'success': False,
                'error': 'Insufficient escrow balance'
            }

        try:
            transaction_type = 'escrow_release' if to_available else 'escrow_refund'

            # Create transaction record
            transaction_record = WalletTransaction.objects.create(
                wallet=wallet,
                transaction_type=transaction_type,
                amount=amount,
                status='pending',
                description=description or f"Escrow release for trade {trade_id}",
                trade_id=trade_id,
                balance_before=wallet.available_balance
            )

            # Release funds from escrow
            wallet.release_from_escrow(amount, to_available=to_available)

            # Update transaction
            transaction_record.status = 'completed'
            transaction_record.balance_after = wallet.available_balance
            transaction_record.completed_at = timezone.now()
            transaction_record.save()

            return {
                'success': True,
                'transaction_id': transaction_record.id,
                'available_balance': wallet.available_balance,
                'escrow_balance': wallet.escrow_balance
            }

        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }

    @staticmethod
    @transaction.atomic
    def shipping_payment(user, amount: Decimal, trade_id: str, description: str = "") -> Dict[str, Any]:
        """
        Pay for shipping from available balance
        """
        wallet = WalletService.get_or_create_wallet(user)

        if not wallet.can_withdraw(amount):
            return {
                'success': False,
                'error': 'Insufficient available balance for shipping payment'
            }

        try:
            # Create transaction record
            transaction_record = WalletTransaction.objects.create(
                wallet=wallet,
                transaction_type='shipping_payment',
                amount=amount,
                status='pending',
                description=description or f"Shipping payment for trade {trade_id}",
                trade_id=trade_id,
                balance_before=wallet.available_balance
            )

            # Deduct from available balance
            wallet.available_balance -= amount
            wallet.total_shipping_paid += amount
            wallet.save()

            # Update transaction
            transaction_record.status = 'completed'
            transaction_record.balance_after = wallet.available_balance
            transaction_record.completed_at = timezone.now()
            transaction_record.save()

            return {
                'success': True,
                'transaction_id': transaction_record.id,
                'available_balance': wallet.available_balance
            }

        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }

    @staticmethod
    def create_withdrawal(
        user,
        amount: Decimal,
        bank_account_id: Optional[str] = None,
        description: str = ""
    ) -> Dict[str, Any]:
        """
        Create a withdrawal to user's bank account
        """
        wallet = WalletService.get_or_create_wallet(user)

        if not wallet.can_withdraw(amount):
            return {
                'success': False,
                'error': 'Insufficient available balance for withdrawal'
            }

        # Get bank account
        if bank_account_id:
            try:
                bank_account = BankAccount.objects.get(
                    id=bank_account_id,
                    user=user,
                    is_active=True
                )
            except BankAccount.DoesNotExist:
                return {
                    'success': False,
                    'error': 'Bank account not found'
                }
        else:
            bank_account = BankAccount.objects.filter(
                user=user,
                is_default=True,
                is_active=True
            ).first()

            if not bank_account:
                return {
                    'success': False,
                    'error': 'No default bank account found'
                }

        try:
            # Create transaction record
            transaction_record = WalletTransaction.objects.create(
                wallet=wallet,
                transaction_type='withdrawal',
                amount=amount,
                status='pending',
                description=description or f"Withdrawal to {bank_account.bank_name}",
                balance_before=wallet.available_balance
            )

            # Create Stripe transfer (this would typically go to a Stripe Express account)
            # For now, we'll mark as processing and handle via webhook
            transaction_record.status = 'processing'
            transaction_record.save()

            return {
                'success': True,
                'transaction_id': transaction_record.id,
                'bank_account': bank_account.bank_name
            }

        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }

    @staticmethod
    @transaction.atomic
    def complete_withdrawal(transaction_id: str) -> bool:
        """
        Complete a withdrawal after successful bank transfer
        """
        try:
            wallet_transaction = WalletTransaction.objects.select_for_update().get(
                id=transaction_id,
                transaction_type='withdrawal'
            )

            if wallet_transaction.status != 'processing':
                return False

            wallet = wallet_transaction.wallet

            # Deduct from available balance
            wallet.available_balance -= wallet_transaction.amount
            wallet.total_withdrawn += wallet_transaction.amount

            # Update transaction
            wallet_transaction.status = 'completed'
            wallet_transaction.balance_after = wallet.available_balance
            wallet_transaction.completed_at = timezone.now()

            wallet.save()
            wallet_transaction.save()

            return True

        except WalletTransaction.DoesNotExist:
            return False

    @staticmethod
    @transaction.atomic
    def refund_transaction(transaction_id: str, reason: str = "") -> Dict[str, Any]:
        """
        Refund a previous transaction
        """
        try:
            original_transaction = WalletTransaction.objects.get(id=transaction_id)
            wallet = original_transaction.wallet

            # Create refund transaction
            refund_transaction = WalletTransaction.objects.create(
                wallet=wallet,
                transaction_type='refund',
                amount=original_transaction.amount,
                status='pending',
                description=f"Refund for {original_transaction.get_transaction_type_display()} - {reason}",
                trade_id=original_transaction.trade_id,
                balance_before=wallet.available_balance
            )

            # Add amount back to available balance
            wallet.available_balance += original_transaction.amount
            wallet.save()

            # Update refund transaction
            refund_transaction.status = 'completed'
            refund_transaction.balance_after = wallet.available_balance
            refund_transaction.completed_at = timezone.now()
            refund_transaction.save()

            # Mark original transaction as refunded
            original_transaction.status = 'refunded'
            original_transaction.save()

            return {
                'success': True,
                'transaction_id': refund_transaction.id,
                'refund_amount': original_transaction.amount
            }

        except WalletTransaction.DoesNotExist:
            return {
                'success': False,
                'error': 'Original transaction not found'
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }

    @staticmethod
    def get_wallet_summary(user) -> Dict[str, Any]:
        """
        Get wallet summary for user
        """
        wallet = WalletService.get_or_create_wallet(user)

        # Get recent transactions
        recent_transactions = WalletTransaction.objects.filter(
            wallet=wallet
        ).order_by('-created_at')[:10]

        return {
            'available_balance': wallet.available_balance,
            'escrow_balance': wallet.escrow_balance,
            'total_balance': wallet.total_balance,
            'total_deposited': wallet.total_deposited,
            'total_withdrawn': wallet.total_withdrawn,
            'total_shipping_paid': wallet.total_shipping_paid,
            'recent_transactions': recent_transactions,
            'withdrawal_limits': {
                'daily': wallet.withdrawal_limit_daily,
                'monthly': wallet.withdrawal_limit_monthly
            }
        }


class PaymentMethodService:
    """Service for managing payment methods"""

    @staticmethod
    def add_payment_method(user, stripe_payment_method_id: str) -> Dict[str, Any]:
        """
        Add a new payment method for user
        """
        wallet = WalletService.get_or_create_wallet(user)

        try:
            # Retrieve payment method from Stripe
            stripe_pm = stripe.PaymentMethod.retrieve(stripe_payment_method_id)

            # Attach to customer
            stripe_pm.attach(customer=wallet.stripe_customer_id)

            # Determine payment type and extract details
            payment_type = stripe_pm.type
            last_four = ""
            brand = ""

            if payment_type == 'card':
                last_four = stripe_pm.card.last4
                brand = stripe_pm.card.brand

            # Create payment method record
            payment_method = PaymentMethod.objects.create(
                user=user,
                stripe_payment_method_id=stripe_payment_method_id,
                payment_type=payment_type,
                last_four=last_four,
                brand=brand,
                is_default=not PaymentMethod.objects.filter(user=user).exists()
            )

            return {
                'success': True,
                'payment_method_id': payment_method.id
            }

        except stripe.error.StripeError as e:
            return {
                'success': False,
                'error': str(e)
            }

    @staticmethod
    def remove_payment_method(user, payment_method_id: str) -> Dict[str, Any]:
        """
        Remove a payment method
        """
        try:
            payment_method = PaymentMethod.objects.get(
                id=payment_method_id,
                user=user
            )

            # Detach from Stripe
            stripe.PaymentMethod.detach(payment_method.stripe_payment_method_id)

            # Delete local record
            payment_method.delete()

            return {
                'success': True
            }

        except PaymentMethod.DoesNotExist:
            return {
                'success': False,
                'error': 'Payment method not found'
            }
        except stripe.error.StripeError as e:
            return {
                'success': False,
                'error': str(e)
            }

    @staticmethod
    def create_payment_flow(user, amount: Decimal, type_payment_method: str, **kwargs) -> Dict[str, Any]:
        """
        Create a payment flow for immediate charges with different payment method types
        """

        try:
            # Create Stripe PaymentMethod
            payment_method = stripe.checkout.Session.create(
                line_items=[
                    {'price': amount}
                ]
            )

            return {
                'success': True,
                'payment_method': payment_method,
                'payment_method_id': payment_method.id
            }

        except stripe.error.StripeError as e:
            return {
                'success': False,
                'error': str(e)
            }
