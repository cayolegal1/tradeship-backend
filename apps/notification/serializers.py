from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType
from django.utils import timezone
from .models import (
    NotificationType,
    NotificationUserSettings,
    Notification,
    NotificationBatch,
    NotificationBatchRecipient,
    # Chat models
    Conversation,
    ChatParticipant,
    ChatMessage
)

User = get_user_model()


class NotificationTypeSerializer(serializers.ModelSerializer):
    """Serializer for NotificationType model"""

    class Meta:
        model = NotificationType
        fields = [
            'id', 'name', 'display_name', 'description', 'is_active',
            'requires_action', 'auto_mark_read', 'default_email_enabled',
            'default_push_enabled', 'default_in_app_enabled', 'priority',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class NotificationUserSettingsSerializer(serializers.ModelSerializer):
    """Serializer for NotificationUserSettings model"""

    notification_type_details = NotificationTypeSerializer(
        source='notification_type',
        read_only=True
    )

    class Meta:
        model = NotificationUserSettings
        fields = [
            'id', 'user', 'notification_type', 'notification_type_details',
            'email_enabled', 'push_enabled', 'in_app_enabled',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate(self, data):
        """Validate that user and notification_type combination is unique"""
        user = data.get('user')
        notification_type = data.get('notification_type')

        # Check for existing setting during creation
        if self.instance is None:
            if NotificationUserSettings.objects.filter(
                user=user,
                notification_type=notification_type
            ).exists():
                raise serializers.ValidationError(
                    "User settings for this notification type already exist."
                )

        return data


class UserBasicSerializer(serializers.ModelSerializer):
    """Basic user serializer for notification contexts"""

    full_name = serializers.ReadOnlyField()

    class Meta:
        model = User
        fields = ['id', 'email', 'first_name', 'last_name', 'full_name']


class NotificationSerializer(serializers.ModelSerializer):
    """Serializer for Notification model"""

    recipient_details = UserBasicSerializer(source='recipient', read_only=True)
    sender_details = UserBasicSerializer(source='sender', read_only=True)
    notification_type_details = NotificationTypeSerializer(
        source='notification_type',
        read_only=True
    )
    time_since_created = serializers.ReadOnlyField()
    is_expired = serializers.ReadOnlyField()

    # Related object information
    related_object_type = serializers.CharField(source='content_type.model', read_only=True)
    related_object_app = serializers.CharField(source='content_type.app_label', read_only=True)

    class Meta:
        model = Notification
        fields = [
            'id', 'recipient', 'recipient_details', 'sender', 'sender_details',
            'notification_type', 'notification_type_details', 'title', 'message',
            'content_type', 'object_id', 'related_object_type', 'related_object_app',
            'is_read', 'read_at', 'email_sent', 'email_sent_at', 'push_sent',
            'push_sent_at', 'metadata', 'action_url', 'expires_at',
            'time_since_created', 'is_expired', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'email_sent', 'email_sent_at', 'push_sent', 'push_sent_at',
            'read_at', 'time_since_created', 'is_expired', 'created_at', 'updated_at'
        ]

    def validate_expires_at(self, value):
        """Validate that expiration date is in the future"""
        if value and value <= timezone.now():
            raise serializers.ValidationError(
                "Expiration date must be in the future."
            )
        return value

    def validate_content_type(self, value):
        """Validate that content type exists"""
        if value and not ContentType.objects.filter(id=value.id).exists():
            raise serializers.ValidationError("Invalid content type.")
        return value


class NotificationCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating notifications"""

    # Allow specifying recipient by email or ID
    recipient_email = serializers.EmailField(write_only=True, required=False)
    sender_email = serializers.EmailField(write_only=True, required=False)
    notification_type_name = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = Notification
        fields = [
            'recipient', 'recipient_email', 'sender', 'sender_email',
            'notification_type', 'notification_type_name', 'title', 'message',
            'content_type', 'object_id', 'metadata', 'action_url', 'expires_at'
        ]

    def validate(self, data):
        """Custom validation for creating notifications"""
        # Handle recipient by email
        if 'recipient_email' in data:
            try:
                recipient = User.objects.get(email=data['recipient_email'])
                data['recipient'] = recipient
            except User.DoesNotExist:
                raise serializers.ValidationError({
                    'recipient_email': 'User with this email does not exist.'
                })
            data.pop('recipient_email', None)

        # Handle sender by email
        if 'sender_email' in data:
            try:
                sender = User.objects.get(email=data['sender_email'])
                data['sender'] = sender
            except User.DoesNotExist:
                raise serializers.ValidationError({
                    'sender_email': 'User with this email does not exist.'
                })
            data.pop('sender_email', None)

        # Handle notification type by name
        if 'notification_type_name' in data:
            try:
                notification_type = NotificationType.objects.get(
                    name=data['notification_type_name']
                )
                data['notification_type'] = notification_type
            except NotificationType.DoesNotExist:
                raise serializers.ValidationError({
                    'notification_type_name': 'Notification type with this name does not exist.'
                })
            data.pop('notification_type_name', None)

        # Ensure recipient is provided
        if 'recipient' not in data:
            raise serializers.ValidationError({
                'recipient': 'Recipient must be specified either by ID or email.'
            })

        # Ensure notification type is provided
        if 'notification_type' not in data:
            raise serializers.ValidationError({
                'notification_type': 'Notification type must be specified either by ID or name.'
            })

        return data


class NotificationMarkReadSerializer(serializers.Serializer):
    """Serializer for marking notifications as read/unread"""

    is_read = serializers.BooleanField()
    notification_ids = serializers.ListField(
        child=serializers.UUIDField(),
        allow_empty=False,
        max_length=100,  # Limit bulk operations
        help_text="List of notification IDs to update"
    )

    def validate_notification_ids(self, value):
        """Validate that all notification IDs exist and belong to the user"""
        user = self.context['request'].user

        # Check that all notifications exist and belong to the user
        notifications = Notification.objects.filter(
            id__in=value,
            recipient=user
        )

        if notifications.count() != len(value):
            raise serializers.ValidationError(
                "Some notification IDs are invalid or don't belong to you."
            )

        return value


class NotificationBatchRecipientSerializer(serializers.ModelSerializer):
    """Serializer for NotificationBatchRecipient model"""

    recipient_details = UserBasicSerializer(source='recipient', read_only=True)
    notification_details = NotificationSerializer(source='notification', read_only=True)

    class Meta:
        model = NotificationBatchRecipient
        fields = [
            'id', 'batch', 'recipient', 'recipient_details',
            'notification', 'notification_details', 'status',
            'error_message', 'sent_at'
        ]
        read_only_fields = ['id', 'notification', 'sent_at']


class NotificationBatchSerializer(serializers.ModelSerializer):
    """Serializer for NotificationBatch model"""

    notification_type_details = NotificationTypeSerializer(
        source='notification_type',
        read_only=True
    )
    recipients_details = NotificationBatchRecipientSerializer(
        source='notificationbatchrecipient_set',
        many=True,
        read_only=True
    )

    # Statistics
    completion_percentage = serializers.SerializerMethodField()

    class Meta:
        model = NotificationBatch
        fields = [
            'id', 'name', 'notification_type', 'notification_type_details',
            'status', 'title_template', 'message_template', 'scheduled_for',
            'total_recipients', 'sent_count', 'failed_count',
            'completion_percentage', 'recipients_details',
            'created_at', 'started_at', 'completed_at'
        ]
        read_only_fields = [
            'id', 'total_recipients', 'sent_count', 'failed_count',
            'started_at', 'completed_at', 'created_at'
        ]

    def get_completion_percentage(self, obj):
        """Calculate completion percentage"""
        if obj.total_recipients == 0:
            return 0
        return round((obj.sent_count / obj.total_recipients) * 100, 1)

    def validate_scheduled_for(self, value):
        """Validate that scheduled time is in the future"""
        if value and value <= timezone.now():
            raise serializers.ValidationError(
                "Scheduled time must be in the future."
            )
        return value


class NotificationBatchCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating notification batches"""

    recipient_emails = serializers.ListField(
        child=serializers.EmailField(),
        write_only=True,
        allow_empty=False,
        max_length=1000,  # Limit batch size
        help_text="List of recipient email addresses"
    )
    notification_type_name = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = NotificationBatch
        fields = [
            'name', 'notification_type', 'notification_type_name',
            'title_template', 'message_template', 'scheduled_for',
            'recipient_emails'
        ]

    def validate_recipient_emails(self, value):
        """Validate that all recipient emails exist"""
        existing_emails = set(
            User.objects.filter(email__in=value).values_list('email', flat=True)
        )

        missing_emails = set(value) - existing_emails
        if missing_emails:
            raise serializers.ValidationError(
                f"The following emails don't exist: {', '.join(missing_emails)}"
            )

        return value

    def validate(self, data):
        """Custom validation for creating batches"""
        # Handle notification type by name
        if 'notification_type_name' in data:
            try:
                notification_type = NotificationType.objects.get(
                    name=data['notification_type_name']
                )
                data['notification_type'] = notification_type
            except NotificationType.DoesNotExist:
                raise serializers.ValidationError({
                    'notification_type_name': 'Notification type with this name does not exist.'
                })
            data.pop('notification_type_name', None)

        return data


class NotificationStatsSerializer(serializers.Serializer):
    """Serializer for notification statistics"""

    total_notifications = serializers.IntegerField()
    unread_notifications = serializers.IntegerField()
    read_notifications = serializers.IntegerField()
    notifications_today = serializers.IntegerField()
    notifications_this_week = serializers.IntegerField()
    notifications_this_month = serializers.IntegerField()

    # By type statistics
    by_type = serializers.DictField(child=serializers.IntegerField())

    # Recent activity
    recent_notifications = NotificationSerializer(many=True)


class NotificationPreferencesSerializer(serializers.Serializer):
    """Serializer for user notification preferences"""

    global_email_enabled = serializers.BooleanField(default=True)
    global_push_enabled = serializers.BooleanField(default=True)
    global_in_app_enabled = serializers.BooleanField(default=True)

    # Individual type preferences
    type_preferences = serializers.DictField(
        child=serializers.DictField(child=serializers.BooleanField()),
        help_text="Nested dict: {type_name: {email: bool, push: bool, in_app: bool}}"
    )


# Chat Serializers
class ChatParticipantSerializer(serializers.ModelSerializer):
    """Serializer for chat participants"""

    user_details = UserBasicSerializer(source='user', read_only=True)
    unread_count = serializers.ReadOnlyField()

    class Meta:
        model = ChatParticipant
        fields = [
            'id', 'user', 'user_details', 'role', 'is_active', 'is_muted',
            'joined_at', 'left_at', 'last_read_at', 'unread_count'
        ]
        read_only_fields = ['id', 'joined_at', 'left_at']


class ConversationSerializer(serializers.ModelSerializer):
    """Serializer for conversations"""

    created_by_details = UserBasicSerializer(source='created_by', read_only=True)
    participants_details = ChatParticipantSerializer(
        source='chatparticipant_set',
        many=True,
        read_only=True
    )
    participant_count = serializers.ReadOnlyField()
    last_message_details = serializers.SerializerMethodField()

    # Related object information
    related_object_type = serializers.CharField(source='content_type.model', read_only=True)
    related_object_app = serializers.CharField(source='content_type.app_label', read_only=True)

    class Meta:
        model = Conversation
        fields = [
            'id', 'conversation_type', 'title', 'description',
            'created_by', 'created_by_details', 'content_type', 'object_id',
            'related_object_type', 'related_object_app', 'is_active',
            'is_archived', 'is_private', 'allow_new_participants',
            'last_message_at', 'participant_count', 'participants_details',
            'last_message_details', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'last_message_at', 'created_at', 'updated_at']

    def get_last_message_details(self, obj):
        """Get details of the last message"""
        last_message = obj.last_message
        if last_message:
            return {
                'id': str(last_message.id),
                'content': last_message.content,
                'sender': last_message.sender.full_name,
                'message_type': last_message.message_type,
                'created_at': last_message.created_at,
                'is_deleted': last_message.is_deleted
            }
        return None


class ConversationCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating conversations"""

    participant_emails = serializers.ListField(
        child=serializers.EmailField(),
        write_only=True,
        required=False,
        help_text="List of participant email addresses"
    )
    participant_ids = serializers.ListField(
        child=serializers.UUIDField(),
        write_only=True,
        required=False,
        help_text="List of participant user IDs"
    )

    class Meta:
        model = Conversation
        fields = [
            'conversation_type', 'title', 'description', 'is_private',
            'allow_new_participants', 'content_type', 'object_id',
            'participant_emails', 'participant_ids'
        ]

    def validate(self, data):
        """Validate conversation creation data"""
        participant_emails = data.get('participant_emails', [])
        participant_ids = data.get('participant_ids', [])

        if not participant_emails and not participant_ids:
            raise serializers.ValidationError(
                "Either participant_emails or participant_ids must be provided"
            )

        # Validate participant emails exist
        if participant_emails:
            existing_emails = set(
                User.objects.filter(email__in=participant_emails).values_list('email', flat=True)
            )
            missing_emails = set(participant_emails) - existing_emails
            if missing_emails:
                raise serializers.ValidationError({
                    'participant_emails': f"The following emails don't exist: {', '.join(missing_emails)}"
                })

        # Validate participant IDs exist
        if participant_ids:
            existing_ids = set(
                User.objects.filter(id__in=participant_ids).values_list('id', flat=True)
            )
            missing_ids = set(participant_ids) - existing_ids
            if missing_ids:
                raise serializers.ValidationError({
                    'participant_ids': f"The following user IDs don't exist: {', '.join(str(id) for id in missing_ids)}"
                })

        return data

    def create(self, validated_data):
        """Create conversation with participants"""
        participant_emails = validated_data.pop('participant_emails', [])
        participant_ids = validated_data.pop('participant_ids', [])

        # Set created_by to current user
        validated_data['created_by'] = self.context['request'].user

        # Create conversation
        conversation = super().create(validated_data)

        # Add participants
        participants = []

        if participant_emails:
            participants.extend(
                User.objects.filter(email__in=participant_emails)
            )

        if participant_ids:
            participants.extend(
                User.objects.filter(id__in=participant_ids)
            )

        # Add creator as participant if not already included
        creator = self.context['request'].user
        if creator not in participants:
            participants.append(creator)

        # Create participant records
        for participant in participants:
            role = 'owner' if participant == creator else 'member'
            conversation.add_participant(participant, added_by=creator)

            # Update role for creator
            if participant == creator:
                chat_participant = ChatParticipant.objects.get(
                    conversation=conversation,
                    user=participant
                )
                chat_participant.role = role
                chat_participant.save()

        return conversation


class ChatMessageSerializer(serializers.ModelSerializer):
    """Serializer for chat messages"""

    sender_details = UserBasicSerializer(source='sender', read_only=True)
    reply_to_details = serializers.SerializerMethodField()
    read_count = serializers.ReadOnlyField()
    is_read_by_user = serializers.SerializerMethodField()

    class Meta:
        model = ChatMessage
        fields = [
            'id', 'conversation', 'sender', 'sender_details', 'message_type',
            'content', 'file', 'file_name', 'file_size', 'mime_type',
            'reply_to', 'reply_to_details', 'is_edited', 'is_deleted',
            'delivered_at', 'metadata', 'read_count', 'is_read_by_user',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'sender', 'is_edited', 'delivered_at', 'created_at', 'updated_at'
        ]

    def get_reply_to_details(self, obj):
        """Get details of the message being replied to"""
        if obj.reply_to:
            return {
                'id': str(obj.reply_to.id),
                'content': obj.reply_to.content[:100] + '...' if len(obj.reply_to.content) > 100 else obj.reply_to.content,
                'sender': obj.reply_to.sender.full_name,
                'message_type': obj.reply_to.message_type
            }
        return None

    def get_is_read_by_user(self, obj):
        """Check if current user has read this message"""
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            try:
                participant = ChatParticipant.objects.get(
                    conversation=obj.conversation,
                    user=request.user,
                    is_active=True
                )
                return (
                    participant.last_read_at
                    and participant.last_read_at >= obj.created_at
                )
            except ChatParticipant.DoesNotExist:
                return False
        return False

    def validate_conversation(self, value):
        """Validate that user can send messages to this conversation"""
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            if not ChatParticipant.objects.filter(
                conversation=value,
                user=request.user,
                is_active=True
            ).exists():
                raise serializers.ValidationError(
                    "You are not a participant in this conversation"
                )
        return value

    def create(self, validated_data):
        """Create message and mark as delivered"""
        validated_data['sender'] = self.context['request'].user
        message = super().create(validated_data)
        message.mark_as_delivered()
        return message


class ChatMessageCreateSerializer(serializers.ModelSerializer):
    """Simplified serializer for creating chat messages"""

    class Meta:
        model = ChatMessage
        fields = [
            'conversation', 'message_type', 'content', 'file',
            'reply_to', 'metadata'
        ]

    def validate_conversation(self, value):
        """Validate that user can send messages to this conversation"""
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            if not ChatParticipant.objects.filter(
                conversation=value,
                user=request.user,
                is_active=True
            ).exists():
                raise serializers.ValidationError(
                    "You are not a participant in this conversation"
                )
        return value


class ConversationListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for conversation lists"""

    last_message_preview = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()
    other_participant = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = [
            'id', 'conversation_type', 'title', 'is_active', 'is_archived',
            'last_message_at', 'last_message_preview', 'unread_count',
            'other_participant', 'created_at'
        ]

    def get_last_message_preview(self, obj):
        """Get preview of last message"""
        last_message = obj.last_message
        if last_message:
            content = last_message.content
            if last_message.is_deleted:
                content = "[Message deleted]"
            elif last_message.message_type != 'text':
                content = f"[{last_message.get_message_type_display()}]"

            return {
                'content': content[:50] + '...' if len(content) > 50 else content,
                'sender': last_message.sender.full_name,
                'created_at': last_message.created_at
            }
        return None

    def get_unread_count(self, obj):
        """Get unread message count for current user"""
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            try:
                participant = ChatParticipant.objects.get(
                    conversation=obj,
                    user=request.user,
                    is_active=True
                )
                return participant.unread_count
            except ChatParticipant.DoesNotExist:
                return 0
        return 0

    def get_other_participant(self, obj):
        """Get other participant for direct messages"""
        if obj.conversation_type == 'direct':
            request = self.context.get('request')
            if request and request.user.is_authenticated:
                other_participants = obj.get_participants().exclude(id=request.user.id)
                if other_participants.exists():
                    other = other_participants.first()
                    return {
                        'id': str(other.id),
                        'full_name': other.full_name,
                        'email': other.email
                    }
        return None


class MarkAsReadSerializer(serializers.Serializer):
    """Serializer for marking messages as read"""

    conversation_id = serializers.UUIDField()
    message_id = serializers.UUIDField(required=False)

    def validate_conversation_id(self, value):
        """Validate that conversation exists and user is participant"""
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            if not ChatParticipant.objects.filter(
                conversation_id=value,
                user=request.user,
                is_active=True
            ).exists():
                raise serializers.ValidationError(
                    "You are not a participant in this conversation"
                )
        return value
