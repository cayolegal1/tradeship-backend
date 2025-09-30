from django.db.models import Q, Count
from django.utils import timezone
from datetime import timedelta
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.pagination import PageNumberPagination
from django_filters.rest_framework import DjangoFilterBackend
from django_filters import FilterSet, BooleanFilter, CharFilter, DateTimeFilter

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
from .serializers import (
    NotificationTypeSerializer,
    NotificationUserSettingsSerializer,
    NotificationSerializer,
    NotificationCreateSerializer,
    NotificationMarkReadSerializer,
    NotificationBatchSerializer,
    NotificationBatchCreateSerializer,
    NotificationBatchRecipientSerializer,
    NotificationStatsSerializer,
    NotificationPreferencesSerializer,
    # Chat serializers
    ConversationSerializer,
    ConversationCreateSerializer,
    ConversationListSerializer,
    ChatMessageSerializer,
    ChatMessageCreateSerializer,
    MarkAsReadSerializer
)


class NotificationPagination(PageNumberPagination):
    """Custom pagination for notifications"""
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class NotificationFilter(FilterSet):
    """Filter for notifications"""

    is_read = BooleanFilter(field_name='is_read')
    notification_type = CharFilter(field_name='notification_type__name')
    sender = CharFilter(field_name='sender__email')
    created_after = DateTimeFilter(field_name='created_at', lookup_expr='gte')
    created_before = DateTimeFilter(field_name='created_at', lookup_expr='lte')
    has_action = BooleanFilter(method='filter_has_action')
    is_expired = BooleanFilter(method='filter_is_expired')

    class Meta:
        model = Notification
        fields = ['is_read', 'notification_type', 'sender']

    def filter_has_action(self, queryset, name, value):
        """Filter notifications that have action URLs"""
        if value:
            return queryset.exclude(action_url='')
        return queryset.filter(action_url='')

    def filter_is_expired(self, queryset, name, value):
        """Filter expired notifications"""
        now = timezone.now()
        if value:
            return queryset.filter(expires_at__lt=now)
        return queryset.filter(Q(expires_at__gte=now) | Q(expires_at__isnull=True))


class NotificationTypeViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for NotificationType - read-only for users"""

    queryset = NotificationType.objects.filter(is_active=True)
    serializer_class = NotificationTypeSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Return active notification types"""
        return NotificationType.objects.filter(is_active=True)

    @action(detail=False, methods=['get'])
    def choices(self, request):
        """Get notification type choices for forms"""
        choices = [
            {'value': nt.name, 'label': nt.display_name}
            for nt in self.get_queryset()
        ]
        return Response(choices)


class NotificationUserSettingsViewSet(viewsets.ModelViewSet):
    """ViewSet for user notification settings"""

    serializer_class = NotificationUserSettingsSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Return settings for the current user"""
        return NotificationUserSettings.objects.filter(
            user=self.request.user
        ).select_related('notification_type')

    def perform_create(self, serializer):
        """Set the user to the current user"""
        serializer.save(user=self.request.user)

    @action(detail=False, methods=['get'])
    def preferences(self, request):
        """Get user's notification preferences in a structured format"""
        settings = self.get_queryset()

        # Global preferences (default to True if no settings exist)
        global_prefs = {
            'global_email_enabled': True,
            'global_push_enabled': True,
            'global_in_app_enabled': True,
        }

        # Type-specific preferences
        type_preferences = {}
        for setting in settings:
            type_preferences[setting.notification_type.name] = {
                'email': setting.email_enabled,
                'push': setting.push_enabled,
                'in_app': setting.in_app_enabled,
            }

        # Add defaults for types not configured
        all_types = NotificationType.objects.filter(is_active=True)
        for nt in all_types:
            if nt.name not in type_preferences:
                type_preferences[nt.name] = {
                    'email': nt.default_email_enabled,
                    'push': nt.default_push_enabled,
                    'in_app': nt.default_in_app_enabled,
                }

        data = {
            **global_prefs,
            'type_preferences': type_preferences
        }

        serializer = NotificationPreferencesSerializer(data)
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def update_preferences(self, request):
        """Update user's notification preferences"""
        serializer = NotificationPreferencesSerializer(data=request.data)
        if serializer.is_valid():
            type_preferences = serializer.validated_data.get('type_preferences', {})

            # Update or create settings for each type
            for type_name, prefs in type_preferences.items():
                try:
                    notification_type = NotificationType.objects.get(name=type_name)
                    settings, created = NotificationUserSettings.objects.get_or_create(
                        user=request.user,
                        notification_type=notification_type,
                        defaults={
                            'email_enabled': prefs.get('email', True),
                            'push_enabled': prefs.get('push', True),
                            'in_app_enabled': prefs.get('in_app', True),
                        }
                    )

                    if not created:
                        settings.email_enabled = prefs.get('email', settings.email_enabled)
                        settings.push_enabled = prefs.get('push', settings.push_enabled)
                        settings.in_app_enabled = prefs.get('in_app', settings.in_app_enabled)
                        settings.save()

                except NotificationType.DoesNotExist:
                    continue

            return Response({'message': 'Preferences updated successfully'})

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class NotificationViewSet(viewsets.ModelViewSet):
    """ViewSet for user notifications"""

    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = NotificationPagination
    filter_backends = [DjangoFilterBackend]
    filterset_class = NotificationFilter

    def get_queryset(self):
        """Return notifications for the current user"""
        return Notification.objects.filter(
            recipient=self.request.user
        ).select_related(
            'sender', 'notification_type', 'content_type'
        ).order_by('-created_at')

    def get_serializer_class(self):
        """Use different serializers for different actions"""
        if self.action == 'create':
            return NotificationCreateSerializer
        return NotificationSerializer

    def perform_create(self, serializer):
        """Set the recipient to the current user if not specified"""
        if 'recipient' not in serializer.validated_data:
            serializer.save(recipient=self.request.user)
        else:
            serializer.save()

    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        """Mark a notification as read"""
        notification = self.get_object()
        notification.mark_as_read()
        return Response({'message': 'Notification marked as read'})

    @action(detail=True, methods=['post'])
    def mark_unread(self, request, pk=None):
        """Mark a notification as unread"""
        notification = self.get_object()
        notification.mark_as_unread()
        return Response({'message': 'Notification marked as unread'})

    @action(detail=False, methods=['post'])
    def mark_multiple(self, request):
        """Mark multiple notifications as read or unread"""
        serializer = NotificationMarkReadSerializer(
            data=request.data,
            context={'request': request}
        )

        if serializer.is_valid():
            notification_ids = serializer.validated_data['notification_ids']
            is_read = serializer.validated_data['is_read']

            notifications = Notification.objects.filter(
                id__in=notification_ids,
                recipient=request.user
            )

            updated_count = 0
            for notification in notifications:
                if is_read:
                    if not notification.is_read:
                        notification.mark_as_read()
                        updated_count += 1
                else:
                    if notification.is_read:
                        notification.mark_as_unread()
                        updated_count += 1

            action = 'read' if is_read else 'unread'
            return Response({
                'message': f'{updated_count} notifications marked as {action}',
                'updated_count': updated_count
            })

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def mark_all_read(self, request):
        """Mark all notifications as read for the current user"""
        updated = Notification.objects.filter(
            recipient=request.user,
            is_read=False
        ).update(is_read=True, read_at=timezone.now())

        return Response({
            'message': f'{updated} notifications marked as read',
            'updated_count': updated
        })

    @action(detail=False, methods=['get'])
    def unread_count(self, request):
        """Get count of unread notifications"""
        count = self.get_queryset().filter(is_read=False).count()
        return Response({'unread_count': count})

    @action(detail=False, methods=['get'])
    def statistics(self, request):
        """Get notification statistics for the user"""
        queryset = self.get_queryset()

        # Basic counts
        total = queryset.count()
        unread = queryset.filter(is_read=False).count()
        read = total - unread

        # Time-based counts
        now = timezone.now()
        today = queryset.filter(created_at__date=now.date()).count()
        week_ago = now - timedelta(days=7)
        this_week = queryset.filter(created_at__gte=week_ago).count()
        month_ago = now - timedelta(days=30)
        this_month = queryset.filter(created_at__gte=month_ago).count()

        # By type counts
        by_type = {}
        type_counts = queryset.values(
            'notification_type__name',
            'notification_type__display_name'
        ).annotate(count=Count('id'))

        for item in type_counts:
            by_type[item['notification_type__name']] = {
                'count': item['count'],
                'display_name': item['notification_type__display_name']
            }

        # Recent notifications (last 5)
        recent = queryset[:5]

        data = {
            'total_notifications': total,
            'unread_notifications': unread,
            'read_notifications': read,
            'notifications_today': today,
            'notifications_this_week': this_week,
            'notifications_this_month': this_month,
            'by_type': by_type,
            'recent_notifications': NotificationSerializer(recent, many=True).data
        }

        serializer = NotificationStatsSerializer(data)
        return Response(serializer.data)

    @action(detail=False, methods=['delete'])
    def clear_read(self, request):
        """Delete all read notifications for the user"""
        deleted_count, _ = self.get_queryset().filter(is_read=True).delete()
        return Response({
            'message': f'{deleted_count} read notifications deleted',
            'deleted_count': deleted_count
        })

    @action(detail=False, methods=['delete'])
    def clear_old(self, request):
        """Delete notifications older than 30 days"""
        cutoff_date = timezone.now() - timedelta(days=30)
        deleted_count, _ = self.get_queryset().filter(
            created_at__lt=cutoff_date
        ).delete()
        return Response({
            'message': f'{deleted_count} old notifications deleted',
            'deleted_count': deleted_count
        })


class NotificationBatchViewSet(viewsets.ModelViewSet):
    """ViewSet for notification batches (admin/staff only)"""

    serializer_class = NotificationBatchSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = NotificationPagination

    def get_queryset(self):
        """Return batches - limit based on user permissions"""
        if self.request.user.is_staff:
            return NotificationBatch.objects.all().select_related('notification_type')
        # Regular users can only see batches they created (if we add a created_by field)
        return NotificationBatch.objects.none()

    def get_serializer_class(self):
        """Use different serializers for different actions"""
        if self.action == 'create':
            return NotificationBatchCreateSerializer
        return NotificationBatchSerializer

    @action(detail=True, methods=['get'])
    def recipients(self, request, pk=None):
        """Get recipients for a batch"""
        batch = self.get_object()
        recipients = NotificationBatchRecipient.objects.filter(
            batch=batch
        ).select_related('recipient', 'notification')

        serializer = NotificationBatchRecipientSerializer(recipients, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def send(self, request, pk=None):
        """Trigger sending of a batch (placeholder - implement actual sending logic)"""
        batch = self.get_object()

        if batch.status != 'pending':
            return Response(
                {'error': 'Batch is not in pending status'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # TODO: Implement actual batch sending logic
        # This could be done with Celery tasks for async processing

        batch.status = 'processing'
        batch.started_at = timezone.now()
        batch.save()

        return Response({'message': 'Batch sending initiated'})


# Utility functions for creating notifications
class NotificationService:
    """Service class for notification operations"""

    @staticmethod
    def create_notification(
        recipient,
        notification_type_name,
        title,
        message,
        sender=None,
        related_object=None,
        action_url='',
        metadata=None,
        expires_at=None
    ):
        """
        Create a notification for a user

        Args:
            recipient: User instance
            notification_type_name: String name of notification type
            title: Notification title
            message: Notification message
            sender: User instance (optional)
            related_object: Any model instance (optional)
            action_url: URL for action (optional)
            metadata: Dict of additional data (optional)
            expires_at: DateTime for expiration (optional)

        Returns:
            Notification instance or None if failed
        """
        try:
            notification_type = NotificationType.objects.get(
                name=notification_type_name,
                is_active=True
            )

            # Check user preferences
            user_settings = NotificationUserSettings.objects.filter(
                user=recipient,
                notification_type=notification_type
            ).first()

            # If user has disabled in-app notifications for this type, skip
            if user_settings and not user_settings.in_app_enabled:
                return None

            notification_data = {
                'recipient': recipient,
                'notification_type': notification_type,
                'title': title,
                'message': message,
                'metadata': metadata or {},
                'action_url': action_url,
                'expires_at': expires_at,
            }

            if sender:
                notification_data['sender'] = sender

            if related_object:
                from django.contrib.contenttypes.models import ContentType
                notification_data['content_type'] = ContentType.objects.get_for_model(related_object)
                notification_data['object_id'] = related_object.pk

            notification = Notification.objects.create(**notification_data)

            # TODO: Trigger email/push notifications based on user preferences
            # This could be done with signals or Celery tasks

            return notification

        except NotificationType.DoesNotExist:
            return None

    @staticmethod
    def create_trade_notification(recipient, trade, notification_type_name, sender=None):
        """Create a trade-related notification"""

        type_messages = {
            'trade_request': f"New trade request for your item '{trade.offered_item.name}'",
            'trade_accepted': f"Your trade request for '{trade.requested_item.name}' was accepted!",
            'trade_declined': f"Your trade request for '{trade.requested_item.name}' was declined",
            'trade_completed': f"Trade completed for '{trade.offered_item.name}'",
            'trade_cancelled': f"Trade for '{trade.offered_item.name}' was cancelled",
        }

        title = type_messages.get(notification_type_name, "Trade Update")

        return NotificationService.create_notification(
            recipient=recipient,
            notification_type_name=notification_type_name,
            title=title,
            message=title,  # Could be more detailed
            sender=sender,
            related_object=trade,
            action_url=f"/trades/{trade.id}/",
            metadata={'trade_id': str(trade.id)}
        )


# Chat Views
class ConversationViewSet(viewsets.ModelViewSet):
    """ViewSet for managing conversations"""

    permission_classes = [IsAuthenticated]
    pagination_class = NotificationPagination
    filter_backends = [DjangoFilterBackend]

    def get_queryset(self):
        """Return conversations for the current user"""
        return Conversation.objects.filter(
            participants=self.request.user,
            chatparticipant__is_active=True
        ).distinct().select_related('created_by').prefetch_related(
            'participants',
            'chatparticipant_set__user'
        )

    def get_serializer_class(self):
        """Use different serializers for different actions"""
        if self.action == 'create':
            return ConversationCreateSerializer
        elif self.action == 'list':
            return ConversationListSerializer
        return ConversationSerializer

    @action(detail=True, methods=['get'])
    def messages(self, request, pk=None):
        """Get messages for a conversation"""
        conversation = self.get_object()

        # Check if user is participant
        if not ChatParticipant.objects.filter(
            conversation=conversation,
            user=request.user,
            is_active=True
        ).exists():
            return Response(
                {'error': 'You are not a participant in this conversation'},
                status=status.HTTP_403_FORBIDDEN
            )

        messages = ChatMessage.objects.filter(
            conversation=conversation,
            is_deleted=False
        ).select_related('sender', 'reply_to__sender').order_by('-created_at')

        # Pagination
        paginator = NotificationPagination()
        paginated_messages = paginator.paginate_queryset(messages, request)

        serializer = ChatMessageSerializer(
            paginated_messages,
            many=True,
            context={'request': request}
        )

        return paginator.get_paginated_response(serializer.data)


class ChatMessageViewSet(viewsets.ModelViewSet):
    """ViewSet for managing chat messages"""

    permission_classes = [IsAuthenticated]
    pagination_class = NotificationPagination

    def get_queryset(self):
        """Return messages for conversations user participates in"""
        user_conversations = Conversation.objects.filter(
            participants=self.request.user,
            chatparticipant__is_active=True
        )

        return ChatMessage.objects.filter(
            conversation__in=user_conversations,
            is_deleted=False
        ).select_related('sender', 'conversation', 'reply_to').order_by('-created_at')

    def get_serializer_class(self):
        """Use different serializers for different actions"""
        if self.action == 'create':
            return ChatMessageCreateSerializer
        return ChatMessageSerializer

    def perform_create(self, serializer):
        """Set the sender to the current user"""
        serializer.save(sender=self.request.user)

    def create(self, request, *args, **kwargs):
        """Override create to return full message details"""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)

        # Return the full message details using the read serializer
        message = serializer.instance
        response_serializer = ChatMessageSerializer(
            message,
            context={'request': request}
        )

        headers = self.get_success_headers(serializer.data)
        return Response(
            response_serializer.data,
            status=status.HTTP_201_CREATED,
            headers=headers
        )

    @action(detail=False, methods=['post'])
    def mark_as_read(self, request):
        """Mark messages as read"""
        serializer = MarkAsReadSerializer(
            data=request.data,
            context={'request': request}
        )

        if serializer.is_valid():
            conversation_id = serializer.validated_data['conversation_id']
            message_id = serializer.validated_data.get('message_id')

            try:
                participant = ChatParticipant.objects.get(
                    conversation_id=conversation_id,
                    user=request.user,
                    is_active=True
                )

                if message_id:
                    # Mark as read up to specific message
                    try:
                        message = ChatMessage.objects.get(
                            id=message_id,
                            conversation_id=conversation_id
                        )
                        participant.mark_as_read(message.created_at)
                    except ChatMessage.DoesNotExist:
                        return Response(
                            {'error': 'Message not found'},
                            status=status.HTTP_404_NOT_FOUND
                        )
                else:
                    # Mark all as read
                    participant.mark_as_read()

                return Response({
                    'message': 'Messages marked as read',
                    'unread_count': participant.unread_count
                })

            except ChatParticipant.DoesNotExist:
                return Response(
                    {'error': 'You are not a participant in this conversation'},
                    status=status.HTTP_403_FORBIDDEN
                )

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# Chat Service Functions
class ChatService:
    """Service class for chat operations"""

    @staticmethod
    def create_direct_conversation(user1, user2, related_object=None):
        """Create a direct conversation between two users"""

        # Check if conversation already exists
        existing_conversation = Conversation.objects.filter(
            conversation_type='direct',
            participants=user1
        ).filter(participants=user2).first()

        if existing_conversation:
            return existing_conversation, False

        # Create new conversation
        conversation_data = {
            'conversation_type': 'direct',
            'created_by': user1,
            'is_private': True,
        }

        if related_object:
            from django.contrib.contenttypes.models import ContentType
            conversation_data['content_type'] = ContentType.objects.get_for_model(related_object)
            conversation_data['object_id'] = related_object.pk

        conversation = Conversation.objects.create(**conversation_data)

        # Add participants
        conversation.add_participant(user1, added_by=user1)
        conversation.add_participant(user2, added_by=user1)

        return conversation, True

    @staticmethod
    def create_trade_conversation(trade):
        """Create a conversation for a trade"""
        conversation, created = ChatService.create_direct_conversation(
            trade.trader_offering,
            trade.trader_receiving,
            related_object=trade
        )

        if created:
            conversation.conversation_type = 'trade'
            conversation.title = f"Trade: {trade.item_offered.title}"
            conversation.save()

            # Send initial system message
            ChatMessage.objects.create(
                conversation=conversation,
                sender=trade.trader_offering,  # Could be a system user
                message_type='system',
                content=f"Trade conversation started for '{trade.item_offered.title}'"
            )

        return conversation
