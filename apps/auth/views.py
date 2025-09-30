from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import login
from .models import User, UserProfile
from .serializers import (
    TraderSerializer, UserRegistrationSerializer, UserLoginSerializer, UserSerializer,
    UserUpdateSerializer, UserProfileSerializer, PasswordChangeSerializer,
    UserSummarySerializer
)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def register_user(request):
    """Register a new user account"""
    serializer = UserRegistrationSerializer(data=request.data)

    if serializer.is_valid():
        user = serializer.save()

        # Generate JWT tokens
        refresh = RefreshToken.for_user(user)
        access_token = refresh.access_token

        # Return user data with tokens
        response_data = {
            'user': UserSerializer(user).data,
            'tokens': {
                'refresh': str(refresh),
                'access': str(access_token),
            },
            'message': 'User registered successfully'
        }

        return Response(response_data, status=status.HTTP_201_CREATED)

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def login_user(request):
    """Login user and return JWT tokens"""
    serializer = UserLoginSerializer(
        data=request.data,
        context={'request': request}
    )

    if serializer.is_valid():
        user = serializer.validated_data['user']

        # Log the user in
        login(request, user)

        # Generate JWT tokens
        refresh = RefreshToken.for_user(user)
        access_token = refresh.access_token

        # Return user data with tokens
        response_data = {
            'user': UserSerializer(user).data,
            'tokens': {
                'refresh': str(refresh),
                'access': str(access_token),
            },
            'message': 'Login successful'
        }

        return Response(response_data, status=status.HTTP_200_OK)

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def current_user(request):
    """Get current authenticated user information"""
    serializer = UserSerializer(request.user)
    return Response(serializer.data)


@api_view(['PUT', 'PATCH'])
@permission_classes([permissions.IsAuthenticated])
def update_user(request):
    """Update current user information"""
    serializer = UserUpdateSerializer(
        request.user,
        data=request.data,
        partial=request.method == 'PATCH'
    )

    if serializer.is_valid():
        user = serializer.save()
        return Response(UserSerializer(user).data)

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def change_password(request):
    """Change user password"""
    serializer = PasswordChangeSerializer(
        data=request.data,
        context={'request': request}
    )

    if serializer.is_valid():
        serializer.save()
        return Response({
            'message': 'Password changed successfully'
        })

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class UserProfileViewSet(ModelViewSet):
    """ViewSet for managing user profiles"""
    serializer_class = UserProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """Return current user's profile only"""
        return UserProfile.objects.filter(user=self.request.user)

    def get_object(self):
        """Get or create user profile"""
        profile, created = UserProfile.objects.get_or_create(
            user=self.request.user
        )
        return profile

    @action(detail=False, methods=['get'])
    def my_profile(self, request):
        """Get current user's profile"""
        profile = self.get_object()
        serializer = self.get_serializer(profile)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='user/(?P<user_id>[^/.]+)')
    def get_user_profile(self, request, user_id=None):
        """Get a specific user's profile by user ID"""
        try:
            # Get or create the profile for that user
            profile = User.objects.get(id=user_id)

            # Serialize the profile data
            serializer = TraderSerializer(profile)

            return Response(serializer.data)

        except UserProfile.DoesNotExist:
            return Response(
                {'error': 'Trader not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return Response(
                {'error': f'Failed to retrieve profile: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=False, methods=['put', 'patch'])
    def update_profile(self, request):
        """Update current user's profile"""
        profile = self.get_object()
        serializer = self.get_serializer(
            profile,
            data=request.data,
            partial=request.method.lower() == 'patch'
        )

        if serializer.is_valid():
            serializer.save()

            # Mark profile as completed if not already
            if not request.user.profile_completed:
                request.user.complete_profile()

            return Response(serializer.data)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'], url_path='interests')
    def get_interests(self, request):
        """Get current user's interests"""
        profile = self.get_object()
        from apps.auth.serializers import InterestSerializer
        interests = profile.interests.filter(is_active=True)
        serializer = InterestSerializer(interests, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['post'], url_path='interests/add')
    def add_interest(self, request):
        """Add an interest to user's profile"""
        profile = self.get_object()
        interest_id = request.data.get('interest_id')

        if not interest_id:
            return Response(
                {'error': 'interest_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            from apps.trade.models import Interest
            interest = Interest.objects.get(id=interest_id, is_active=True)
            profile.add_interest(interest)

            return Response({
                'message': f'Interest "{interest.name}" added successfully',
                'interests': profile.get_interests_list()
            })
        except Interest.DoesNotExist:
            return Response(
                {'error': 'Interest not found or inactive'},
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=False, methods=['post'], url_path='interests/remove')
    def remove_interest(self, request):
        """Remove an interest from user's profile"""
        profile = self.get_object()
        interest_id = request.data.get('interest_id')

        if not interest_id:
            return Response(
                {'error': 'interest_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            from apps.trade.models import Interest
            interest = Interest.objects.get(id=interest_id)
            profile.remove_interest(interest)

            return Response({
                'message': f'Interest "{interest.name}" removed successfully',
                'interests': profile.get_interests_list()
            })
        except Interest.DoesNotExist:
            return Response(
                {'error': 'Interest not found'},
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=False, methods=['put'], url_path='interests/bulk-update')
    def bulk_update_interests(self, request):
        """Bulk update user's interests"""
        profile = self.get_object()
        interest_ids = request.data.get('interest_ids', [])

        if not isinstance(interest_ids, list):
            return Response(
                {'error': 'interest_ids must be a list'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            from apps.trade.models import Interest
            interests = Interest.objects.filter(id__in=interest_ids, is_active=True)
            profile.interests.set(interests)

            return Response({
                'message': 'Interests updated successfully',
                'interests': profile.get_interests_list()
            })
        except Exception as e:
            return Response(
                {'error': f'Failed to update interests: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=False, methods=['get'], url_path='matching-items')
    def get_matching_items(self, request):
        """Get items that match user's interests"""
        profile = self.get_object()
        matching_items = profile.get_matching_items()

        # Use Item serializer from trade app
        from apps.trade.serializers import ItemSerializer
        serializer = ItemSerializer(matching_items, many=True, context={'request': request})

        return Response({
            'count': matching_items.count(),
            'items': serializer.data
        })


class UserViewSet(ModelViewSet):
    """ViewSet for user management (admin use)"""
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAdminUser]
    filterset_fields = ['is_active', 'agrees_to_terms', 'profile_completed']
    search_fields = ['username', 'email', 'first_name', 'last_name']
    ordering_fields = ['created_at', 'date_joined', 'last_login']
    ordering = ['-created_at']

    def get_serializer_class(self):
        """Return different serializers based on action"""
        if self.action == 'list':
            return UserSummarySerializer
        return UserSerializer

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Get user statistics"""
        total_users = User.objects.count()
        active_users = User.objects.filter(is_active=True).count()
        terms_agreed = User.objects.filter(agrees_to_terms=True).count()
        profiles_completed = User.objects.filter(profile_completed=True).count()

        stats = {
            'total_users': total_users,
            'active_users': active_users,
            'inactive_users': total_users - active_users,
            'terms_agreed': terms_agreed,
            'terms_not_agreed': total_users - terms_agreed,
            'profiles_completed': profiles_completed,
            'profiles_incomplete': total_users - profiles_completed,
        }

        return Response(stats)


# Health check endpoint
@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def health_check(request):
    """API health check endpoint"""
    return Response({
        'status': 'healthy',
        'message': 'Auth API is running'
    })


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def list_interests(request):
    """Get all available interests"""
    from apps.trade.models import Interest
    from apps.auth.serializers import InterestSerializer

    interests = Interest.objects.filter(is_active=True).order_by('name')
    serializer = InterestSerializer(interests, many=True)

    return Response({
        'count': interests.count(),
        'interests': serializer.data
    })
