from rest_framework import serializers
from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from .models import User, UserProfile


class InterestSerializer(serializers.ModelSerializer):
    """Basic Interest serializer for auth app"""

    class Meta:
        from apps.trade.models import Interest
        model = Interest
        fields = ['id', 'name', 'description', 'color', 'is_active']
        read_only_fields = ['id', 'is_active']


class UserRegistrationSerializer(serializers.ModelSerializer):
    """Serializer for user registration"""
    password = serializers.CharField(
        write_only=True,
        style={'input_type': 'password'},
        help_text="Password must meet security requirements"
    )
    password_confirm = serializers.CharField(
        write_only=True,
        style={'input_type': 'password'},
        help_text="Confirm your password"
    )
    agrees_to_terms = serializers.BooleanField(
        required=True,
        help_text="Must agree to terms and conditions"
    )

    class Meta:
        model = User
        fields = [
            'first_name', 'last_name', 'email', 'username',
            'password', 'password_confirm', 'agrees_to_terms'
        ]
        extra_kwargs = {
            'first_name': {'required': True},
            'last_name': {'required': True},
            'email': {'required': True},
            'username': {'required': True},
        }

    def validate_email(self, value):
        """Validate email uniqueness"""
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value

    def validate_username(self, value):
        """Validate username uniqueness"""
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("A user with this username already exists.")
        return value

    def validate_agrees_to_terms(self, value):
        """Validate terms agreement"""
        if not value:
            raise serializers.ValidationError("You must agree to the terms and conditions.")
        return value

    def validate(self, attrs):
        """Validate password confirmation and requirements"""
        password = attrs.get('password')
        password_confirm = attrs.get('password_confirm')

        if password != password_confirm:
            raise serializers.ValidationError({
                'password_confirm': "Passwords do not match."
            })

        # Validate password strength
        try:
            validate_password(password)
        except ValidationError as e:
            raise serializers.ValidationError({
                'password': list(e.messages)
            })

        return attrs

    def create(self, validated_data):
        """Create new user with terms agreement"""
        # Remove password_confirm from validated_data
        validated_data.pop('password_confirm', None)

        # Create user
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password'],
            first_name=validated_data['first_name'],
            last_name=validated_data['last_name'],
            agrees_to_terms=validated_data['agrees_to_terms']
        )

        # Mark terms as agreed if true
        if validated_data['agrees_to_terms']:
            user.mark_terms_agreed()

        # Create associated profile
        UserProfile.objects.create(user=user)

        return user


class UserLoginSerializer(serializers.Serializer):
    """Serializer for user login"""
    email = serializers.EmailField(required=True)
    password = serializers.CharField(
        write_only=True,
        style={'input_type': 'password'}
    )

    def validate(self, attrs):
        """Validate login credentials"""
        email = attrs.get('email')
        password = attrs.get('password')

        if email and password:
            # Authenticate using email
            try:
                user = User.objects.get(email=email)
                user = authenticate(
                    request=self.context.get('request'),
                    username=user.username,  # Django authenticate expects username
                    password=password
                )
            except User.DoesNotExist:
                user = None

            if not user:
                raise serializers.ValidationError(
                    "Invalid email or password."
                )

            if not user.is_active:
                raise serializers.ValidationError(
                    "User account is disabled."
                )

            attrs['user'] = user
            return attrs

        raise serializers.ValidationError(
            "Must include email and password."
        )


class UserProfileSerializer(serializers.ModelSerializer):
    """Serializer for user profile management"""
    interests = InterestSerializer(many=True, read_only=True)
    interests_ids = serializers.ListField(
        child=serializers.UUIDField(),
        write_only=True,
        required=False,
        help_text="List of interest IDs to associate with the user"
    )

    class Meta:
        model = UserProfile
        fields = [
            'id', 'phone_number', 'date_of_birth', 'bio', 'avatar',
            'email_notifications', 'marketing_emails', 'city', 'state', 'country',
            'interests', 'interests_ids', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def update(self, instance, validated_data):
        """Update profile and handle interests separately"""
        interests_ids = validated_data.pop('interests_ids', None)

        # Update other fields
        instance = super().update(instance, validated_data)

        # Update interests if provided
        if interests_ids is not None:
            from apps.trade.models import Interest
            interests = Interest.objects.filter(id__in=interests_ids, is_active=True)
            instance.interests.set(interests)

        return instance


class TraderSerializer(serializers.ModelSerializer):
    """Serializer for trader (user) information"""
    full_name = serializers.ReadOnlyField()
    interests = InterestSerializer(many=True, read_only=True, source='profile.interests')
    reviews_received = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'full_name', 'interests', 'reviews_received']
        read_only_fields = ['id', 'username', 'email', 'first_name', 'last_name', 'full_name', 'interests', 'reviews_received']

    def get_reviews_received(self, obj):
        """Get reviews that this user has received from other traders"""
        try:
            from apps.trade.models import Review
            reviews = Review.objects.filter(reviewed_trader=obj).order_by('-created_at')
            return [{
                'id': str(review.id),
                'reviewer_name': review.reviewer.full_name,
                'rating': review.rating,
                'description': review.description,
                'would_trade_again': review.would_trade_again,
                'created_at': review.created_at,
                'trade_id': str(review.trade.id)
            } for review in reviews]
        except Exception:
            return []


class UserSerializer(serializers.ModelSerializer):
    """Serializer for user information"""
    profile = UserProfileSerializer(read_only=True)
    full_name = serializers.ReadOnlyField()
    interests = serializers.SerializerMethodField()
    reviews_received = serializers.SerializerMethodField()
    reviews_given = serializers.SerializerMethodField()
    average_rating = serializers.SerializerMethodField()
    trade_count = serializers.SerializerMethodField()
    trust_score = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name', 'full_name',
            'agrees_to_terms', 'terms_agreed_at', 'terms_version',
            'profile_completed', 'is_active', 'date_joined', 'created_at', 'updated_at',
            'profile', 'interests', 'reviews_received', 'reviews_given', 'average_rating', 'trade_count',
            'trust_score'
        ]
        read_only_fields = [
            'id', 'agrees_to_terms', 'terms_agreed_at', 'terms_version',
            'profile_completed', 'date_joined', 'created_at', 'updated_at'
        ]

    def get_interests(self, obj):
        """Get user's interests from their profile"""
        try:
            if hasattr(obj, 'profile') and obj.profile:
                interests = obj.profile.interests.filter(is_active=True)
                return InterestSerializer(interests, many=True).data
            return []
        except Exception:
            return []

    def get_reviews_received(self, obj):
        """Get reviews that this user has received from other traders"""
        try:
            from apps.trade.models import Review
            reviews = Review.objects.filter(reviewed_trader=obj).order_by('-created_at')
            return [{
                'id': str(review.id),
                'reviewer_name': review.reviewer.full_name,
                'rating': review.rating,
                'description': review.description,
                'would_trade_again': review.would_trade_again,
                'created_at': review.created_at,
                'trade_id': str(review.trade.id)
            } for review in reviews]
        except Exception:
            return []

    def get_reviews_given(self, obj):
        """Get reviews that this user has given to other traders"""
        try:
            from apps.trade.models import Review
            reviews = Review.objects.filter(reviewer=obj).order_by('-created_at')
            return [{
                'id': str(review.id),
                'reviewed_trader_name': review.reviewed_trader.full_name,
                'rating': review.rating,
                'description': review.description,
                'would_trade_again': review.would_trade_again,
                'created_at': review.created_at,
                'trade_id': str(review.trade.id)
            } for review in reviews]
        except Exception:
            return []

    def get_average_rating(self, obj):
        """Get user's average rating from reviews received"""
        try:
            from apps.trade.models import Review
            from django.db.models import Avg
            avg_rating = Review.objects.filter(reviewed_trader=obj).aggregate(
                avg_rating=Avg('rating')
            )['avg_rating']
            return round(avg_rating, 2) if avg_rating else 0.0
        except Exception:
            return 0.0

    def get_trade_count(self, obj):
        """Get trades associated with the user"""
        try:
            from apps.trade.models import Trade
            trades = Trade.objects.filter(buyer=obj) | Trade.objects.filter(seller=obj)
            trades = trades.distinct().order_by('-created_at')
            return trades.count()
        except Exception:
            return 0

    def get_trust_score(self, obj):
        """Calculate a trust score based on reviews and activity"""
        try:
            from apps.trade.models import Review
            from django.db.models import Avg
            reviews = Review.objects.filter(reviewed_trader=obj)
            review_count = reviews.count()
            avg_rating = reviews.aggregate(avg_rating=Avg('rating'))['avg_rating'] or 0.0

            # Simple trust score calculation
            trust_score = (avg_rating * 20)  # Scale to 100
            if review_count >= 10:
                trust_score += 10  # Bonus for volume of reviews
            elif review_count >= 5:
                trust_score += 5

            return min(round(trust_score, 2), 100.0)  # Cap at 100
        except Exception:
            return 0.0


class UserUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating user information"""

    class Meta:
        model = User
        fields = ['first_name', 'last_name', 'email']

    def validate_email(self, value):
        """Validate email uniqueness (excluding current user)"""
        if self.instance and self.instance.email == value:
            return value
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value


class PasswordChangeSerializer(serializers.Serializer):
    """Serializer for password change"""
    old_password = serializers.CharField(
        write_only=True,
        style={'input_type': 'password'}
    )
    new_password = serializers.CharField(
        write_only=True,
        style={'input_type': 'password'}
    )
    new_password_confirm = serializers.CharField(
        write_only=True,
        style={'input_type': 'password'}
    )

    def validate_old_password(self, value):
        """Validate old password"""
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError("Old password is incorrect.")
        return value

    def validate(self, attrs):
        """Validate new password confirmation and requirements"""
        new_password = attrs.get('new_password')
        new_password_confirm = attrs.get('new_password_confirm')

        if new_password != new_password_confirm:
            raise serializers.ValidationError({
                'new_password_confirm': "New passwords do not match."
            })

        # Validate password strength
        try:
            validate_password(new_password, user=self.context['request'].user)
        except ValidationError as e:
            raise serializers.ValidationError({
                'new_password': list(e.messages)
            })

        return attrs

    def save(self):
        """Change user password"""
        user = self.context['request'].user
        user.set_password(self.validated_data['new_password'])
        user.save()
        return user


class UserSummarySerializer(serializers.ModelSerializer):
    """Lightweight serializer for user summary information"""
    full_name = serializers.ReadOnlyField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'full_name', 'is_active', 'date_joined']
        read_only_fields = '__all__'
