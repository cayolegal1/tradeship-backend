from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils.html import format_html
from .models import User, UserProfile


class UserProfileInline(admin.StackedInline):
    """Inline admin for user profile"""
    model = UserProfile
    can_delete = False
    fields = (
        'phone_number', 'date_of_birth', 'bio', 'avatar',
        'email_notifications', 'marketing_emails',
        'city', 'state', 'country'
    )
    readonly_fields = ('created_at', 'updated_at')


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    """Admin interface for custom User model"""
    inlines = (UserProfileInline,)

    # List display
    list_display = [
        'email', 'username', 'full_name', 'is_active', 'agrees_to_terms_display',
        'profile_completed', 'date_joined'
    ]

    # List filters
    list_filter = [
        'is_active', 'agrees_to_terms', 'profile_completed',
        'is_staff', 'is_superuser', 'date_joined', 'created_at'
    ]

    # Search fields
    search_fields = ['email', 'username', 'first_name', 'last_name']

    # Ordering
    ordering = ['-created_at']

    # Readonly fields
    readonly_fields = [
        'id', 'date_joined', 'last_login', 'created_at', 'updated_at',
        'terms_agreed_at'
    ]

    # Fieldsets
    fieldsets = (
        ('Personal Information', {
            'fields': ('first_name', 'last_name', 'email', 'username')
        }),
        ('Terms & Agreement', {
            'fields': ('agrees_to_terms', 'terms_agreed_at', 'terms_version')
        }),
        ('Profile Status', {
            'fields': ('profile_completed', 'is_active')
        }),
        ('Permissions', {
            'fields': ('is_staff', 'is_superuser', 'groups', 'user_permissions'),
            'classes': ('collapse',)
        }),
        ('Important Dates', {
            'fields': ('id', 'date_joined', 'last_login', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

    # Add fieldsets for creating new users
    add_fieldsets = (
        ('Required Information', {
            'classes': ('wide',),
            'fields': ('email', 'username', 'first_name', 'last_name', 'password1', 'password2'),
        }),
        ('Terms Agreement', {
            'fields': ('agrees_to_terms',),
        }),
        ('Permissions', {
            'fields': ('is_active', 'is_staff', 'is_superuser'),
            'classes': ('collapse',)
        }),
    )

    def agrees_to_terms_display(self, obj):
        """Display terms agreement status with styling"""
        if obj.agrees_to_terms:
            return format_html(
                '<span style="color: green;">✓ Agreed</span>'
            )
        return format_html(
            '<span style="color: red;">✗ Not Agreed</span>'
        )
    agrees_to_terms_display.short_description = "Terms Agreement"

    def get_queryset(self, request):
        """Optimize queryset with select_related"""
        return super().get_queryset(request).select_related('profile')


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    """Admin interface for UserProfile model"""

    # List display
    list_display = [
        'user_full_name', 'user_email', 'phone_number', 'city', 'state',
        'email_notifications', 'created_at'
    ]

    # List filters
    list_filter = [
        'email_notifications', 'marketing_emails', 'country', 'state',
        'created_at'
    ]

    # Search fields
    search_fields = [
        'user__email', 'user__first_name', 'user__last_name',
        'phone_number', 'city', 'state'
    ]

    # Ordering
    ordering = ['-created_at']

    # Readonly fields
    readonly_fields = ['id', 'user', 'created_at', 'updated_at', 'avatar_preview']

    # Fieldsets
    fieldsets = (
        ('User Information', {
            'fields': ('user',)
        }),
        ('Contact Information', {
            'fields': ('phone_number',)
        }),
        ('Personal Information', {
            'fields': ('date_of_birth', 'bio')
        }),
        ('Profile Image', {
            'fields': ('avatar', 'avatar_preview')
        }),
        ('Location', {
            'fields': ('city', 'state', 'country')
        }),
        ('Preferences', {
            'fields': ('email_notifications', 'marketing_emails')
        }),
        ('Timestamps', {
            'fields': ('id', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

    def user_full_name(self, obj):
        """Display user's full name"""
        return obj.user.full_name
    user_full_name.short_description = "Full Name"
    user_full_name.admin_order_field = 'user__first_name'

    def user_email(self, obj):
        """Display user's email"""
        return obj.user.email
    user_email.short_description = "Email"
    user_email.admin_order_field = 'user__email'

    def avatar_preview(self, obj):
        """Display avatar preview"""
        if obj.avatar:
            return format_html(
                '<img src="{}" style="max-height: 100px; max-width: 100px;" />',
                obj.avatar.url
            )
        return "No avatar"
    avatar_preview.short_description = "Avatar Preview"

    def get_queryset(self, request):
        """Optimize queryset with select_related"""
        return super().get_queryset(request).select_related('user')


# Customize admin site headers
admin.site.site_header = "TradeShip Administration"
admin.site.site_title = "TradeShip Admin"
admin.site.index_title = "Welcome to TradeShip Administration"
