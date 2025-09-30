from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from django.utils.safestring import mark_safe
from .models import (
    NotificationType,
    NotificationUserSettings,
    Notification,
    NotificationBatch,
    NotificationBatchRecipient
)


@admin.register(NotificationType)
class NotificationTypeAdmin(admin.ModelAdmin):
    """Admin interface for NotificationType"""

    list_display = [
        'display_name', 'name', 'is_active', 'priority',
        'requires_action', 'auto_mark_read', 'created_at'
    ]
    list_filter = [
        'is_active', 'priority', 'requires_action', 'auto_mark_read',
        'default_email_enabled', 'default_push_enabled', 'default_in_app_enabled'
    ]
    search_fields = ['name', 'display_name', 'description']
    ordering = ['name']
    readonly_fields = ['created_at', 'updated_at']

    fieldsets = (
        ('Basic Information', {
            'fields': ('name', 'display_name', 'description', 'is_active', 'priority')
        }),
        ('Behavior Settings', {
            'fields': ('requires_action', 'auto_mark_read')
        }),
        ('Default User Settings', {
            'fields': ('default_email_enabled', 'default_push_enabled', 'default_in_app_enabled'),
            'description': 'Default notification settings for new users'
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        })
    )


@admin.register(NotificationUserSettings)
class NotificationUserSettingsAdmin(admin.ModelAdmin):
    """Admin interface for NotificationUserSettings"""

    list_display = [
        'user_email', 'notification_type_name', 'email_enabled',
        'push_enabled', 'in_app_enabled', 'created_at'
    ]
    list_filter = [
        'email_enabled', 'push_enabled', 'in_app_enabled',
        'notification_type', 'created_at'
    ]
    search_fields = ['user__email', 'user__first_name', 'user__last_name']
    ordering = ['user__email', 'notification_type__name']
    readonly_fields = ['created_at', 'updated_at']
    raw_id_fields = ['user']

    def user_email(self, obj):
        return obj.user.email
    user_email.short_description = 'User Email'
    user_email.admin_order_field = 'user__email'

    def notification_type_name(self, obj):
        return obj.notification_type.display_name
    notification_type_name.short_description = 'Notification Type'
    notification_type_name.admin_order_field = 'notification_type__display_name'


class NotificationBatchRecipientInline(admin.TabularInline):
    """Inline for NotificationBatchRecipient"""
    model = NotificationBatchRecipient
    extra = 0
    readonly_fields = ['notification', 'status', 'sent_at', 'error_message']
    raw_id_fields = ['recipient']


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    """Admin interface for Notification"""

    list_display = [
        'title_truncated', 'recipient_email', 'sender_email',
        'notification_type_name', 'is_read', 'priority_display',
        'created_at'
    ]
    list_filter = [
        'is_read', 'notification_type', 'created_at',
        'email_sent', 'push_sent', 'notification_type__priority'
    ]
    search_fields = [
        'title', 'message', 'recipient__email',
        'sender__email', 'notification_type__name'
    ]
    ordering = ['-created_at']
    readonly_fields = [
        'created_at', 'updated_at', 'read_at',
        'email_sent_at', 'push_sent_at', 'time_since_created',
        'is_expired', 'related_object_link'
    ]
    raw_id_fields = ['recipient', 'sender']
    date_hierarchy = 'created_at'

    fieldsets = (
        ('Recipients & Sender', {
            'fields': ('recipient', 'sender')
        }),
        ('Notification Content', {
            'fields': ('notification_type', 'title', 'message', 'action_url')
        }),
        ('Related Object', {
            'fields': ('content_type', 'object_id', 'related_object_link'),
            'classes': ('collapse',)
        }),
        ('Status & Delivery', {
            'fields': (
                'is_read', 'read_at', 'email_sent', 'email_sent_at',
                'push_sent', 'push_sent_at'
            )
        }),
        ('Additional Data', {
            'fields': ('metadata', 'expires_at'),
            'classes': ('collapse',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at', 'time_since_created', 'is_expired'),
            'classes': ('collapse',)
        })
    )

    actions = ['mark_as_read', 'mark_as_unread', 'delete_selected']

    def title_truncated(self, obj):
        """Truncated title for list display"""
        return obj.title[:50] + '...' if len(obj.title) > 50 else obj.title
    title_truncated.short_description = 'Title'
    title_truncated.admin_order_field = 'title'

    def recipient_email(self, obj):
        return obj.recipient.email
    recipient_email.short_description = 'Recipient'
    recipient_email.admin_order_field = 'recipient__email'

    def sender_email(self, obj):
        return obj.sender.email if obj.sender else '-'
    sender_email.short_description = 'Sender'
    sender_email.admin_order_field = 'sender__email'

    def notification_type_name(self, obj):
        return obj.notification_type.display_name
    notification_type_name.short_description = 'Type'
    notification_type_name.admin_order_field = 'notification_type__display_name'

    def priority_display(self, obj):
        """Display priority with color coding"""
        colors = {
            'low': 'green',
            'normal': 'blue',
            'high': 'orange',
            'urgent': 'red'
        }
        color = colors.get(obj.notification_type.priority, 'black')
        return format_html(
            '<span style="color: {};">{}</span>',
            color,
            obj.notification_type.get_priority_display()
        )
    priority_display.short_description = 'Priority'
    priority_display.admin_order_field = 'notification_type__priority'

    def related_object_link(self, obj):
        """Link to related object if it exists"""
        if obj.related_object:
            try:
                url = reverse(
                    f'admin:{obj.content_type.app_label}_{obj.content_type.model}_change',
                    args=[obj.object_id]
                )
                return format_html('<a href="{}">{}</a>', url, obj.related_object)
            except:
                return str(obj.related_object)
        return '-'
    related_object_link.short_description = 'Related Object'

    def mark_as_read(self, request, queryset):
        """Admin action to mark notifications as read"""
        updated = 0
        for notification in queryset:
            if not notification.is_read:
                notification.mark_as_read()
                updated += 1

        self.message_user(
            request,
            f'{updated} notifications marked as read.'
        )
    mark_as_read.short_description = 'Mark selected notifications as read'

    def mark_as_unread(self, request, queryset):
        """Admin action to mark notifications as unread"""
        updated = 0
        for notification in queryset:
            if notification.is_read:
                notification.mark_as_unread()
                updated += 1

        self.message_user(
            request,
            f'{updated} notifications marked as unread.'
        )
    mark_as_unread.short_description = 'Mark selected notifications as unread'


@admin.register(NotificationBatch)
class NotificationBatchAdmin(admin.ModelAdmin):
    """Admin interface for NotificationBatch"""

    list_display = [
        'name', 'notification_type_name', 'status',
        'total_recipients', 'sent_count', 'failed_count',
        'completion_percentage', 'created_at'
    ]
    list_filter = ['status', 'notification_type', 'created_at', 'scheduled_for']
    search_fields = ['name', 'title_template', 'message_template']
    ordering = ['-created_at']
    readonly_fields = [
        'total_recipients', 'sent_count', 'failed_count',
        'completion_percentage', 'created_at', 'started_at', 'completed_at'
    ]
    inlines = [NotificationBatchRecipientInline]

    fieldsets = (
        ('Basic Information', {
            'fields': ('name', 'notification_type', 'status')
        }),
        ('Content Templates', {
            'fields': ('title_template', 'message_template')
        }),
        ('Scheduling', {
            'fields': ('scheduled_for',)
        }),
        ('Statistics', {
            'fields': (
                'total_recipients', 'sent_count', 'failed_count',
                'completion_percentage'
            ),
            'classes': ('collapse',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'started_at', 'completed_at'),
            'classes': ('collapse',)
        })
    )

    def notification_type_name(self, obj):
        return obj.notification_type.display_name
    notification_type_name.short_description = 'Type'
    notification_type_name.admin_order_field = 'notification_type__display_name'

    def completion_percentage(self, obj):
        """Display completion percentage with progress bar"""
        if obj.total_recipients == 0:
            return '0%'

        percentage = round((obj.sent_count / obj.total_recipients) * 100, 1)

        # Color coding based on status
        if obj.status == 'completed':
            color = 'green'
        elif obj.status == 'failed':
            color = 'red'
        elif obj.status == 'processing':
            color = 'orange'
        else:
            color = 'gray'

        return format_html(
            '<div style="width: 100px; background-color: #f0f0f0; border-radius: 3px;">'
            '<div style="width: {}%; background-color: {}; height: 20px; border-radius: 3px; text-align: center; color: white; line-height: 20px;">'
            '{}%</div></div>',
            percentage, color, percentage
        )
    completion_percentage.short_description = 'Progress'


@admin.register(NotificationBatchRecipient)
class NotificationBatchRecipientAdmin(admin.ModelAdmin):
    """Admin interface for NotificationBatchRecipient"""

    list_display = [
        'batch_name', 'recipient_email', 'status', 'sent_at', 'error_message_truncated'
    ]
    list_filter = ['status', 'batch', 'sent_at']
    search_fields = ['recipient__email', 'batch__name', 'error_message']
    ordering = ['-sent_at']
    readonly_fields = ['sent_at']
    raw_id_fields = ['batch', 'recipient', 'notification']

    def batch_name(self, obj):
        return obj.batch.name
    batch_name.short_description = 'Batch'
    batch_name.admin_order_field = 'batch__name'

    def recipient_email(self, obj):
        return obj.recipient.email
    recipient_email.short_description = 'Recipient'
    recipient_email.admin_order_field = 'recipient__email'

    def error_message_truncated(self, obj):
        """Truncated error message for list display"""
        if not obj.error_message:
            return '-'
        return obj.error_message[:50] + '...' if len(obj.error_message) > 50 else obj.error_message
    error_message_truncated.short_description = 'Error'


# Custom admin site configuration
admin.site.site_header = 'TradeShip Notification Administration'
admin.site.site_title = 'TradeShip Notifications'
admin.site.index_title = 'Notification Management'
