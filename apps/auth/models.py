from django.db import models
from django.contrib.auth.models import AbstractUser
from django.core.validators import EmailValidator
import uuid


class User(AbstractUser):
    """Extended user model with UUID primary key and additional fields"""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(
        unique=True,
        validators=[EmailValidator()],
        help_text="Valid email address"
    )
    first_name = models.CharField(max_length=100, help_text="User's first name")
    last_name = models.CharField(max_length=100, help_text="User's last name")

    # Terms agreement - required for account creation
    agrees_to_terms = models.BooleanField(
        default=False,
        help_text="User agrees to platform terms and conditions"
    )
    terms_agreed_at = models.DateTimeField(
        null=True, blank=True,
        help_text="When user agreed to terms"
    )
    terms_version = models.CharField(
        max_length=20, default="1.0",
        help_text="Version of terms agreed to"
    )

    # Profile completion
    profile_completed = models.BooleanField(
        default=False,
        help_text="Whether user has completed their profile setup"
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Make email the username field
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username', 'first_name', 'last_name']

    class Meta:
        indexes = [
            models.Index(fields=['email']),
            models.Index(fields=['agrees_to_terms']),
            models.Index(fields=['profile_completed']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.email})"

    @property
    def full_name(self):
        """Return user's full name"""
        return f"{self.first_name} {self.last_name}".strip()

    def mark_terms_agreed(self):
        """Mark that user has agreed to current terms"""
        from django.utils import timezone
        self.agrees_to_terms = True
        self.terms_agreed_at = timezone.now()
        self.save(update_fields=['agrees_to_terms', 'terms_agreed_at'])

    def complete_profile(self):
        """Mark profile as completed"""
        self.profile_completed = True
        self.save(update_fields=['profile_completed'])


class UserProfile(models.Model):
    """Additional user profile information"""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')

    # Additional profile fields
    phone_number = models.CharField(
        max_length=20, blank=True,
        help_text="User's phone number"
    )
    date_of_birth = models.DateField(
        null=True, blank=True,
        help_text="User's date of birth"
    )
    bio = models.TextField(
        blank=True,
        help_text="User's biography or description"
    )

    # Profile image
    avatar = models.ImageField(
        upload_to='profiles/avatars/',
        null=True, blank=True,
        help_text="User's profile picture"
    )

    # Preferences
    email_notifications = models.BooleanField(
        default=True,
        help_text="Receive email notifications"
    )
    marketing_emails = models.BooleanField(
        default=False,
        help_text="Receive marketing emails"
    )

    # Location (optional)
    city = models.CharField(max_length=100, blank=True, help_text="User's city")
    state = models.CharField(max_length=100, blank=True, help_text="User's state")
    country = models.CharField(max_length=100, default="United States", help_text="User's country")

    # Trader-specific fields
    trader_since = models.DateTimeField(
        auto_now_add=True,
        help_text="When user started trading"
    )
    trading_rating = models.DecimalField(
        max_digits=3, decimal_places=2,
        default=0.00,
        help_text="Average trading rating (0.00-5.00)"
    )
    total_trades = models.PositiveIntegerField(
        default=0,
        help_text="Total number of completed trades"
    )
    successful_trades = models.PositiveIntegerField(
        default=0,
        help_text="Number of successful trades"
    )
    is_verified_trader = models.BooleanField(
        default=False,
        help_text="Whether trader is verified"
    )
    trader_tier = models.CharField(
        max_length=20,
        choices=[
            ('bronze', 'Bronze'),
            ('silver', 'Silver'),
            ('gold', 'Gold'),
            ('platinum', 'Platinum'),
        ],
        default='bronze',
        help_text="Trader tier based on activity and rating"
    )
    specialties = models.CharField(
        max_length=200, blank=True,
        help_text="Trading specialties (comma-separated)"
    )

    # User interests - many-to-many relationship with Interest model
    interests = models.ManyToManyField(
        'apps_trade.Interest',
        related_name='users',
        blank=True,
        help_text="User's interests/tags for matching with relevant items"
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['user']),
            models.Index(fields=['city', 'state']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f"Profile for {self.user.full_name}"

    @property
    def success_rate(self):
        """Calculate trader success rate percentage"""
        if self.total_trades == 0:
            return 0
        return round((self.successful_trades / self.total_trades) * 100, 1)

    @property
    def trader_status(self):
        """Get trader status based on verification and tier"""
        if self.is_verified_trader:
            return f"Verified {self.get_trader_tier_display()} Trader"
        return f"{self.get_trader_tier_display()} Trader"

    def update_trading_stats(self, successful=True):
        """Update trading statistics after a trade"""
        self.total_trades += 1
        if successful:
            self.successful_trades += 1
        self.save(update_fields=['total_trades', 'successful_trades'])

    def calculate_tier(self):
        """Calculate and update trader tier based on activity"""
        if self.total_trades >= 100 and self.trading_rating >= 4.5:
            self.trader_tier = 'platinum'
        elif self.total_trades >= 50 and self.trading_rating >= 4.0:
            self.trader_tier = 'gold'
        elif self.total_trades >= 20 and self.trading_rating >= 3.5:
            self.trader_tier = 'silver'
        else:
            self.trader_tier = 'bronze'
        self.save(update_fields=['trader_tier'])

    def add_interest(self, interest):
        """Add an interest to the user's profile"""
        self.interests.add(interest)

    def remove_interest(self, interest):
        """Remove an interest from the user's profile"""
        self.interests.remove(interest)

    def has_interest(self, interest):
        """Check if user has a specific interest"""
        return self.interests.filter(id=interest.id).exists()

    def get_interests_list(self):
        """Get list of user's interest names"""
        return list(self.interests.values_list('name', flat=True))

    def get_matching_items(self):
        """Get items that match user's interests"""
        from apps.trade.models import Item
        return Item.objects.filter(
            interests__in=self.interests.all(),
            is_active=True,
            is_available_for_trade=True
        ).exclude(owner=self.user).distinct()
