from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from .models import UserWallet, WalletTransaction, PaymentMethod, BankAccount


@admin.register(UserWallet)
class UserWalletAdmin(admin.ModelAdmin):
    """Admin interface for UserWallet"""

    list_display = [
        'user_display', 'available_balance', 'escrow_balance',
        'total_balance_display', 'total_deposited', 'total_withdrawn',
        'stripe_customer_link', 'created_at'
    ]
    list_filter = ['created_at', 'updated_at']
    search_fields = ['user__email', 'user__first_name', 'user__last_name', 'stripe_customer_id']
    readonly_fields = [
        'id', 'stripe_customer_id', 'total_balance_display',
        'created_at', 'updated_at', 'transaction_count'
    ]

    fieldsets = (
        ('User Information', {
            'fields': ('id', 'user', 'stripe_customer_id')
        }),
        ('Balance Information', {
            'fields': (
                'available_balance', 'escrow_balance', 'total_balance_display',
                'total_deposited', 'total_withdrawn', 'total_shipping_paid'
            )
        }),
        ('Limits & Security', {
            'fields': ('withdrawal_limit_daily', 'withdrawal_limit_monthly')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at')
        }),
        ('Statistics', {
            'fields': ('transaction_count',)
        })
    )

    def user_display(self, obj):
        """Display user name with link to user admin"""
        url = reverse('admin:apps_auth_user_change', args=[obj.user.pk])
        return format_html('<a href="{}">{}</a>', url, obj.user.full_name)
    user_display.short_description = 'User'
    user_display.admin_order_field = 'user__first_name'

    def total_balance_display(self, obj):
        """Display total balance"""
        return f"${obj.total_balance}"
    total_balance_display.short_description = 'Total Balance'

    def stripe_customer_link(self, obj):
        """Link to Stripe customer dashboard"""
        if obj.stripe_customer_id:
            url = f"https://dashboard.stripe.com/customers/{obj.stripe_customer_id}"
            return format_html('<a href="{}" target="_blank">View in Stripe</a>', url)
        return "Not created"
    stripe_customer_link.short_description = 'Stripe Customer'

    def transaction_count(self, obj):
        """Count of transactions for this wallet"""
        return obj.transactions.count()
    transaction_count.short_description = 'Transaction Count'


@admin.register(WalletTransaction)
class WalletTransactionAdmin(admin.ModelAdmin):
    """Admin interface for WalletTransaction"""

    list_display = [
        'id', 'wallet_user', 'transaction_type', 'amount_display',
        'status', 'stripe_payment_intent_link', 'trade_link', 'created_at'
    ]
    list_filter = [
        'transaction_type', 'status', 'created_at', 'updated_at'
    ]
    search_fields = [
        'wallet__user__email', 'wallet__user__first_name', 'wallet__user__last_name',
        'stripe_payment_intent_id', 'stripe_charge_id', 'trade_id', 'description'
    ]
    readonly_fields = [
        'id', 'net_amount_display', 'created_at', 'updated_at', 'completed_at'
    ]

    fieldsets = (
        ('Transaction Information', {
            'fields': (
                'id', 'wallet', 'transaction_type', 'amount', 'status', 'description'
            )
        }),
        ('Payment Details', {
            'fields': (
                'payment_method', 'stripe_payment_intent_id', 'stripe_charge_id'
            )
        }),
        ('Trade Information', {
            'fields': ('trade_id',)
        }),
        ('Fees & Balance', {
            'fields': (
                'platform_fee', 'stripe_fee', 'net_amount_display',
                'balance_before', 'balance_after'
            )
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at', 'completed_at')
        })
    )

    def wallet_user(self, obj):
        """Display wallet user"""
        return obj.wallet.user.full_name
    wallet_user.short_description = 'User'
    wallet_user.admin_order_field = 'wallet__user__first_name'

    def amount_display(self, obj):
        """Display amount with currency"""
        return f"${obj.amount}"
    amount_display.short_description = 'Amount'
    amount_display.admin_order_field = 'amount'

    def net_amount_display(self, obj):
        """Display net amount after fees"""
        return f"${obj.net_amount}"
    net_amount_display.short_description = 'Net Amount'

    def stripe_payment_intent_link(self, obj):
        """Link to Stripe payment intent"""
        if obj.stripe_payment_intent_id:
            url = f"https://dashboard.stripe.com/payments/{obj.stripe_payment_intent_id}"
            return format_html('<a href="{}" target="_blank">View in Stripe</a>', url)
        return "-"
    stripe_payment_intent_link.short_description = 'Stripe Payment'

    def trade_link(self, obj):
        """Link to trade if exists"""
        if obj.trade_id:
            # Assuming trade admin exists
            try:
                url = reverse('admin:apps_trade_trade_change', args=[obj.trade_id])
                return format_html('<a href="{}">View Trade</a>', url)
            except Exception:
                return str(obj.trade_id)[:8] + "..."
        return "-"
    trade_link.short_description = 'Trade'


@admin.register(PaymentMethod)
class PaymentMethodAdmin(admin.ModelAdmin):
    """Admin interface for PaymentMethod"""

    list_display = [
        'user_display', 'payment_type', 'brand', 'last_four_display',
        'is_default', 'is_active', 'stripe_link', 'created_at'
    ]
    list_filter = ['payment_type', 'brand', 'is_default', 'is_active', 'created_at']
    search_fields = [
        'user__email', 'user__first_name', 'user__last_name',
        'stripe_payment_method_id', 'last_four', 'brand'
    ]
    readonly_fields = ['id', 'stripe_payment_method_id', 'created_at', 'updated_at']

    fieldsets = (
        ('User Information', {
            'fields': ('id', 'user')
        }),
        ('Payment Method Details', {
            'fields': (
                'stripe_payment_method_id', 'payment_type', 'last_four', 'brand'
            )
        }),
        ('Settings', {
            'fields': ('is_default', 'is_active')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at')
        })
    )

    def user_display(self, obj):
        """Display user name"""
        return obj.user.full_name
    user_display.short_description = 'User'
    user_display.admin_order_field = 'user__first_name'

    def last_four_display(self, obj):
        """Display last four digits"""
        return f"****{obj.last_four}" if obj.last_four else "-"
    last_four_display.short_description = 'Last 4'

    def stripe_link(self, obj):
        """Link to Stripe payment method"""
        if obj.stripe_payment_method_id:
            url = f"https://dashboard.stripe.com/payment_methods/{obj.stripe_payment_method_id}"
            return format_html('<a href="{}" target="_blank">View in Stripe</a>', url)
        return "-"
    stripe_link.short_description = 'Stripe'


@admin.register(BankAccount)
class BankAccountAdmin(admin.ModelAdmin):
    """Admin interface for BankAccount"""

    list_display = [
        'user_display', 'bank_name', 'account_holder_name', 'last_four_display',
        'is_verified', 'is_default', 'is_active', 'created_at'
    ]
    list_filter = ['bank_name', 'is_verified', 'is_default', 'is_active', 'created_at']
    search_fields = [
        'user__email', 'user__first_name', 'user__last_name',
        'bank_name', 'account_holder_name', 'last_four'
    ]
    readonly_fields = ['id', 'stripe_bank_account_id', 'created_at', 'updated_at']

    fieldsets = (
        ('User Information', {
            'fields': ('id', 'user')
        }),
        ('Bank Account Details', {
            'fields': (
                'stripe_bank_account_id', 'bank_name', 'account_holder_name',
                'last_four', 'routing_number_last_four'
            )
        }),
        ('Status', {
            'fields': ('is_verified', 'is_default', 'is_active')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at')
        })
    )

    def user_display(self, obj):
        """Display user name"""
        return obj.user.full_name
    user_display.short_description = 'User'
    user_display.admin_order_field = 'user__first_name'

    def last_four_display(self, obj):
        """Display last four digits of account"""
        return f"****{obj.last_four}" if obj.last_four else "-"
    last_four_display.short_description = 'Account Last 4'


# Admin site customization
admin.site.site_header = "TradeShip Admin"
admin.site.site_title = "TradeShip Admin Portal"
admin.site.index_title = "Welcome to TradeShip Administration"
