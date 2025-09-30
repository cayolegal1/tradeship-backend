from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import (
    Interest, Item, ShippingDetails, ItemImage, ItemFile, ShippingAddress,
    ShippingPreferences, PaymentShippingSetup, TermsAgreement,
    Trade, TradeRating, Review
)

User = get_user_model()


class InterestSerializer(serializers.ModelSerializer):
    """Serializer for interests/tags"""
    item_count = serializers.ReadOnlyField()

    class Meta:
        model = Interest
        fields = [
            'id', 'name', 'description', 'color', 'is_active',
            'item_count', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_name(self, value):
        """Validate interest name is unique (case-insensitive)"""
        if Interest.objects.filter(name__iexact=value).exists():
            if self.instance and self.instance.name.lower() == value.lower():
                return value
            raise serializers.ValidationError("Interest with this name already exists")
        return value

    def validate_color(self, value):
        """Validate color is a valid hex code"""
        import re
        if not re.match(r'^#[0-9A-Fa-f]{6}$', value):
            raise serializers.ValidationError("Color must be a valid hex code (e.g., #007bff)")
        return value


class ItemImageSerializer(serializers.ModelSerializer):
    """Serializer for item images"""

    class Meta:
        model = ItemImage
        fields = [
            'id', 'image', 'name', 'is_primary',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class ItemFileSerializer(serializers.ModelSerializer):
    """Serializer for item file attachments"""

    file_size_display = serializers.ReadOnlyField()
    file_url = serializers.ReadOnlyField()
    is_image = serializers.ReadOnlyField()
    download_url = serializers.SerializerMethodField()

    class Meta:
        model = ItemFile
        fields = [
            'id', 'file', 'name', 'file_type', 'file_size', 'mime_type',
            'description', 'is_public', 'created_at', 'updated_at',
            # Computed fields
            'file_size_display', 'file_url', 'is_image', 'download_url'
        ]
        read_only_fields = ['id', 'file_size', 'mime_type', 'created_at', 'updated_at']

    def get_download_url(self, obj):
        """Get pre-signed download URL for the file"""
        request = self.context.get('request')
        if request and (obj.is_public or obj.item.owner == request.user):
            return obj.get_download_url()
        return None

    def validate_file(self, value):
        """Validate file size and type"""
        # Maximum file size: 50MB
        max_size = 50 * 1024 * 1024  # 50MB in bytes
        if value.size > max_size:
            raise serializers.ValidationError(
                f"File size ({value.size} bytes) exceeds maximum allowed size (50MB)"
            )

        # Allowed file types (you can customize this)
        allowed_types = [
            # Images
            'image/jpeg', 'image/png', 'image/gif', 'image/webp',
            # Documents
            'application/pdf', 'text/plain',
            'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            # Archives
            'application/zip', 'application/x-rar-compressed',
            # Videos
            'video/mp4', 'video/avi', 'video/quicktime',
            # Audio
            'audio/mpeg', 'audio/wav', 'audio/ogg'
        ]

        import mimetypes
        content_type = mimetypes.guess_type(value.name)[0]

        if content_type not in allowed_types:
            raise serializers.ValidationError(
                f"File type '{content_type}' is not allowed. "
                f"Allowed types: {', '.join(allowed_types)}"
            )

        return value


class ShippingDetailsSerializer(serializers.ModelSerializer):
    """Serializer for shipping details"""
    dimensions_display = serializers.ReadOnlyField()

    class Meta:
        model = ShippingDetails
        fields = [
            'id', 'shipping_weight', 'length', 'width', 'height',
            'dimensions_display', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'dimensions_display']


class ItemSerializer(serializers.ModelSerializer):
    """Serializer for items with nested relationships"""
    shipping_details = ShippingDetailsSerializer(read_only=True)
    images = ItemImageSerializer(many=True, read_only=True)
    files = ItemFileSerializer(many=True, read_only=True)
    interests = InterestSerializer(many=True, read_only=True)
    owner_username = serializers.CharField(source='owner.username', read_only=True)
    location = serializers.CharField(source='owner.profile.country', read_only=True)

    class Meta:
        model = Item
        fields = [
            'id', 'title', 'interests', 'description', 'estimated_value',
            'owner', 'owner_username', 'is_active', 'created_at', 'updated_at',
            'shipping_details', 'images', 'files', 'location'
        ]
        read_only_fields = ['id', 'owner', 'created_at', 'updated_at']

    def create(self, validated_data):
        """Set owner to current user"""
        validated_data['owner'] = self.context['request'].user
        return super().create(validated_data)


class ItemCreateSerializer(serializers.ModelSerializer):
    """Simplified serializer for item creation"""
    interests = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Interest.objects.filter(is_active=True),
        required=False
    )

    class Meta:
        model = Item
        fields = [
            'title', 'interests', 'description', 'estimated_value'
        ]

    def create(self, validated_data):
        """Set owner to current user and handle interests"""
        interests = validated_data.pop('interests', [])
        validated_data['owner'] = self.context['request'].user
        item = super().create(validated_data)
        item.interests.set(interests)
        return item


class ShippingAddressSerializer(serializers.ModelSerializer):
    """Serializer for shipping addresses"""

    class Meta:
        model = ShippingAddress
        fields = [
            'id', 'address_line_1', 'address_line_2', 'city',
            'state', 'zip_code', 'country', 'is_default',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def create(self, validated_data):
        """Set user to current user"""
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)


class ShippingPreferencesSerializer(serializers.ModelSerializer):
    """Serializer for shipping preferences"""
    preferred_carrier_display = serializers.CharField(
        source='get_preferred_carrier_display', read_only=True
    )

    class Meta:
        model = ShippingPreferences
        fields = [
            'id', 'preferred_carrier', 'preferred_carrier_display',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def create(self, validated_data):
        """Set user to current user"""
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)


class PaymentShippingSetupSerializer(serializers.ModelSerializer):
    """Serializer for payment and shipping setup"""
    shipping_method_display = serializers.CharField(
        source='get_shipping_method_display', read_only=True
    )

    class Meta:
        model = PaymentShippingSetup
        fields = [
            'id', 'shipping_method', 'shipping_method_display',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def create(self, validated_data):
        """Set user to current user"""
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)


class TermsAgreementSerializer(serializers.ModelSerializer):
    """Serializer for terms and agreements"""
    is_fully_agreed = serializers.ReadOnlyField()
    user_username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = TermsAgreement
        fields = [
            'id', 'user', 'user_username', 'item_details_accurate',
            'agrees_to_terms', 'agrees_to_escrow', 'understands_fund_release',
            'ip_address', 'user_agent', 'terms_version', 'is_fully_agreed',
            'created_at'
        ]
        read_only_fields = ['id', 'user', 'created_at']

    def create(self, validated_data):
        """Set user to current user and capture request metadata"""
        request = self.context['request']
        validated_data['user'] = request.user

        # Capture IP address
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            validated_data['ip_address'] = x_forwarded_for.split(',')[0]
        else:
            validated_data['ip_address'] = request.META.get('REMOTE_ADDR')

        # Capture user agent
        validated_data['user_agent'] = request.META.get('HTTP_USER_AGENT', '')

        return super().create(validated_data)

    def validate(self, attrs):
        """Validate that all required agreements are true"""
        required_fields = [
            'item_details_accurate', 'agrees_to_terms',
            'agrees_to_escrow', 'understands_fund_release'
        ]

        for field in required_fields:
            if not attrs.get(field, False):
                raise serializers.ValidationError(
                    f"You must agree to {field.replace('_', ' ')} to proceed."
                )

        return attrs


# Nested serializers for detailed views
class ItemDetailSerializer(ItemSerializer):
    """Detailed item serializer with all related data"""
    shipping_details = ShippingDetailsSerializer(read_only=True)
    images = ItemImageSerializer(many=True, read_only=True)

    class Meta(ItemSerializer.Meta):
        pass


class UserProfileSerializer(serializers.Serializer):
    """Serializer for user profile with all trading-related data"""
    items = ItemSerializer(many=True, read_only=True)
    shipping_addresses = ShippingAddressSerializer(many=True, read_only=True)
    shipping_preferences = ShippingPreferencesSerializer(read_only=True)
    payment_shipping_setup = PaymentShippingSetupSerializer(read_only=True)
    terms_agreements = TermsAgreementSerializer(many=True, read_only=True)

    class Meta:
        fields = [
            'items', 'shipping_addresses', 'shipping_preferences',
            'payment_shipping_setup', 'terms_agreements'
        ]


class TradeSerializer(serializers.ModelSerializer):
    """Serializer for trade management"""

    trader_offering_name = serializers.CharField(source='trader_offering.get_full_name', read_only=True)
    trader_receiving_name = serializers.CharField(source='trader_receiving.get_full_name', read_only=True)
    item_offered_title = serializers.CharField(source='item_offered.title', read_only=True)
    item_requested_title = serializers.CharField(source='item_requested.title', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    trade_summary = serializers.JSONField(read_only=True)
    total_value = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    is_active = serializers.BooleanField(read_only=True)

    class Meta:
        model = Trade
        fields = [
            'id', 'trader_offering', 'trader_receiving', 'item_offered', 'item_requested',
            'cash_amount', 'status', 'notes', 'escrow_reference', 'estimated_completion',
            'created_at', 'accepted_at', 'completed_at', 'cancelled_at',
            # Read-only computed fields
            'trader_offering_name', 'trader_receiving_name', 'item_offered_title',
            'item_requested_title', 'status_display', 'trade_summary', 'total_value', 'is_active'
        ]
        read_only_fields = [
            'id', 'trader_offering', 'created_at', 'accepted_at', 'completed_at', 'cancelled_at'
        ]


class TradeCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating new trades"""

    class Meta:
        model = Trade
        fields = [
            'trader_receiving', 'item_offered', 'item_requested',
            'cash_amount', 'notes', 'estimated_completion'
        ]

    def validate_item_offered(self, value):
        """Validate that the offered item belongs to the requesting user"""
        request = self.context.get('request')
        if request and value.owner != request.user:
            raise serializers.ValidationError("You can only offer your own items")
        if not value.is_tradeable:
            raise serializers.ValidationError("This item is not available for trading")
        return value

    def validate_item_requested(self, value):
        """Validate that the requested item is available for trading"""
        if value and not value.is_tradeable:
            raise serializers.ValidationError("The requested item is not available for trading")
        return value

    def validate(self, data):
        """Cross-field validation"""
        trader_receiving = data.get('trader_receiving')
        item_offered = data.get('item_offered')
        item_requested = data.get('item_requested')

        # Ensure user is not trading with themselves
        request = self.context.get('request')
        if request and trader_receiving == request.user:
            raise serializers.ValidationError("You cannot trade with yourself")

        # Ensure requested item belongs to the receiving trader
        if item_requested and item_requested.owner != trader_receiving:
            raise serializers.ValidationError("The requested item must belong to the receiving trader")

        # Validate minimum trade value if set
        if item_offered.minimum_trade_value:
            total_value = (item_requested.estimated_value if item_requested else 0) + (data.get('cash_amount') or 0)
            if total_value < item_offered.minimum_trade_value:
                raise serializers.ValidationError(
                    f"Trade value must be at least ${item_offered.minimum_trade_value}"
                )

        return data


class TradeRatingSerializer(serializers.ModelSerializer):
    """Serializer for trade ratings"""

    rater_name = serializers.CharField(source='rater.get_full_name', read_only=True)
    rated_trader_name = serializers.CharField(source='rated_trader.get_full_name', read_only=True)
    trade_summary = serializers.CharField(source='trade.__str__', read_only=True)
    average_rating = serializers.FloatField(read_only=True)

    class Meta:
        model = TradeRating
        fields = [
            'id', 'trade', 'rater', 'rated_trader',
            'communication_rating', 'item_condition_rating', 'shipping_rating', 'overall_rating',
            'feedback', 'would_trade_again', 'created_at',
            # Read-only computed fields
            'rater_name', 'rated_trader_name', 'trade_summary', 'average_rating'
        ]
        read_only_fields = ['id', 'rater', 'created_at']

    def validate_trade(self, value):
        """Validate that the trade is completed"""
        if value.status != 'completed':
            raise serializers.ValidationError("You can only rate completed trades")
        return value

    def validate_communication_rating(self, value):
        """Validate rating is between 1-5"""
        if not 1 <= value <= 5:
            raise serializers.ValidationError("Rating must be between 1 and 5")
        return value

    def validate_item_condition_rating(self, value):
        """Validate rating is between 1-5"""
        if not 1 <= value <= 5:
            raise serializers.ValidationError("Rating must be between 1 and 5")
        return value

    def validate_shipping_rating(self, value):
        """Validate rating is between 1-5"""
        if not 1 <= value <= 5:
            raise serializers.ValidationError("Rating must be between 1 and 5")
        return value

    def validate_overall_rating(self, value):
        """Validate rating is between 1-5"""
        if not 1 <= value <= 5:
            raise serializers.ValidationError("Rating must be between 1 and 5")
        return value

    def validate(self, data):
        """Cross-field validation"""
        request = self.context.get('request')
        trade = data.get('trade')

        if request and trade:
            # Ensure rater was involved in the trade
            if request.user not in [trade.trader_offering, trade.trader_receiving]:
                raise serializers.ValidationError("You can only rate trades you were involved in")

            # Determine who is being rated
            if request.user == trade.trader_offering:
                data['rated_trader'] = trade.trader_receiving
            else:
                data['rated_trader'] = trade.trader_offering

        return data


class ReviewSerializer(serializers.ModelSerializer):
    """Serializer for trade reviews"""

    reviewer_name = serializers.CharField(source='reviewer.get_full_name', read_only=True)
    reviewed_trader_name = serializers.CharField(source='reviewed_trader.get_full_name', read_only=True)
    trade_summary = serializers.CharField(source='trade.__str__', read_only=True)
    rating_display = serializers.CharField(source='get_rating_display', read_only=True)

    class Meta:
        model = Review
        fields = [
            'id', 'trade', 'reviewer', 'reviewed_trader',
            'rating', 'rating_display', 'description', 'would_trade_again',
            'created_at', 'updated_at',
            # Read-only computed fields
            'reviewer_name', 'reviewed_trader_name', 'trade_summary'
        ]
        read_only_fields = ['id', 'reviewer', 'reviewed_trader', 'created_at', 'updated_at']

    def validate_trade(self, value):
        """Validate that the trade is completed"""
        if value.status != 'completed':
            raise serializers.ValidationError("You can only review completed trades")
        return value

    def validate_rating(self, value):
        """Validate rating is between 1-5"""
        if not 1 <= value <= 5:
            raise serializers.ValidationError("Rating must be between 1 and 5")
        return value

    def validate(self, data):
        """Cross-field validation"""
        request = self.context.get('request')
        trade = data.get('trade')

        if request and trade:
            # Ensure reviewer was involved in the trade
            if request.user not in [trade.trader_offering, trade.trader_receiving]:
                raise serializers.ValidationError("You can only review trades you were involved in")

            # Determine who is being reviewed
            if request.user == trade.trader_offering:
                data['reviewed_trader'] = trade.trader_receiving
            else:
                data['reviewed_trader'] = trade.trader_offering

            # Set reviewer
            data['reviewer'] = request.user

            # Check if review already exists
            if Review.objects.filter(trade=trade, reviewer=request.user).exists():
                raise serializers.ValidationError("You have already reviewed this trade")

        return data

    def create(self, validated_data):
        """Create review and auto-set reviewer and reviewed_trader"""
        return super().create(validated_data)
