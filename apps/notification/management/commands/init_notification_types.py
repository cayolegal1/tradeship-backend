from django.core.management.base import BaseCommand
from apps.notification.services import initialize_notification_types


class Command(BaseCommand):
    """
    Management command to initialize default notification types.

    Usage:
        python manage.py init_notification_types
    """

    help = 'Initialize default notification types'

    def handle(self, *args, **options):
        """Execute the command"""
        self.stdout.write('Initializing notification types...')

        try:
            created_count = initialize_notification_types()

            if created_count > 0:
                self.stdout.write(
                    self.style.SUCCESS(
                        f'Successfully created {created_count} notification types'
                    )
                )
            else:
                self.stdout.write(
                    self.style.WARNING('All notification types already exist')
                )

        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'Error initializing notification types: {str(e)}')
            )
