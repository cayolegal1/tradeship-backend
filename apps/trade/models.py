from django.db import models
from django.contrib.auth import get_user_model
from django.core.validators import MinValueValidator
import uuid

User = get_user_model()


class Interest(models.Model):
    """Model representing interests/tags that can be applied to items"""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(
        max_length=50,
        unique=True,
        help_text="Interest/tag name"
    )
    description = models.TextField(
        blank=True,
        help_text="Optional description of the interest/tag"
    )
    color = models.CharField(
        max_length=7,
        default="#007bff",
        help_text="Hex color code for UI display"
    )
    is_active = models.BooleanField(
        default=True,
        help_text="Whether this interest/tag is active"
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        indexes = [
            models.Index(fields=['name']),
            models.Index(fields=['is_active']),
        ]

    def __str__(self):
        return self.name

    @property
    def item_count(self):
        """Get count of items with this interest/tag"""
        return self.items.filter(is_active=True).count()


def upload_item_image_path(instance, filename):
    """Generate upload path for item images"""
    return f'items/{instance.item.id}/images/{filename}'


def upload_item_file_path(instance, filename):
    """Generate upload path for item files"""
    from uuid import uuid4

    # Get file extension
    ext = filename.split('.')[-1]
    # Generate unique filename
    unique_filename = f'{uuid4()}.{ext}'
    return f'items/{instance.item.id}/files/{unique_filename}'


class Item(models.Model):
    """Model representing a tradeable item"""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=200, help_text="Item title")
    interests = models.ManyToManyField(
        Interest,
        related_name='items',
        blank=True,
        help_text="Item interests/tags"
    )
    description = models.TextField(help_text="Detailed item description")
    estimated_value = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0.01)],
        help_text="Estimated value in USD"
    )

    # Ownership and basic info
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='items')

    # Trading status and preferences
    is_available_for_trade = models.BooleanField(
        default=True,
        help_text="Whether item is available for trading"
    )
    trade_preferences = models.CharField(
        max_length=200, blank=True,
        help_text="What owner is looking to trade for"
    )
    minimum_trade_value = models.DecimalField(
        max_digits=10, decimal_places=2,
        null=True, blank=True,
        validators=[MinValueValidator(0.01)],
        help_text="Minimum acceptable trade value"
    )
    accepts_cash_offers = models.BooleanField(
        default=True,
        help_text="Whether owner accepts cash offers"
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['owner']),
        ]

    def __str__(self):
        return f"{self.title} (${self.estimated_value})"

    @property
    def owner_trader_info(self):
        """Get owner's trader information"""
        try:
            profile = self.owner.profile
            return {
                'trader_tier': profile.get_trader_tier_display(),
                'trading_rating': profile.trading_rating,
                'total_trades': profile.total_trades,
                'is_verified': profile.is_verified_trader
            }
        except (AttributeError, Exception):
            return None

    @property
    def is_tradeable(self):
        """Check if item is available and tradeable"""
        return self.is_active and self.is_available_for_trade

    def get_trade_compatibility(self, other_item):
        """Check compatibility for trading with another item"""
        if not self.is_tradeable or not other_item.is_tradeable:
            return False

        # Check if values are compatible based on minimum trade value
        if self.minimum_trade_value and other_item.estimated_value < self.minimum_trade_value:
            return False

        if other_item.minimum_trade_value and self.estimated_value < other_item.minimum_trade_value:
            return False

        return True


class ItemImage(models.Model):
    """Model for item images"""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name='images')

    # Image details
    image = models.ImageField(
        upload_to=upload_item_image_path,
        help_text="Item image file"
    )
    name = models.CharField(max_length=200, help_text="Image name/description")
    is_primary = models.BooleanField(default=False, help_text="Is this the primary image?")

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-is_primary', 'created_at']
        indexes = [
            models.Index(fields=['item']),
            models.Index(fields=['is_primary']),
        ]

    def __str__(self):
        return f"{self.name} - {self.item.title}"

    def save(self, *args, **kwargs):
        # Ensure only one primary image per item
        if self.is_primary:
            ItemImage.objects.filter(item=self.item, is_primary=True).update(is_primary=False)
        super().save(*args, **kwargs)


class ItemFile(models.Model):
    """Model for item file attachments (documents, certificates, manuals, etc.)"""

    FILE_TYPE_CHOICES = [
        ('image', 'Image'),
        ('document', 'Document'),
        ('certificate', 'Certificate'),
        ('manual', 'Manual'),
        ('receipt', 'Receipt'),
        ('warranty', 'Warranty'),
        ('video', 'Video'),
        ('audio', 'Audio'),
        ('other', 'Other'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name='files')

    # File details
    file = models.FileField(
        upload_to=upload_item_file_path,
        help_text="Item file attachment"
    )
    name = models.CharField(max_length=200, help_text="File name/description")
    file_type = models.CharField(
        max_length=20,
        choices=FILE_TYPE_CHOICES,
        default='other',
        help_text="Type of file"
    )
    file_size = models.PositiveIntegerField(
        null=True, blank=True,
        help_text="File size in bytes"
    )
    mime_type = models.CharField(
        max_length=100, blank=True,
        help_text="MIME type of the file"
    )

    # Metadata
    description = models.TextField(
        blank=True,
        help_text="Optional description of the file content"
    )
    is_public = models.BooleanField(
        default=False,
        help_text="Whether this file can be viewed by other users"
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['item']),
            models.Index(fields=['file_type']),
            models.Index(fields=['is_public']),
        ]

    def __str__(self):
        return f"{self.name} - {self.item.title}"

    def save(self, *args, **kwargs):
        # Automatically set file size and mime type if not provided
        if self.file and not self.file_size:
            try:
                self.file_size = self.file.size
            except (AttributeError, OSError):
                pass

        if self.file and not self.mime_type:
            import mimetypes
            self.mime_type = mimetypes.guess_type(self.file.name)[0] or 'application/octet-stream'

        super().save(*args, **kwargs)

    @property
    def file_size_display(self):
        """Return human readable file size"""
        if not self.file_size:
            return "Unknown size"

        for unit in ['B', 'KB', 'MB', 'GB']:
            if self.file_size < 1024.0:
                return f"{self.file_size:.1f} {unit}"
            self.file_size /= 1024.0
        return f"{self.file_size:.1f} TB"

    @property
    def is_image(self):
        """Check if file is an image"""
        return self.file_type == 'image' or (
            self.mime_type and self.mime_type.startswith('image/')
        )

    @property
    def file_url(self):
        """Get the URL for the file"""
        if self.file:
            return self.file.url
        return None

    def get_download_url(self, expires_in=3600):
        """
        Get a pre-signed URL for downloading the file (useful for S3)
        expires_in: URL expiration time in seconds (default: 1 hour)
        """
        if not self.file:
            return None

        try:
            # Check if we're using S3
            from django.conf import settings
            if hasattr(settings, 'AWS_STORAGE_BUCKET_NAME') and settings.AWS_STORAGE_BUCKET_NAME:
                import boto3
                from botocore.exceptions import ClientError

                # Create S3 client
                s3_client = boto3.client(
                    's3',
                    aws_access_key_id=getattr(settings, 'AWS_ACCESS_KEY_ID', None),
                    aws_secret_access_key=getattr(settings, 'AWS_SECRET_ACCESS_KEY', None),
                    region_name=getattr(settings, 'AWS_S3_REGION_NAME', 'us-east-1')
                )

                try:
                    # Generate pre-signed URL
                    url = s3_client.generate_presigned_url(
                        'get_object',
                        Params={
                            'Bucket': settings.AWS_STORAGE_BUCKET_NAME,
                            'Key': self.file.name
                        },
                        ExpiresIn=expires_in
                    )
                    return url
                except ClientError:
                    # Fall back to regular URL if pre-signed URL generation fails
                    return self.file.url
            else:
                # For local storage, return regular URL
                return self.file.url
        except Exception:
            # Fallback to regular URL
            return self.file.url if self.file else None


class ShippingDetails(models.Model):
    """Model for item shipping specifications"""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    item = models.OneToOneField(Item, on_delete=models.CASCADE, related_name='shipping_details')

    # Weight and dimensions
    shipping_weight = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        validators=[MinValueValidator(0.01)],
        help_text="Weight in pounds"
    )
    length = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        validators=[MinValueValidator(0.1)],
        help_text="Length in inches"
    )
    width = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        validators=[MinValueValidator(0.1)],
        help_text="Width in inches"
    )
    height = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        validators=[MinValueValidator(0.1)],
        help_text="Height in inches"
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Shipping Detail"
        verbose_name_plural = "Shipping Details"
        indexes = [
            models.Index(fields=['item']),
        ]

    def __str__(self):
        return f"Shipping for {self.item.title}"

    @property
    def dimensions_display(self):
        return f"{self.length} x {self.width} x {self.height} inches"

    @property
    def volume_cubic_inches(self):
        """Calculate volume in cubic inches"""
        return float(self.length * self.width * self.height)

    @property
    def shipping_cost_estimate(self):
        """Estimate shipping cost based on weight and volume"""
        # Simple estimation: $0.50 per pound + $0.10 per cubic inch
        weight_cost = float(self.shipping_weight) * 0.50
        volume_cost = self.volume_cubic_inches * 0.10
        return round(weight_cost + volume_cost, 2)


class ShippingAddress(models.Model):
    """Model for user shipping addresses"""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='shipping_addresses')

    # Address fields
    address_line_1 = models.CharField(max_length=255, help_text="Primary address line")
    address_line_2 = models.CharField(max_length=255, blank=True, help_text="Secondary address line")
    city = models.CharField(max_length=100, help_text="City")
    state = models.CharField(max_length=100, help_text="State/Province")
    zip_code = models.CharField(max_length=20, help_text="ZIP/Postal code")
    country = models.CharField(max_length=100, default="United States", help_text="Country")

    # Meta fields
    is_default = models.BooleanField(default=False, help_text="Is this the default address?")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Shipping Address"
        verbose_name_plural = "Shipping Addresses"
        indexes = [
            models.Index(fields=['user']),
            models.Index(fields=['is_default']),
        ]

    def __str__(self):
        return f"{self.address_line_1}, {self.city}, {self.state}"

    @property
    def full_address(self):
        """Return formatted full address"""
        address_parts = [self.address_line_1]
        if self.address_line_2:
            address_parts.append(self.address_line_2)
        address_parts.extend([
            f"{self.city}, {self.state} {self.zip_code}",
            self.country
        ])
        return "\n".join(address_parts)

    def save(self, *args, **kwargs):
        # Ensure only one default address per user
        if self.is_default:
            ShippingAddress.objects.filter(user=self.user, is_default=True).update(is_default=False)
        super().save(*args, **kwargs)


class ShippingPreferences(models.Model):
    """Model for user shipping preferences"""

    CARRIER_CHOICES = [
        ('usps', 'USPS'),
        ('ups', 'UPS'),
        ('fedex', 'FedEx'),
        ('dhl', 'DHL'),
        ('other', 'Other'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='shipping_preferences')

    preferred_carrier = models.CharField(
        max_length=20,
        choices=CARRIER_CHOICES,
        default='usps',
        help_text="Preferred shipping carrier"
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Shipping Preference"
        verbose_name_plural = "Shipping Preferences"
        indexes = [
            models.Index(fields=['user']),
        ]

    def __str__(self):
        return f"{self.user.get_full_name()} - {self.get_preferred_carrier_display()}"


class PaymentShippingSetup(models.Model):
    """Model for payment and shipping configuration"""

    SHIPPING_METHOD_CHOICES = [
        ('standard', 'Standard Shipping'),
        ('expedited', 'Expedited Shipping'),
        ('overnight', 'Overnight Shipping'),
        ('pickup', 'Local Pickup'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='payment_shipping_setup')

    shipping_method = models.CharField(
        max_length=20,
        choices=SHIPPING_METHOD_CHOICES,
        default='standard',
        help_text="Preferred shipping method"
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Payment & Shipping Setup"
        verbose_name_plural = "Payment & Shipping Setups"
        indexes = [
            models.Index(fields=['user']),
        ]

    def __str__(self):
        return f"{self.user.get_full_name()} - {self.get_shipping_method_display()}"


class TermsAgreement(models.Model):
    """Model for tracking terms and conditions acceptance"""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='terms_agreements')

    # Agreement confirmations
    item_details_accurate = models.BooleanField(
        default=False,
        help_text="User confirms item details are accurate"
    )
    agrees_to_terms = models.BooleanField(
        default=False,
        help_text="User agrees to TradeShip Terms of Use"
    )
    agrees_to_escrow = models.BooleanField(
        default=False,
        help_text="User agrees to use escrow via Trustap"
    )
    understands_fund_release = models.BooleanField(
        default=False,
        help_text="User understands fund release terms"
    )

    # Metadata
    ip_address = models.GenericIPAddressField(null=True, blank=True, help_text="IP address of agreement")
    user_agent = models.TextField(blank=True, help_text="User agent string")
    terms_version = models.CharField(max_length=20, default="1.0", help_text="Version of terms agreed to")

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Terms Agreement"
        verbose_name_plural = "Terms Agreements"
        indexes = [
            models.Index(fields=['user']),
            models.Index(fields=['created_at']),
            models.Index(fields=['terms_version']),
        ]

    def __str__(self):
        return f"{self.user.get_full_name()} - Terms v{self.terms_version} - {self.created_at.date()}"

    @property
    def is_fully_agreed(self):
        """Check if user has agreed to all terms"""
        return all([
            self.item_details_accurate,
            self.agrees_to_terms,
            self.agrees_to_escrow,
            self.understands_fund_release
        ])


class Trade(models.Model):
    """Model representing a trade transaction between two users"""

    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('accepted', 'Accepted'),
        ('in_progress', 'In Progress'),
        ('in_escrow', 'In Escrow'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
        ('disputed', 'Disputed'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Trader relationships
    trader_offering = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='trades_offering',
        help_text="User offering their item for trade"
    )
    trader_receiving = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='trades_receiving',
        help_text="User receiving the offered item"
    )

    # Items being traded
    item_offered = models.ForeignKey(
        Item,
        on_delete=models.CASCADE,
        related_name='trades_as_offered',
        help_text="Item being offered in trade"
    )
    item_requested = models.ForeignKey(
        Item,
        on_delete=models.CASCADE,
        related_name='trades_as_requested',
        null=True, blank=True,
        help_text="Item being requested in trade (optional for cash trades)"
    )

    # Trade details
    cash_amount = models.DecimalField(
        max_digits=10, decimal_places=2,
        null=True, blank=True,
        validators=[MinValueValidator(0)],
        help_text="Additional cash amount in trade"
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending',
        help_text="Current trade status"
    )
    notes = models.TextField(
        blank=True,
        help_text="Trade notes or special instructions"
    )

    # Escrow and tracking
    escrow_reference = models.CharField(
        max_length=100, blank=True,
        help_text="External escrow service reference"
    )
    estimated_completion = models.DateTimeField(
        null=True, blank=True,
        help_text="Estimated completion date"
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    accepted_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['trader_offering']),
            models.Index(fields=['trader_receiving']),
            models.Index(fields=['status']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        cash_part = f" + ${self.cash_amount}" if self.cash_amount else ""
        requested_part = f" for {self.item_requested.title}" if self.item_requested else " for cash"
        return f"{self.trader_offering.get_full_name()}: {self.item_offered.title}{cash_part}{requested_part}"

    @property
    def is_active(self):
        """Check if trade is in an active state"""
        return self.status in ['pending', 'accepted', 'in_progress', 'in_escrow']

    @property
    def total_value(self):
        """Calculate total trade value"""
        offered_value = self.item_offered.estimated_value
        cash_value = self.cash_amount or 0
        return offered_value + cash_value

    @property
    def trade_summary(self):
        """Get a summary of the trade"""
        summary = {
            'offering_trader': self.trader_offering.get_full_name(),
            'receiving_trader': self.trader_receiving.get_full_name(),
            'offered_item': self.item_offered.title,
            'offered_value': self.item_offered.estimated_value,
            'requested_item': self.item_requested.title if self.item_requested else 'Cash',
            'cash_amount': self.cash_amount,
            'total_value': self.total_value,
            'status': self.get_status_display()
        }
        return summary


class Review(models.Model):
    """Model for reviews of completed trades"""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    trade = models.ForeignKey(
        Trade,
        on_delete=models.CASCADE,
        related_name='reviews',
        help_text="The trade being reviewed"
    )

    # Review participants
    reviewer = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='reviews_given',
        help_text="User giving the review"
    )
    reviewed_trader = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='reviews_received',
        help_text="User being reviewed"
    )

    # Review content
    rating = models.PositiveSmallIntegerField(
        choices=[(i, f"{i} Star{'s' if i != 1 else ''}") for i in range(1, 6)],
        help_text="Rating from 1-5 stars"
    )
    description = models.TextField(
        help_text="Description of the trade experience"
    )
    would_trade_again = models.BooleanField(
        default=True,
        help_text="Would trade with this person again"
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [('trade', 'reviewer')]  # One review per reviewer per trade
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['trade']),
            models.Index(fields=['reviewer']),
            models.Index(fields=['reviewed_trader']),
            models.Index(fields=['rating']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f"{self.reviewer.get_full_name()} reviews {self.reviewed_trader.get_full_name()}: {self.rating}/5"

    def clean(self):
        """Validate that review is for completed trade and reviewer is participant"""
        from django.core.exceptions import ValidationError

        if self.trade.status != 'completed':
            raise ValidationError("Can only review completed trades")

        if self.reviewer not in [self.trade.trader_offering, self.trade.trader_receiving]:
            raise ValidationError("Only trade participants can leave reviews")

        if self.reviewed_trader not in [self.trade.trader_offering, self.trade.trader_receiving]:
            raise ValidationError("Can only review trade participants")

        if self.reviewer == self.reviewed_trader:
            raise ValidationError("Cannot review yourself")

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def accept_trade(self, accepting_user):
        """Accept the trade if user is the receiving trader"""
        if accepting_user != self.trader_receiving:
            raise ValueError("Only the receiving trader can accept this trade")

        from django.utils import timezone
        self.status = 'accepted'
        self.accepted_at = timezone.now()
        self.save(update_fields=['status', 'accepted_at'])

    def complete_trade(self):
        """Mark trade as completed and update trader stats"""
        from django.utils import timezone
        self.status = 'completed'
        self.completed_at = timezone.now()
        self.save(update_fields=['status', 'completed_at'])

        # Update trader statistics
        try:
            offering_profile = self.trader_offering.profile
            receiving_profile = self.trader_receiving.profile

            offering_profile.update_trading_stats(successful=True)
            receiving_profile.update_trading_stats(successful=True)
        except (AttributeError, Exception):
            # Handle case where profiles don't exist yet
            pass

    def cancel_trade(self, cancelling_user, reason=""):
        """Cancel the trade"""
        if cancelling_user not in [self.trader_offering, self.trader_receiving]:
            raise ValueError("Only traders involved in this trade can cancel it")

        from django.utils import timezone
        self.status = 'cancelled'
        self.cancelled_at = timezone.now()
        if reason:
            self.notes = f"Cancelled: {reason}\n{self.notes}"
        self.save(update_fields=['status', 'cancelled_at', 'notes'])

    @property
    def can_be_reviewed(self):
        """Check if trade can be reviewed"""
        return self.status == 'completed'

    @property
    def review_status(self):
        """Get review status for this trade"""
        if not self.can_be_reviewed:
            return {'can_review': False, 'reason': 'Trade not completed'}

        reviews = self.reviews.all()
        offering_reviewed = reviews.filter(reviewer=self.trader_offering).exists()
        receiving_reviewed = reviews.filter(reviewer=self.trader_receiving).exists()

        return {
            'can_review': True,
            'offering_trader_reviewed': offering_reviewed,
            'receiving_trader_reviewed': receiving_reviewed,
            'both_reviewed': offering_reviewed and receiving_reviewed
        }


class TradeRating(models.Model):
    """Model for rating traders after completed trades"""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    trade = models.ForeignKey(Trade, on_delete=models.CASCADE, related_name='ratings')

    # Rating participants
    rater = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='ratings_given',
        help_text="User giving the rating"
    )
    rated_trader = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='ratings_received',
        help_text="User being rated"
    )

    # Rating scores (1-5 scale)
    communication_rating = models.PositiveSmallIntegerField(
        help_text="Communication rating (1-5)"
    )
    item_condition_rating = models.PositiveSmallIntegerField(
        help_text="Item condition rating (1-5)"
    )
    shipping_rating = models.PositiveSmallIntegerField(
        help_text="Shipping/delivery rating (1-5)"
    )
    overall_rating = models.PositiveSmallIntegerField(
        help_text="Overall experience rating (1-5)"
    )

    # Optional feedback
    feedback = models.TextField(
        blank=True,
        help_text="Written feedback about the trade"
    )
    would_trade_again = models.BooleanField(
        default=True,
        help_text="Would trade with this person again"
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [('trade', 'rater')]  # One rating per trader per trade
        indexes = [
            models.Index(fields=['rated_trader']),
            models.Index(fields=['overall_rating']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f"{self.rater.get_full_name()} rates {self.rated_trader.get_full_name()}: {self.overall_rating}/5"

    @property
    def average_rating(self):
        """Calculate average of all rating categories"""
        ratings = [
            self.communication_rating,
            self.item_condition_rating,
            self.shipping_rating,
            self.overall_rating
        ]
        return round(sum(ratings) / len(ratings), 1)

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        # Update rated trader's average rating
        self.update_trader_rating()

    def update_trader_rating(self):
        """Update the rated trader's overall rating"""
        ratings = TradeRating.objects.filter(rated_trader=self.rated_trader)
        if ratings.exists():
            avg_rating = ratings.aggregate(
                avg=models.Avg('overall_rating')
            )['avg']

            try:
                profile = self.rated_trader.profile
                profile.trading_rating = round(avg_rating, 2)
                profile.save(update_fields=['trading_rating'])
                profile.calculate_tier()  # Recalculate tier based on new rating
            except (AttributeError, Exception):
                # Handle case where profile doesn't exist yet
                pass
