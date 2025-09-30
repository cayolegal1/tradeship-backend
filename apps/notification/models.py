from django.db import models
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType
from django.contrib.contenttypes.fields import GenericForeignKey
from django.utils import timezone
import uuid

User = get_user_model()


class NotificationType(models.Model):
    """Different types of notifications that can be sent to users"""

    # Notification type choices for trading platform
    TYPE_CHOICES = [
        ('trade_request', 'Trade Request'),
        ('trade_accepted', 'Trade Accepted'),
        ('trade_declined', 'Trade Declined'),
        ('trade_completed', 'Trade Completed'),
        ('trade_cancelled', 'Trade Cancelled'),
        ('message_received', 'Message Received'),
        ('item_liked', 'Item Liked'),
        ('item_comment', 'Item Comment'),
        ('profile_viewed', 'Profile Viewed'),
        ('system_announcement', 'System Announcement'),
        ('account_security', 'Account Security'),
        ('payment_received', 'Payment Received'),
        ('payment_sent', 'Payment Sent'),
        ('rating_received', 'Rating Received'),
        ('item_expired', 'Item Expired'),
        ('promotion', 'Promotion'),
        ('reminder', 'Reminder'),
        # Chat/Messaging types
        ('chat_message', 'Chat Message'),
        ('chat_typing', 'Chat Typing Indicator'),
        ('chat_read', 'Chat Message Read'),
        ('chat_group_created', 'Group Chat Created'),
        ('chat_group_joined', 'Joined Group Chat'),
        ('chat_group_left', 'Left Group Chat'),
        ('chat_mention', 'Mentioned in Chat'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(
        max_length=50,
        choices=TYPE_CHOICES,
        unique=True,
        help_text="Type of notification"
    )
    display_name = models.CharField(
        max_length=100,
        help_text="Human-readable name for the notification type"
    )
    description = models.TextField(
        blank=True,
        help_text="Description of when this notification type is used"
    )

    # Notification settings
    is_active = models.BooleanField(
        default=True,
        help_text="Whether this notification type is currently active"
    )
    requires_action = models.BooleanField(
        default=False,
        help_text="Whether this notification requires user action"
    )
    auto_mark_read = models.BooleanField(
        default=False,
        help_text="Automatically mark as read when viewed"
    )

    # Default settings for new users
    default_email_enabled = models.BooleanField(
        default=True,
        help_text="Default email notification setting for new users"
    )
    default_push_enabled = models.BooleanField(
        default=True,
        help_text="Default push notification setting for new users"
    )
    default_in_app_enabled = models.BooleanField(
        default=True,
        help_text="Default in-app notification setting for new users"
    )

    # Priority level
    PRIORITY_CHOICES = [
        ('low', 'Low'),
        ('normal', 'Normal'),
        ('high', 'High'),
        ('urgent', 'Urgent'),
    ]
    priority = models.CharField(
        max_length=10,
        choices=PRIORITY_CHOICES,
        default='normal',
        help_text="Priority level of this notification type"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        indexes = [
            models.Index(fields=['name']),
            models.Index(fields=['is_active']),
            models.Index(fields=['priority']),
        ]

    def __str__(self):
        return self.display_name


class NotificationUserSettings(models.Model):
    """User-specific notification preferences for each notification type"""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='notification_settings'
    )
    notification_type = models.ForeignKey(
        NotificationType,
        on_delete=models.CASCADE,
        related_name='user_settings'
    )

    # Channel preferences
    email_enabled = models.BooleanField(
        default=True,
        help_text="Receive email notifications for this type"
    )
    push_enabled = models.BooleanField(
        default=True,
        help_text="Receive push notifications for this type"
    )
    in_app_enabled = models.BooleanField(
        default=True,
        help_text="Receive in-app notifications for this type"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['user', 'notification_type']
        indexes = [
            models.Index(fields=['user']),
            models.Index(fields=['notification_type']),
        ]

    def __str__(self):
        return f"{self.user.email} - {self.notification_type.display_name}"


class Notification(models.Model):
    """Individual notification instances sent to users"""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Recipient and sender
    recipient = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='received_notifications',
        help_text="User who receives this notification"
    )
    sender = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sent_notifications',
        help_text="User who triggered this notification (if applicable)"
    )

    # Notification details
    notification_type = models.ForeignKey(
        NotificationType,
        on_delete=models.CASCADE,
        related_name='notifications'
    )
    title = models.CharField(
        max_length=255,
        help_text="Notification title/subject"
    )
    message = models.TextField(
        help_text="Notification message content"
    )

    # Related object (generic foreign key for flexibility)
    content_type = models.ForeignKey(
        ContentType,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        help_text="Type of related object"
    )
    object_id = models.UUIDField(
        null=True,
        blank=True,
        help_text="ID of related object"
    )
    related_object = GenericForeignKey('content_type', 'object_id')

    # Status and metadata
    is_read = models.BooleanField(
        default=False,
        help_text="Whether notification has been read"
    )
    read_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When notification was marked as read"
    )

    # Delivery status
    email_sent = models.BooleanField(
        default=False,
        help_text="Whether email notification was sent"
    )
    email_sent_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When email notification was sent"
    )
    push_sent = models.BooleanField(
        default=False,
        help_text="Whether push notification was sent"
    )
    push_sent_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When push notification was sent"
    )

    # Additional data (JSON field for flexible metadata)
    metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text="Additional notification data"
    )

    # Action URL (for notifications that require action)
    action_url = models.URLField(
        max_length=500,
        blank=True,
        help_text="URL to redirect user when notification is clicked"
    )

    # Expiration
    expires_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When notification expires (optional)"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['recipient', '-created_at']),
            models.Index(fields=['recipient', 'is_read']),
            models.Index(fields=['notification_type']),
            models.Index(fields=['sender']),
            models.Index(fields=['created_at']),
            models.Index(fields=['expires_at']),
            models.Index(fields=['content_type', 'object_id']),
        ]

    def __str__(self):
        return f"{self.title} - {self.recipient.email}"

    def mark_as_read(self):
        """Mark notification as read"""
        if not self.is_read:
            from django.utils import timezone
            self.is_read = True
            self.read_at = timezone.now()
            self.save(update_fields=['is_read', 'read_at'])

    def mark_as_unread(self):
        """Mark notification as unread"""
        if self.is_read:
            self.is_read = False
            self.read_at = None
            self.save(update_fields=['is_read', 'read_at'])

    @property
    def is_expired(self):
        """Check if notification has expired"""
        if not self.expires_at:
            return False
        from django.utils import timezone
        return timezone.now() > self.expires_at

    @property
    def time_since_created(self):
        """Get human-readable time since creation"""
        from django.utils import timezone
        from django.utils.timesince import timesince
        return timesince(self.created_at, timezone.now())

    def get_absolute_url(self):
        """Get the URL for this notification"""
        return self.action_url or '#'


class NotificationBatch(models.Model):
    """Batch operations for sending multiple notifications"""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(
        max_length=255,
        help_text="Name/description of this batch"
    )
    notification_type = models.ForeignKey(
        NotificationType,
        on_delete=models.CASCADE,
        related_name='batches'
    )

    # Batch status
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
        ('cancelled', 'Cancelled'),
    ]
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending'
    )

    # Recipients (many-to-many for batch notifications)
    recipients = models.ManyToManyField(
        User,
        through='NotificationBatchRecipient',
        related_name='notification_batches'
    )

    # Batch content
    title_template = models.CharField(
        max_length=255,
        help_text="Template for notification titles"
    )
    message_template = models.TextField(
        help_text="Template for notification messages"
    )

    # Scheduling
    scheduled_for = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When to send this batch (null for immediate)"
    )

    # Statistics
    total_recipients = models.PositiveIntegerField(default=0)
    sent_count = models.PositiveIntegerField(default=0)
    failed_count = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['scheduled_for']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f"Batch: {self.name}"


class NotificationBatchRecipient(models.Model):
    """Through model for batch recipients with individual status"""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    batch = models.ForeignKey(NotificationBatch, on_delete=models.CASCADE)
    recipient = models.ForeignKey(User, on_delete=models.CASCADE)
    notification = models.OneToOneField(
        Notification,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        help_text="Created notification for this recipient"
    )

    # Status for this specific recipient
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('sent', 'Sent'),
        ('failed', 'Failed'),
        ('skipped', 'Skipped'),
    ]
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending'
    )
    error_message = models.TextField(
        blank=True,
        help_text="Error message if sending failed"
    )

    sent_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ['batch', 'recipient']
        indexes = [
            models.Index(fields=['batch']),
            models.Index(fields=['recipient']),
            models.Index(fields=['status']),
        ]

    def __str__(self):
        return f"{self.batch.name} - {self.recipient.email}"


class Conversation(models.Model):
    """Model for chat conversations between users"""

    CONVERSATION_TYPES = [
        ('direct', 'Direct Message'),
        ('group', 'Group Chat'),
        ('trade', 'Trade Discussion'),
        ('support', 'Support Chat'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    conversation_type = models.CharField(
        max_length=20,
        choices=CONVERSATION_TYPES,
        default='direct',
        help_text="Type of conversation"
    )

    # Conversation details
    title = models.CharField(
        max_length=255,
        blank=True,
        help_text="Conversation title (for group chats)"
    )
    description = models.TextField(
        blank=True,
        help_text="Conversation description"
    )

    # Participants
    participants = models.ManyToManyField(
        User,
        through='ChatParticipant',
        through_fields=('conversation', 'user'),
        related_name='conversations',
        help_text="Users participating in this conversation"
    )

    # Creator and admin
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='conversations_created',
        help_text="User who created this conversation"
    )

    # Related object (e.g., trade, item)
    content_type = models.ForeignKey(
        ContentType,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        help_text="Type of related object"
    )
    object_id = models.UUIDField(
        null=True,
        blank=True,
        help_text="ID of related object"
    )
    related_object = GenericForeignKey('content_type', 'object_id')

    # Status and settings
    is_active = models.BooleanField(
        default=True,
        help_text="Whether conversation is active"
    )
    is_archived = models.BooleanField(
        default=False,
        help_text="Whether conversation is archived"
    )

    # Privacy settings
    is_private = models.BooleanField(
        default=True,
        help_text="Whether conversation is private"
    )
    allow_new_participants = models.BooleanField(
        default=False,
        help_text="Whether new participants can be added"
    )

    # Last activity
    last_message_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When the last message was sent"
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-last_message_at', '-created_at']
        indexes = [
            models.Index(fields=['conversation_type']),
            models.Index(fields=['created_by']),
            models.Index(fields=['is_active']),
            models.Index(fields=['last_message_at']),
            models.Index(fields=['content_type', 'object_id']),
        ]

    def __str__(self):
        if self.title:
            return self.title
        if self.conversation_type == 'direct':
            participants = list(self.participants.all()[:2])
            if len(participants) == 2:
                return f"{participants[0].full_name} & {participants[1].full_name}"
        return f"{self.get_conversation_type_display()} - {self.id}"

    @property
    def participant_count(self):
        """Get number of active participants"""
        return self.chatparticipant_set.filter(is_active=True).count()

    @property
    def last_message(self):
        """Get the last message in this conversation"""
        return self.messages.first()

    def add_participant(self, user, added_by=None):
        """Add a participant to the conversation"""
        participant, created = ChatParticipant.objects.get_or_create(
            conversation=self,
            user=user,
            defaults={
                'added_by': added_by,
                'joined_at': timezone.now(),
            }
        )
        return participant, created

    def remove_participant(self, user):
        """Remove a participant from the conversation"""
        try:
            participant = ChatParticipant.objects.get(
                conversation=self,
                user=user,
                is_active=True
            )
            participant.is_active = False
            participant.left_at = timezone.now()
            participant.save()
            return True
        except ChatParticipant.DoesNotExist:
            return False

    def get_participants(self, active_only=True):
        """Get conversation participants"""
        queryset = self.participants.all()
        if active_only:
            queryset = queryset.filter(
                chatparticipant__is_active=True
            )
        return queryset

    def update_last_message_time(self):
        """Update last message timestamp"""
        from django.utils import timezone
        self.last_message_at = timezone.now()
        self.save(update_fields=['last_message_at'])


class ChatParticipant(models.Model):
    """Through model for conversation participants"""

    PARTICIPANT_ROLES = [
        ('member', 'Member'),
        ('admin', 'Admin'),
        ('owner', 'Owner'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE)
    user = models.ForeignKey(User, on_delete=models.CASCADE)

    # Participant details
    role = models.CharField(
        max_length=20,
        choices=PARTICIPANT_ROLES,
        default='member',
        help_text="Participant role in the conversation"
    )

    # Status
    is_active = models.BooleanField(
        default=True,
        help_text="Whether participant is active in conversation"
    )
    is_muted = models.BooleanField(
        default=False,
        help_text="Whether participant has muted the conversation"
    )

    # Participation tracking
    added_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='chat_participants_added',
        help_text="User who added this participant"
    )

    # Timestamps
    joined_at = models.DateTimeField(auto_now_add=True)
    left_at = models.DateTimeField(null=True, blank=True)
    last_read_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When participant last read messages"
    )

    class Meta:
        unique_together = ['conversation', 'user']
        indexes = [
            models.Index(fields=['conversation', 'is_active']),
            models.Index(fields=['user', 'is_active']),
            models.Index(fields=['last_read_at']),
        ]

    def __str__(self):
        return f"{self.user.full_name} in {self.conversation}"

    def mark_as_read(self, timestamp=None):
        """Mark conversation as read up to a specific timestamp"""
        from django.utils import timezone
        self.last_read_at = timestamp or timezone.now()
        self.save(update_fields=['last_read_at'])

    @property
    def unread_count(self):
        """Get count of unread messages"""
        queryset = self.conversation.messages.all()
        if self.last_read_at:
            queryset = queryset.filter(created_at__gt=self.last_read_at)
        return queryset.exclude(sender=self.user).count()


class ChatMessage(models.Model):
    """Model for individual chat messages"""

    MESSAGE_TYPES = [
        ('text', 'Text Message'),
        ('image', 'Image'),
        ('file', 'File'),
        ('system', 'System Message'),
        ('trade_offer', 'Trade Offer'),
        ('location', 'Location'),
        ('sticker', 'Sticker'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    conversation = models.ForeignKey(
        Conversation,
        on_delete=models.CASCADE,
        related_name='messages'
    )

    # Message details
    sender = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='chat_messages_sent',
        help_text="User who sent this message"
    )
    message_type = models.CharField(
        max_length=20,
        choices=MESSAGE_TYPES,
        default='text',
        help_text="Type of message"
    )

    # Content
    content = models.TextField(
        help_text="Message content"
    )

    # File attachments
    file = models.FileField(
        upload_to='chat/files/',
        null=True,
        blank=True,
        help_text="Attached file (for image/file messages)"
    )
    file_name = models.CharField(
        max_length=255,
        blank=True,
        help_text="Original filename"
    )
    file_size = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="File size in bytes"
    )
    mime_type = models.CharField(
        max_length=100,
        blank=True,
        help_text="MIME type of attached file"
    )

    # Message relationships
    reply_to = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='replies',
        help_text="Message this is replying to"
    )

    # Message status
    is_edited = models.BooleanField(
        default=False,
        help_text="Whether message has been edited"
    )
    is_deleted = models.BooleanField(
        default=False,
        help_text="Whether message has been deleted"
    )

    # Delivery tracking
    delivered_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When message was delivered"
    )

    # Additional data
    metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text="Additional message data"
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['conversation', '-created_at']),
            models.Index(fields=['sender']),
            models.Index(fields=['message_type']),
            models.Index(fields=['is_deleted']),
            models.Index(fields=['reply_to']),
        ]

    def __str__(self):
        content_preview = self.content[:50] + '...' if len(self.content) > 50 else self.content
        return f"{self.sender.full_name}: {content_preview}"

    def mark_as_delivered(self):
        """Mark message as delivered"""
        if not self.delivered_at:
            from django.utils import timezone
            self.delivered_at = timezone.now()
            self.save(update_fields=['delivered_at'])

    def soft_delete(self):
        """Soft delete the message"""
        self.is_deleted = True
        self.content = "[Message deleted]"
        self.save(update_fields=['is_deleted', 'content'])

    def get_read_by(self):
        """Get list of participants who have read this message"""
        return ChatParticipant.objects.filter(
            conversation=self.conversation,
            is_active=True,
            last_read_at__gte=self.created_at
        ).exclude(user=self.sender)

    @property
    def read_count(self):
        """Get count of participants who have read this message"""
        return self.get_read_by().count()

    @property
    def is_system_message(self):
        """Check if this is a system message"""
        return self.message_type == 'system'

    def save(self, *args, **kwargs):
        """Override save to update conversation last message time"""
        is_new = self.pk is None
        super().save(*args, **kwargs)

        if is_new and not self.is_deleted:
            # Update conversation's last message time
            self.conversation.update_last_message_time()
