from rest_framework import serializers
from decimal import Decimal
from .models import UserWallet, WalletTransaction, PaymentMethod, BankAccount


class UserWalletSerializer(serializers.ModelSerializer):
    """Serializer for UserWallet"""

    total_balance = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    user_name = serializers.CharField(source='user.full_name', read_only=True)
    history_transactions = serializers.SerializerMethodField()

    class Meta:
        model = UserWallet
        fields = [
            'id', 'user', 'user_name', 'available_balance', 'escrow_balance',
            'total_balance', 'total_deposited', 'total_withdrawn',
            'total_shipping_paid', 'withdrawal_limit_daily',
            'withdrawal_limit_monthly', 'created_at', 'updated_at', 'history_transactions'
        ]
        read_only_fields = [
            'id', 'user', 'user_name', 'total_deposited', 'total_withdrawn',
            'total_shipping_paid', 'created_at', 'updated_at'
        ]

    def get_history_transactions(self, obj):
        """Get recent transactions for the wallet"""
        transactions = WalletTransaction.objects.filter(wallet=obj).order_by('-created_at')[:5]
        return WalletTransactionSerializer(transactions, many=True).data


class WalletTransactionSerializer(serializers.ModelSerializer):
    """Serializer for WalletTransaction"""

    net_amount = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    wallet_user = serializers.CharField(source='wallet.user.full_name', read_only=True)

    class Meta:
        model = WalletTransaction
        fields = [
            'id', 'wallet', 'wallet_user', 'transaction_type', 'amount',
            'status', 'description', 'stripe_payment_intent_id',
            'stripe_charge_id', 'payment_method', 'trade_id',
            'platform_fee', 'stripe_fee', 'net_amount',
            'balance_before', 'balance_after', 'created_at',
            'updated_at', 'completed_at'
        ]
        read_only_fields = [
            'id', 'wallet', 'wallet_user', 'stripe_payment_intent_id',
            'stripe_charge_id', 'net_amount', 'balance_before',
            'balance_after', 'created_at', 'updated_at', 'completed_at'
        ]


class PaymentMethodSerializer(serializers.ModelSerializer):
    """Serializer for PaymentMethod"""

    user_name = serializers.CharField(source='user.full_name', read_only=True)
    display_name = serializers.SerializerMethodField()

    class Meta:
        model = PaymentMethod
        fields = [
            'id', 'user', 'user_name', 'stripe_payment_method_id',
            'payment_type', 'last_four', 'brand', 'display_name',
            'is_default', 'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'user', 'user_name', 'stripe_payment_method_id',
            'last_four', 'brand', 'display_name', 'created_at', 'updated_at'
        ]

    def get_display_name(self, obj):
        """Get display name for payment method"""
        return str(obj)


class BankAccountSerializer(serializers.ModelSerializer):
    """Serializer for BankAccount"""

    user_name = serializers.CharField(source='user.full_name', read_only=True)
    display_name = serializers.SerializerMethodField()

    class Meta:
        model = BankAccount
        fields = [
            'id', 'user', 'user_name', 'stripe_bank_account_id',
            'bank_name', 'account_holder_name', 'last_four',
            'routing_number_last_four', 'display_name', 'is_verified',
            'is_default', 'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'user', 'user_name', 'stripe_bank_account_id',
            'last_four', 'routing_number_last_four', 'display_name',
            'is_verified', 'created_at', 'updated_at'
        ]

    def get_display_name(self, obj):
        """Get display name for bank account"""
        return str(obj)


class DepositRequestSerializer(serializers.Serializer):
    """Serializer for deposit requests"""

    amount = serializers.DecimalField(
        max_digits=10, decimal_places=2,
        min_value=Decimal('1.00'),
        max_value=Decimal('10000.00')
    )
    payment_method_id = serializers.CharField(max_length=100)
    description = serializers.CharField(max_length=500, required=False, allow_blank=True)


class WithdrawalRequestSerializer(serializers.Serializer):
    """Serializer for withdrawal requests"""

    amount = serializers.DecimalField(
        max_digits=10, decimal_places=2,
        min_value=Decimal('1.00'),
        max_value=Decimal('10000.00')
    )
    bank_account_id = serializers.UUIDField(required=False)
    description = serializers.CharField(max_length=500, required=False, allow_blank=True)


class EscrowOperationSerializer(serializers.Serializer):
    """Serializer for escrow operations"""

    amount = serializers.DecimalField(
        max_digits=10, decimal_places=2,
        min_value=Decimal('0.01'),
        max_value=Decimal('10000.00')
    )
    trade_id = serializers.UUIDField()
    description = serializers.CharField(max_length=500, required=False, allow_blank=True)


class ShippingPaymentSerializer(serializers.Serializer):
    """Serializer for shipping payments"""

    amount = serializers.DecimalField(
        max_digits=10, decimal_places=2,
        min_value=Decimal('0.01'),
        max_value=Decimal('500.00')
    )
    trade_id = serializers.UUIDField()
    description = serializers.CharField(max_length=500, required=False, allow_blank=True)


class WalletSummarySerializer(serializers.Serializer):
    """Serializer for wallet summary"""

    available_balance = serializers.DecimalField(max_digits=10, decimal_places=2)
    escrow_balance = serializers.DecimalField(max_digits=10, decimal_places=2)
    total_balance = serializers.DecimalField(max_digits=10, decimal_places=2)
    total_deposited = serializers.DecimalField(max_digits=12, decimal_places=2)
    total_withdrawn = serializers.DecimalField(max_digits=12, decimal_places=2)
    total_shipping_paid = serializers.DecimalField(max_digits=10, decimal_places=2)
    recent_transactions = WalletTransactionSerializer(many=True, read_only=True)
    withdrawal_limits = serializers.DictField()
