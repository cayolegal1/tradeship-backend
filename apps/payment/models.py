from django.db import models
from django.contrib.auth import get_user_model
from django.core.validators import MinValueValidator
from decimal import Decimal
import uuid

User = get_user_model()


class UserWallet(models.Model):
    """
    User wallet to manage financial transactions for trading platform.
    Tracks deposits, withdrawals, escrow amounts, and shipping costs.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='wallet',
        help_text="User who owns this wallet"
    )

    # Stripe customer ID for payment processing
    stripe_customer_id = models.CharField(
        max_length=100,
        null=True, blank=True,
        help_text="Stripe customer ID for this user"
    )

    # Balance tracking
    available_balance = models.DecimalField(
        max_digits=10, decimal_places=2,
        default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0.00'))],
        help_text="Available balance for new transactions"
    )

    escrow_balance = models.DecimalField(
        max_digits=10, decimal_places=2,
        default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0.00'))],
        help_text="Amount currently held in escrow for active trades"
    )

    # Lifetime statistics
    total_deposited = models.DecimalField(
        max_digits=12, decimal_places=2,
        default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0.00'))],
        help_text="Total amount ever deposited"
    )

    total_withdrawn = models.DecimalField(
        max_digits=12, decimal_places=2,
        default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0.00'))],
        help_text="Total amount ever withdrawn"
    )

    total_shipping_paid = models.DecimalField(
        max_digits=10, decimal_places=2,
        default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0.00'))],
        help_text="Total shipping costs paid"
    )

    # Security and limits
    withdrawal_limit_daily = models.DecimalField(
        max_digits=8, decimal_places=2,
        default=Decimal('1000.00'),
        help_text="Daily withdrawal limit"
    )

    withdrawal_limit_monthly = models.DecimalField(
        max_digits=10, decimal_places=2,
        default=Decimal('10000.00'),
        help_text="Monthly withdrawal limit"
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['user']),
            models.Index(fields=['stripe_customer_id']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f"Wallet for {self.user.full_name} - ${self.available_balance}"

    @property
    def total_balance(self):
        """Total balance including escrow"""
        return self.available_balance + self.escrow_balance

    def can_withdraw(self, amount):
        """Check if user can withdraw the specified amount"""
        return amount <= self.available_balance

    def can_place_in_escrow(self, amount):
        """Check if user has enough available balance for escrow"""
        return amount <= self.available_balance

    def move_to_escrow(self, amount):
        """Move amount from available balance to escrow"""
        if not self.can_place_in_escrow(amount):
            raise ValueError("Insufficient available balance for escrow")

        self.available_balance -= amount
        self.escrow_balance += amount
        self.save()

    def release_from_escrow(self, amount, to_available=True):
        """Release amount from escrow, optionally back to available balance"""
        if amount > self.escrow_balance:
            raise ValueError("Insufficient escrow balance")

        self.escrow_balance -= amount
        if to_available:
            self.available_balance += amount
        self.save()


class PaymentMethod(models.Model):
    """
    Store user payment methods (credit cards, PayPal) linked to Stripe
    """

    PAYMENT_TYPES = [
        ('card', 'Credit/Debit Card'),
        ('paypal', 'PayPal'),
        ('bank_account', 'Bank Account'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='payment_methods',
        help_text="User who owns this payment method"
    )

    # Stripe payment method details
    stripe_payment_method_id = models.CharField(
        max_length=100,
        help_text="Stripe payment method ID"
    )

    payment_type = models.CharField(
        max_length=20,
        choices=PAYMENT_TYPES,
        help_text="Type of payment method"
    )

    # Display information (last 4 digits, brand, etc.)
    last_four = models.CharField(
        max_length=4,
        blank=True,
        help_text="Last 4 digits of card/account"
    )

    brand = models.CharField(
        max_length=20,
        blank=True,
        help_text="Card brand (Visa, Mastercard, etc.)"
    )

    # Status and preferences
    is_default = models.BooleanField(
        default=False,
        help_text="Whether this is the default payment method"
    )

    is_active = models.BooleanField(
        default=True,
        help_text="Whether this payment method is active"
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['user']),
            models.Index(fields=['stripe_payment_method_id']),
            models.Index(fields=['is_default']),
        ]

    def __str__(self):
        return f"{self.get_payment_type_display()} ending in {self.last_four}"

    def save(self, *args, **kwargs):
        # Ensure only one default payment method per user
        if self.is_default:
            PaymentMethod.objects.filter(
                user=self.user, is_default=True
            ).exclude(id=self.id).update(is_default=False)
        super().save(*args, **kwargs)


class WalletTransaction(models.Model):
    """
    Track all wallet transactions including deposits, withdrawals, escrow operations
    """

    TRANSACTION_TYPES = [
        ('deposit', 'Deposit'),
        ('withdrawal', 'Withdrawal'),
        ('escrow_deposit', 'Escrow Deposit'),
        ('escrow_release', 'Escrow Release'),
        ('escrow_refund', 'Escrow Refund'),
        ('shipping_payment', 'Shipping Payment'),
        ('trade_fee', 'Trade Fee'),
        ('refund', 'Refund'),
    ]

    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
        ('cancelled', 'Cancelled'),
        ('refunded', 'Refunded'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    wallet = models.ForeignKey(
        UserWallet,
        on_delete=models.CASCADE,
        related_name='transactions',
        help_text="Wallet this transaction belongs to"
    )

    # Transaction details
    transaction_type = models.CharField(
        max_length=20,
        choices=TRANSACTION_TYPES,
        help_text="Type of transaction"
    )

    amount = models.DecimalField(
        max_digits=10, decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))],
        help_text="Transaction amount"
    )

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending',
        help_text="Current status of the transaction"
    )

    description = models.TextField(
        blank=True,
        help_text="Description or notes about the transaction"
    )

    # Stripe integration
    stripe_payment_intent_id = models.CharField(
        max_length=100,
        null=True, blank=True,
        help_text="Stripe PaymentIntent ID for this transaction"
    )

    stripe_charge_id = models.CharField(
        max_length=100,
        null=True, blank=True,
        help_text="Stripe Charge ID for this transaction"
    )

    payment_method = models.ForeignKey(
        PaymentMethod,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        help_text="Payment method used for this transaction"
    )

    # Related trade information
    trade_id = models.UUIDField(
        null=True, blank=True,
        help_text="Related trade ID if applicable"
    )

    # Fee information
    platform_fee = models.DecimalField(
        max_digits=8, decimal_places=2,
        default=Decimal('0.00'),
        help_text="Platform fee for this transaction"
    )

    stripe_fee = models.DecimalField(
        max_digits=8, decimal_places=2,
        default=Decimal('0.00'),
        help_text="Stripe processing fee"
    )

    # Balance snapshots
    balance_before = models.DecimalField(
        max_digits=10, decimal_places=2,
        null=True, blank=True,
        help_text="Available balance before transaction"
    )

    balance_after = models.DecimalField(
        max_digits=10, decimal_places=2,
        null=True, blank=True,
        help_text="Available balance after transaction"
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    completed_at = models.DateTimeField(
        null=True, blank=True,
        help_text="When the transaction was completed"
    )

    class Meta:
        indexes = [
            models.Index(fields=['wallet']),
            models.Index(fields=['transaction_type']),
            models.Index(fields=['status']),
            models.Index(fields=['stripe_payment_intent_id']),
            models.Index(fields=['trade_id']),
            models.Index(fields=['created_at']),
        ]
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.get_transaction_type_display()} - ${self.amount} ({self.status})"

    @property
    def net_amount(self):
        """Net amount after fees"""
        return self.amount - self.platform_fee - self.stripe_fee


class BankAccount(models.Model):
    """
    Store user bank account information for withdrawals
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='bank_accounts',
        help_text="User who owns this bank account"
    )

    # Stripe bank account details
    stripe_bank_account_id = models.CharField(
        max_length=100,
        help_text="Stripe bank account ID"
    )

    # Display information
    bank_name = models.CharField(
        max_length=100,
        help_text="Name of the bank"
    )

    account_holder_name = models.CharField(
        max_length=100,
        help_text="Name on the bank account"
    )

    last_four = models.CharField(
        max_length=4,
        help_text="Last 4 digits of account number"
    )

    routing_number_last_four = models.CharField(
        max_length=4,
        help_text="Last 4 digits of routing number"
    )

    # Status
    is_verified = models.BooleanField(
        default=False,
        help_text="Whether the bank account is verified"
    )

    is_default = models.BooleanField(
        default=False,
        help_text="Whether this is the default withdrawal account"
    )

    is_active = models.BooleanField(
        default=True,
        help_text="Whether this bank account is active"
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['user']),
            models.Index(fields=['stripe_bank_account_id']),
            models.Index(fields=['is_default']),
        ]

    def __str__(self):
        return f"{self.bank_name} ****{self.last_four}"

    def save(self, *args, **kwargs):
        # Ensure only one default bank account per user
        if self.is_default:
            BankAccount.objects.filter(
                user=self.user, is_default=True
            ).exclude(id=self.id).update(is_default=False)
        super().save(*args, **kwargs)
