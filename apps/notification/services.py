"""
Notification utilities and services for creating and managing notifications.
"""

from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType
from django.utils import timezone
from django.db import transaction
from typing import Optional, List, Dict, Any
import logging

from .models import (
    NotificationType,
    NotificationUserSettings,
    Notification,
    NotificationBatch,
    NotificationBatchRecipient
)

User = get_user_model()
logger = logging.getLogger(__name__)


class NotificationService:
    """Service class for notification operations"""

    @staticmethod
    def create_notification(
        recipient: User,
        notification_type_name: str,
        title: str,
        message: str,
        sender: Optional[User] = None,
        related_object: Optional[Any] = None,
        action_url: str = '',
        metadata: Optional[Dict] = None,
        expires_at: Optional[timezone.datetime] = None,
        force_create: bool = False
    ) -> Optional[Notification]:
        """
        Create a notification for a user

        Args:
            recipient: User instance to receive the notification
            notification_type_name: String name of notification type
            title: Notification title
            message: Notification message
            sender: User instance who triggered the notification (optional)
            related_object: Any model instance this notification relates to (optional)
            action_url: URL for action when notification is clicked (optional)
            metadata: Dict of additional data (optional)
            expires_at: DateTime when notification expires (optional)
            force_create: Create even if user has disabled this type (optional)

        Returns:
            Notification instance or None if creation failed/skipped
        """
        try:
            # Get notification type
            notification_type = NotificationType.objects.get(
                name=notification_type_name,
                is_active=True
            )

            # Check user preferences unless forced
            if not force_create:
                user_settings = NotificationUserSettings.objects.filter(
                    user=recipient,
                    notification_type=notification_type
                ).first()

                # If user has disabled in-app notifications for this type, skip
                if user_settings and not user_settings.in_app_enabled:
                    logger.info(
                        f"Skipping notification {notification_type_name} for {recipient.email} "
                        f"- user has disabled this type"
                    )
                    return None

                # If no user settings exist, use defaults from notification type
                elif not user_settings and not notification_type.default_in_app_enabled:
                    logger.info(
                        f"Skipping notification {notification_type_name} for {recipient.email} "
                        f"- default is disabled"
                    )
                    return None

            # Prepare notification data
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
                notification_data['content_type'] = ContentType.objects.get_for_model(related_object)
                notification_data['object_id'] = related_object.pk

            # Create notification
            notification = Notification.objects.create(**notification_data)

            logger.info(
                f"Created notification {notification.id} for {recipient.email}: {title}"
            )

            # TODO: Trigger email/push notifications based on user preferences
            # This could be done with Django signals or Celery tasks

            return notification

        except NotificationType.DoesNotExist:
            logger.error(f"Notification type '{notification_type_name}' does not exist")
            return None
        except Exception as e:
            logger.error(f"Failed to create notification: {str(e)}")
            return None

    @staticmethod
    def create_bulk_notifications(
        recipients: List[User],
        notification_type_name: str,
        title: str,
        message: str,
        sender: Optional[User] = None,
        related_object: Optional[Any] = None,
        action_url: str = '',
        metadata: Optional[Dict] = None,
        expires_at: Optional[timezone.datetime] = None
    ) -> List[Notification]:
        """
        Create notifications for multiple users efficiently

        Returns:
            List of created Notification instances
        """
        created_notifications = []

        try:
            notification_type = NotificationType.objects.get(
                name=notification_type_name,
                is_active=True
            )

            # Get user settings for all recipients in one query
            user_settings = NotificationUserSettings.objects.filter(
                user__in=recipients,
                notification_type=notification_type
            ).select_related('user')

            # Create a mapping of user to settings
            settings_map = {setting.user.id: setting for setting in user_settings}

            # Prepare notifications for bulk creation
            notifications_to_create = []

            for recipient in recipients:
                # Check user preferences
                user_setting = settings_map.get(recipient.id)

                if user_setting and not user_setting.in_app_enabled:
                    continue  # Skip if user disabled this type
                elif not user_setting and not notification_type.default_in_app_enabled:
                    continue  # Skip if default is disabled

                # Prepare notification data
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
                    notification_data['content_type'] = ContentType.objects.get_for_model(related_object)
                    notification_data['object_id'] = related_object.pk

                notifications_to_create.append(Notification(**notification_data))

            # Bulk create notifications
            if notifications_to_create:
                created_notifications = Notification.objects.bulk_create(
                    notifications_to_create,
                    batch_size=100
                )

                logger.info(
                    f"Created {len(created_notifications)} bulk notifications "
                    f"of type {notification_type_name}"
                )

        except NotificationType.DoesNotExist:
            logger.error(f"Notification type '{notification_type_name}' does not exist")
        except Exception as e:
            logger.error(f"Failed to create bulk notifications: {str(e)}")

        return created_notifications

    @staticmethod
    def mark_notifications_read(
        user: User,
        notification_ids: Optional[List[str]] = None,
        notification_type: Optional[str] = None
    ) -> int:
        """
        Mark notifications as read for a user

        Args:
            user: User instance
            notification_ids: List of specific notification IDs to mark (optional)
            notification_type: Mark all notifications of this type (optional)

        Returns:
            Number of notifications marked as read
        """
        queryset = Notification.objects.filter(recipient=user, is_read=False)

        if notification_ids:
            queryset = queryset.filter(id__in=notification_ids)

        if notification_type:
            queryset = queryset.filter(notification_type__name=notification_type)

        count = queryset.update(is_read=True, read_at=timezone.now())

        logger.info(f"Marked {count} notifications as read for {user.email}")
        return count

    @staticmethod
    def cleanup_old_notifications(days: int = 30) -> int:
        """
        Delete notifications older than specified days

        Args:
            days: Number of days to keep notifications

        Returns:
            Number of notifications deleted
        """
        cutoff_date = timezone.now() - timezone.timedelta(days=days)
        count, _ = Notification.objects.filter(created_at__lt=cutoff_date).delete()

        logger.info(f"Deleted {count} notifications older than {days} days")
        return count

    @staticmethod
    def cleanup_read_notifications(user: Optional[User] = None) -> int:
        """
        Delete read notifications

        Args:
            user: Specific user to clean up (optional, if None cleans all)

        Returns:
            Number of notifications deleted
        """
        queryset = Notification.objects.filter(is_read=True)

        if user:
            queryset = queryset.filter(recipient=user)

        count, _ = queryset.delete()

        logger.info(f"Deleted {count} read notifications")
        return count


class TradeNotificationService:
    """Service class for trade-specific notifications"""

    TYPE_MESSAGES = {
        'trade_request': "New trade request for your item '{item_name}'",
        'trade_accepted': "Your trade request for '{item_name}' was accepted!",
        'trade_declined': "Your trade request for '{item_name}' was declined",
        'trade_completed': "Trade completed for '{item_name}'",
        'trade_cancelled': "Trade for '{item_name}' was cancelled",
    }

    @staticmethod
    def create_trade_notification(
        recipient: User,
        trade,  # Trade model instance
        notification_type_name: str,
        sender: Optional[User] = None
    ) -> Optional[Notification]:
        """Create a trade-related notification"""

        # Get the appropriate item name based on notification type and recipient
        if recipient == trade.requester:
            item_name = trade.requested_item.name
        else:
            item_name = trade.offered_item.name

        # Get message template and format it
        message_template = TradeNotificationService.TYPE_MESSAGES.get(
            notification_type_name,
            "Trade update"
        )

        title = message_template.format(item_name=item_name)
        message = title  # Could be more detailed

        return NotificationService.create_notification(
            recipient=recipient,
            notification_type_name=notification_type_name,
            title=title,
            message=message,
            sender=sender,
            related_object=trade,
            action_url=f"/trades/{trade.id}/",
            metadata={
                'trade_id': str(trade.id),
                'item_name': item_name,
                'trade_status': trade.status if hasattr(trade, 'status') else None
            }
        )

    @staticmethod
    def notify_trade_request(trade, requester: User, owner: User):
        """Notify item owner of new trade request"""
        return TradeNotificationService.create_trade_notification(
            recipient=owner,
            trade=trade,
            notification_type_name='trade_request',
            sender=requester
        )

    @staticmethod
    def notify_trade_accepted(trade, owner: User, requester: User):
        """Notify requester that trade was accepted"""
        return TradeNotificationService.create_trade_notification(
            recipient=requester,
            trade=trade,
            notification_type_name='trade_accepted',
            sender=owner
        )

    @staticmethod
    def notify_trade_declined(trade, owner: User, requester: User):
        """Notify requester that trade was declined"""
        return TradeNotificationService.create_trade_notification(
            recipient=requester,
            trade=trade,
            notification_type_name='trade_declined',
            sender=owner
        )

    @staticmethod
    def notify_trade_completed(trade):
        """Notify both parties that trade is completed"""
        notifications = []

        # Notify requester
        notification = TradeNotificationService.create_trade_notification(
            recipient=trade.requester,
            trade=trade,
            notification_type_name='trade_completed'
        )
        if notification:
            notifications.append(notification)

        # Notify owner
        notification = TradeNotificationService.create_trade_notification(
            recipient=trade.requested_item.owner,
            trade=trade,
            notification_type_name='trade_completed'
        )
        if notification:
            notifications.append(notification)

        return notifications


class NotificationBatchService:
    """Service class for batch notification operations"""

    @staticmethod
    def create_batch(
        name: str,
        notification_type_name: str,
        title_template: str,
        message_template: str,
        recipient_emails: List[str],
        scheduled_for: Optional[timezone.datetime] = None
    ) -> Optional[NotificationBatch]:
        """
        Create a notification batch

        Args:
            name: Descriptive name for the batch
            notification_type_name: Type of notification
            title_template: Template for notification titles
            message_template: Template for notification messages
            recipient_emails: List of recipient email addresses
            scheduled_for: When to send (None for immediate)

        Returns:
            NotificationBatch instance or None if failed
        """
        try:
            with transaction.atomic():
                # Get notification type
                notification_type = NotificationType.objects.get(
                    name=notification_type_name,
                    is_active=True
                )

                # Get users by email
                users = User.objects.filter(email__in=recipient_emails)
                if not users.exists():
                    logger.error("No valid users found for batch notification")
                    return None

                # Create batch
                batch = NotificationBatch.objects.create(
                    name=name,
                    notification_type=notification_type,
                    title_template=title_template,
                    message_template=message_template,
                    scheduled_for=scheduled_for,
                    total_recipients=users.count()
                )

                # Create batch recipients
                batch_recipients = []
                for user in users:
                    batch_recipients.append(
                        NotificationBatchRecipient(
                            batch=batch,
                            recipient=user
                        )
                    )

                NotificationBatchRecipient.objects.bulk_create(batch_recipients)

                logger.info(f"Created notification batch '{name}' with {users.count()} recipients")
                return batch

        except NotificationType.DoesNotExist:
            logger.error(f"Notification type '{notification_type_name}' does not exist")
            return None
        except Exception as e:
            logger.error(f"Failed to create notification batch: {str(e)}")
            return None

    @staticmethod
    def send_batch(batch_id: str) -> bool:
        """
        Send a notification batch (placeholder for actual implementation)

        Args:
            batch_id: UUID of the batch to send

        Returns:
            True if successful, False otherwise
        """
        try:
            batch = NotificationBatch.objects.get(id=batch_id)

            if batch.status != 'pending':
                logger.error(f"Batch {batch_id} is not in pending status")
                return False

            # Update batch status
            batch.status = 'processing'
            batch.started_at = timezone.now()
            batch.save()

            # TODO: Implement actual batch sending logic
            # This should be done asynchronously with Celery

            logger.info(f"Started sending batch {batch_id}")
            return True

        except NotificationBatch.DoesNotExist:
            logger.error(f"Notification batch {batch_id} does not exist")
            return False
        except Exception as e:
            logger.error(f"Failed to send batch {batch_id}: {str(e)}")
            return False


def initialize_notification_types():
    """
    Initialize default notification types
    This should be called during deployment or in a management command
    """
    default_types = [
        {
            'name': 'trade_request',
            'display_name': 'Trade Request',
            'description': 'When someone requests to trade for your item',
            'priority': 'high',
            'requires_action': True,
        },
        {
            'name': 'trade_accepted',
            'display_name': 'Trade Accepted',
            'description': 'When your trade request is accepted',
            'priority': 'high',
            'requires_action': True,
        },
        {
            'name': 'trade_declined',
            'display_name': 'Trade Declined',
            'description': 'When your trade request is declined',
            'priority': 'normal',
            'requires_action': False,
        },
        {
            'name': 'trade_completed',
            'display_name': 'Trade Completed',
            'description': 'When a trade is successfully completed',
            'priority': 'normal',
            'requires_action': False,
        },
        {
            'name': 'trade_cancelled',
            'display_name': 'Trade Cancelled',
            'description': 'When a trade is cancelled',
            'priority': 'normal',
            'requires_action': False,
        },
        {
            'name': 'message_received',
            'display_name': 'Message Received',
            'description': 'When you receive a new message',
            'priority': 'normal',
            'requires_action': True,
        },
        {
            'name': 'item_liked',
            'display_name': 'Item Liked',
            'description': 'When someone likes your item',
            'priority': 'low',
            'requires_action': False,
        },
        {
            'name': 'system_announcement',
            'display_name': 'System Announcement',
            'description': 'Important system announcements',
            'priority': 'high',
            'requires_action': False,
            'default_email_enabled': True,
            'default_push_enabled': True,
        },
        {
            'name': 'account_security',
            'display_name': 'Account Security',
            'description': 'Security-related notifications',
            'priority': 'urgent',
            'requires_action': True,
            'default_email_enabled': True,
            'default_push_enabled': True,
        },
    ]

    created_count = 0
    for type_data in default_types:
        notification_type, created = NotificationType.objects.get_or_create(
            name=type_data['name'],
            defaults=type_data
        )
        if created:
            created_count += 1
            logger.info(f"Created notification type: {notification_type.display_name}")

    logger.info(f"Initialized {created_count} new notification types")
    return created_count
