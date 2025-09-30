from django.contrib import admin
from .models import (
    Interest, Item, ShippingDetails, ItemImage, ShippingAddress,
    ShippingPreferences, PaymentShippingSetup, TermsAgreement,
    Trade, TradeRating, Review
)


@admin.register(Interest)
class InterestAdmin(admin.ModelAdmin):
    """Admin configuration for Interest model"""
    list_display = ['name', 'description', 'color', 'is_active', 'item_count', 'created_at']
    list_filter = ['is_active', 'created_at']
    search_fields = ['name', 'description']
    ordering = ['name']
    readonly_fields = ['created_at', 'updated_at', 'item_count']

    def item_count(self, obj):
        return obj.item_count
    item_count.short_description = 'Active Items'


class ItemImageInline(admin.TabularInline):
    """Inline admin for item images"""
    model = ItemImage
    extra = 1
    readonly_fields = ['created_at', 'updated_at']


class ShippingDetailsInline(admin.StackedInline):
    """Inline admin for shipping details"""
    model = ShippingDetails
    readonly_fields = ['created_at', 'updated_at', 'dimensions_display', 'volume_cubic_inches', 'shipping_cost_estimate']


@admin.register(Item)
class ItemAdmin(admin.ModelAdmin):
    """Admin configuration for Item model"""
    list_display = ['title', 'owner', 'estimated_value', 'is_available_for_trade', 'is_active', 'created_at']
    list_filter = ['is_available_for_trade', 'is_active', 'created_at', 'interests']
    search_fields = ['title', 'description', 'owner__email', 'owner__first_name', 'owner__last_name']
    filter_horizontal = ['interests']
    readonly_fields = ['created_at', 'updated_at', 'owner_trader_info', 'is_tradeable']
    inlines = [ItemImageInline, ShippingDetailsInline]

    fieldsets = (
        ('Basic Information', {
            'fields': ('title', 'description', 'interests', 'estimated_value')
        }),
        ('Ownership', {
            'fields': ('owner', 'owner_trader_info')
        }),
        ('Trading Settings', {
            'fields': ('is_available_for_trade', 'trade_preferences', 'minimum_trade_value', 'accepts_cash_offers')
        }),
        ('Status', {
            'fields': ('is_active', 'is_tradeable')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        })
    )


@admin.register(ShippingAddress)
class ShippingAddressAdmin(admin.ModelAdmin):
    """Admin configuration for ShippingAddress model"""
    list_display = ['user', 'address_line_1', 'city', 'state', 'country', 'is_default']
    list_filter = ['is_default', 'country', 'state']
    search_fields = ['user__email', 'address_line_1', 'city']
    readonly_fields = ['created_at', 'updated_at', 'full_address']


@admin.register(Trade)
class TradeAdmin(admin.ModelAdmin):
    """Admin configuration for Trade model"""
    list_display = ['id', 'trader_offering', 'trader_receiving', 'item_offered', 'status', 'total_value', 'created_at']
    list_filter = ['status', 'created_at', 'accepted_at', 'completed_at']
    search_fields = [
        'trader_offering__email', 'trader_receiving__email',
        'item_offered__title', 'item_requested__title'
    ]
    readonly_fields = [
        'created_at', 'accepted_at', 'completed_at', 'cancelled_at',
        'total_value', 'is_active', 'trade_summary'
    ]

    fieldsets = (
        ('Trade Participants', {
            'fields': ('trader_offering', 'trader_receiving')
        }),
        ('Items', {
            'fields': ('item_offered', 'item_requested', 'cash_amount', 'total_value')
        }),
        ('Trade Details', {
            'fields': ('status', 'notes', 'escrow_reference', 'estimated_completion')
        }),
        ('Status Information', {
            'fields': ('is_active',),
            'classes': ('collapse',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'accepted_at', 'completed_at', 'cancelled_at'),
            'classes': ('collapse',)
        }),
        ('Trade Summary', {
            'fields': ('trade_summary',),
            'classes': ('collapse',)
        })
    )


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    """Admin configuration for Review model"""
    list_display = ['reviewer', 'reviewed_trader', 'trade', 'rating', 'would_trade_again', 'created_at']
    list_filter = ['rating', 'would_trade_again', 'created_at']
    search_fields = [
        'reviewer__email', 'reviewed_trader__email',
        'trade__item_offered__title', 'description'
    ]
    readonly_fields = ['created_at', 'updated_at']

    fieldsets = (
        ('Review Information', {
            'fields': ('trade', 'reviewer', 'reviewed_trader')
        }),
        ('Review Content', {
            'fields': ('rating', 'description', 'would_trade_again')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        })
    )


@admin.register(TradeRating)
class TradeRatingAdmin(admin.ModelAdmin):
    """Admin configuration for TradeRating model"""
    list_display = ['rater', 'rated_trader', 'trade', 'overall_rating', 'average_rating', 'created_at']
    list_filter = ['overall_rating', 'would_trade_again', 'created_at']
    search_fields = [
        'rater__email', 'rated_trader__email',
        'trade__item_offered__title', 'feedback'
    ]
    readonly_fields = ['created_at', 'average_rating']


# Register other models with simple admin
@admin.register(ShippingDetails)
class ShippingDetailsAdmin(admin.ModelAdmin):
    list_display = ['item', 'shipping_weight', 'dimensions_display', 'shipping_cost_estimate']
    readonly_fields = ['created_at', 'updated_at', 'dimensions_display', 'volume_cubic_inches', 'shipping_cost_estimate']


@admin.register(ItemImage)
class ItemImageAdmin(admin.ModelAdmin):
    list_display = ['name', 'item', 'is_primary', 'created_at']
    list_filter = ['is_primary', 'created_at']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(ShippingPreferences)
class ShippingPreferencesAdmin(admin.ModelAdmin):
    list_display = ['user', 'preferred_carrier', 'created_at']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(PaymentShippingSetup)
class PaymentShippingSetupAdmin(admin.ModelAdmin):
    list_display = ['user', 'shipping_method', 'created_at']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(TermsAgreement)
class TermsAgreementAdmin(admin.ModelAdmin):
    list_display = ['user', 'terms_version', 'is_fully_agreed', 'created_at']
    list_filter = ['terms_version', 'created_at']
    readonly_fields = ['created_at', 'is_fully_agreed']
