from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAuthenticatedOrReadOnly
from django.db.models import Q, Avg

from .models import (
    Interest, Item, ShippingDetails, ItemImage, ItemFile, ShippingAddress,
    ShippingPreferences, PaymentShippingSetup, TermsAgreement,
    Trade, TradeRating, Review
)
from .serializers import (
    InterestSerializer, ItemSerializer, ItemCreateSerializer, ShippingDetailsSerializer,
    ItemImageSerializer, ItemFileSerializer, ShippingAddressSerializer, ShippingPreferencesSerializer,
    PaymentShippingSetupSerializer, TermsAgreementSerializer,
    TradeSerializer, TradeCreateSerializer, TradeRatingSerializer, ReviewSerializer
)


class ItemViewSet(viewsets.ModelViewSet):
    """ViewSet for managing tradeable items"""

    serializer_class = ItemSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        queryset = Item.objects.select_related('owner').prefetch_related('images', 'interests')

        # Filter by availability
        available_only = self.request.query_params.get('available', None)
        if available_only and available_only.lower() == 'true':
            queryset = queryset.filter(is_available_for_trade=True, is_active=True)

        # Filter by interests
        interests = self.request.query_params.get('interests', None)
        if interests:
            interest_ids = interests.split(',')
            queryset = queryset.filter(interests__id__in=interest_ids).distinct()

        # Filter by owner
        owner = self.request.query_params.get('owner', None)
        if owner:
            queryset = queryset.filter(owner__id=owner)

        # Search functionality
        search = self.request.query_params.get('search', None)
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search)
                | Q(description__icontains=search)
                | Q(trade_preferences__icontains=search)
                | Q(interests__name__icontains=search)
            ).distinct()

        return queryset.order_by('-created_at')

    def get_serializer_class(self):
        if self.action == 'create':
            return ItemCreateSerializer
        return ItemSerializer

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def toggle_availability(self, request, pk=None):
        """Toggle item availability for trading"""
        item = self.get_object()

        # Check if user owns the item
        if item.owner != request.user:
            return Response(
                {'error': 'You can only modify your own items'},
                status=status.HTTP_403_FORBIDDEN
            )

        item.is_available_for_trade = not item.is_available_for_trade
        item.save(update_fields=['is_available_for_trade'])

        return Response({
            'message': f'Item {"enabled" if item.is_available_for_trade else "disabled"} for trading',
            'is_available_for_trade': item.is_available_for_trade
        })

    @action(detail=True, methods=['get'])
    def trade_history(self, request, pk=None):
        """Get trade history for this item"""
        item = self.get_object()
        trades = Trade.objects.filter(
            Q(item_offered=item) | Q(item_requested=item)
        ).order_by('-created_at')

        serializer = TradeSerializer(trades, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def my_items(self, request):
        """Get current user's items"""
        items = self.get_queryset().filter(owner=request.user)
        serializer = self.get_serializer(items, many=True)
        return Response(serializer.data)


class ShippingDetailsViewSet(viewsets.ModelViewSet):
    """ViewSet for managing item shipping details"""

    serializer_class = ShippingDetailsSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return ShippingDetails.objects.filter(item__owner=self.request.user)

    def perform_create(self, serializer):
        # Ensure the item belongs to the current user
        item = serializer.validated_data['item']
        if item.owner != self.request.user:
            raise PermissionError("You can only add shipping details to your own items")
        serializer.save()


class ItemImageViewSet(viewsets.ModelViewSet):
    """ViewSet for managing item images"""

    serializer_class = ItemImageSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return ItemImage.objects.filter(item__owner=self.request.user)

    def perform_create(self, serializer):
        # Ensure the item belongs to the current user
        item = serializer.validated_data['item']
        if item.owner != self.request.user:
            raise PermissionError("You can only add images to your own items")
        serializer.save()

    @action(detail=True, methods=['post'])
    def set_primary(self, request, pk=None):
        """Set this image as the primary image for the item"""
        image = self.get_object()

        # Set all other images of this item to non-primary
        ItemImage.objects.filter(item=image.item).update(is_primary=False)

        # Set this image as primary
        image.is_primary = True
        image.save()

        return Response({'message': 'Image set as primary'})


class ItemFileViewSet(viewsets.ModelViewSet):
    """ViewSet for managing item file attachments"""

    serializer_class = ItemFileSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Filter based on user permissions
        user = self.request.user
        queryset = ItemFile.objects.select_related('item')

        # Users can see their own files and public files
        return queryset.filter(
            Q(item__owner=user) | Q(is_public=True)
        )

    def perform_create(self, serializer):
        # Ensure the item belongs to the current user
        item = serializer.validated_data['item']
        if item.owner != self.request.user:
            raise PermissionError("You can only add files to your own items")
        serializer.save()

    def perform_update(self, serializer):
        # Ensure the item belongs to the current user
        item = serializer.validated_data.get('item', serializer.instance.item)
        if item.owner != self.request.user:
            raise PermissionError("You can only modify files on your own items")
        serializer.save()

    def perform_destroy(self, instance):
        # Ensure the item belongs to the current user
        if instance.item.owner != self.request.user:
            raise PermissionError("You can only delete files from your own items")
        instance.delete()

    @action(detail=True, methods=['post'])
    def toggle_public(self, request, pk=None):
        """Toggle file public visibility"""
        file_obj = self.get_object()

        # Ensure the file belongs to the current user
        if file_obj.item.owner != request.user:
            return Response(
                {'error': 'You can only modify your own files'},
                status=status.HTTP_403_FORBIDDEN
            )

        file_obj.is_public = not file_obj.is_public
        file_obj.save(update_fields=['is_public'])

        return Response({
            'message': f'File {"made public" if file_obj.is_public else "made private"}',
            'is_public': file_obj.is_public
        })

    @action(detail=True, methods=['get'])
    def download(self, request, pk=None):
        """Get download URL for the file"""
        file_obj = self.get_object()

        # Check permissions - user must own the item or file must be public
        if not file_obj.is_public and file_obj.item.owner != request.user:
            return Response(
                {'error': 'You do not have permission to download this file'},
                status=status.HTTP_403_FORBIDDEN
            )

        download_url = file_obj.get_download_url()
        if not download_url:
            return Response(
                {'error': 'File not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        return Response({
            'download_url': download_url,
            'filename': file_obj.name,
            'file_type': file_obj.file_type,
            'file_size': file_obj.file_size
        })

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def my_files(self, request):
        """Get current user's files"""
        files = self.get_queryset().filter(item__owner=request.user)

        # Filter by item if provided
        item_id = request.query_params.get('item_id')
        if item_id:
            files = files.filter(item__id=item_id)

        # Filter by file type if provided
        file_type = request.query_params.get('file_type')
        if file_type:
            files = files.filter(file_type=file_type)

        serializer = self.get_serializer(files, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def public_files(self, request):
        """Get public files for browsing"""
        files = self.get_queryset().filter(is_public=True)

        # Filter by file type if provided
        file_type = request.query_params.get('file_type')
        if file_type:
            files = files.filter(file_type=file_type)

        serializer = self.get_serializer(files, many=True)
        return Response(serializer.data)


class ShippingAddressViewSet(viewsets.ModelViewSet):
    """ViewSet for managing user shipping addresses"""

    serializer_class = ShippingAddressSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return ShippingAddress.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=True, methods=['post'])
    def set_default(self, request, pk=None):
        """Set this address as the default shipping address"""
        address = self.get_object()

        # Remove default from all other addresses
        ShippingAddress.objects.filter(user=request.user).update(is_default=False)

        # Set this address as default
        address.is_default = True
        address.save()

        return Response({'message': 'Address set as default'})


class ShippingPreferencesViewSet(viewsets.ModelViewSet):
    """ViewSet for managing user shipping preferences"""

    serializer_class = ShippingPreferencesSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return ShippingPreferences.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class PaymentShippingSetupViewSet(viewsets.ModelViewSet):
    """ViewSet for managing user payment and shipping setup"""

    serializer_class = PaymentShippingSetupSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return PaymentShippingSetup.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class TermsAgreementViewSet(viewsets.ModelViewSet):
    """ViewSet for managing terms agreements"""

    serializer_class = TermsAgreementSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return TermsAgreement.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        # Get client IP and user agent
        x_forwarded_for = self.request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = self.request.META.get('REMOTE_ADDR')

        user_agent = self.request.META.get('HTTP_USER_AGENT', '')

        serializer.save(
            user=self.request.user,
            ip_address=ip,
            user_agent=user_agent
        )

    @action(detail=False, methods=['get'])
    def latest(self, request):
        """Get the latest terms agreement for the current user"""
        latest_agreement = self.get_queryset().order_by('-created_at').first()
        if latest_agreement:
            serializer = self.get_serializer(latest_agreement)
            return Response(serializer.data)
        return Response({'message': 'No terms agreement found'}, status=status.HTTP_404_NOT_FOUND)


class TradeViewSet(viewsets.ModelViewSet):
    """ViewSet for managing trades"""

    serializer_class = TradeSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        return Trade.objects.filter(
            Q(trader_offering=user) | Q(trader_receiving=user)
        ).select_related(
            'trader_offering', 'trader_receiving', 'item_offered', 'item_requested'
        ).order_by('-created_at')

    def get_serializer_class(self):
        if self.action == 'create':
            return TradeCreateSerializer
        return TradeSerializer

    def perform_create(self, serializer):
        serializer.save(trader_offering=self.request.user)

    @action(detail=True, methods=['post'])
    def accept(self, request, pk=None):
        """Accept a trade offer"""
        trade = self.get_object()

        try:
            trade.accept_trade(request.user)
            return Response({
                'message': 'Trade accepted successfully',
                'status': trade.status
            })
        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """Mark trade as completed"""
        trade = self.get_object()

        # Only traders involved can complete
        if request.user not in [trade.trader_offering, trade.trader_receiving]:
            return Response(
                {'error': 'Only traders involved can complete this trade'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Can only complete accepted or in-progress trades
        if trade.status not in ['accepted', 'in_progress', 'in_escrow']:
            return Response(
                {'error': 'Trade cannot be completed in current status'},
                status=status.HTTP_400_BAD_REQUEST
            )

        trade.complete_trade()
        return Response({
            'message': 'Trade completed successfully',
            'status': trade.status
        })

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Cancel a trade"""
        trade = self.get_object()
        reason = request.data.get('reason', '')

        try:
            trade.cancel_trade(request.user, reason)
            return Response({
                'message': 'Trade cancelled successfully',
                'status': trade.status
            })
        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=False, methods=['get'])
    def my_offers(self, request):
        """Get trades where current user is offering"""
        trades = self.get_queryset().filter(trader_offering=request.user)
        serializer = self.get_serializer(trades, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def received_offers(self, request):
        """Get trades where current user is receiving"""
        trades = self.get_queryset().filter(trader_receiving=request.user)
        serializer = self.get_serializer(trades, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def active(self, request):
        """Get active trades for current user"""
        trades = self.get_queryset().filter(status__in=['pending', 'accepted', 'in_progress', 'in_escrow'])
        serializer = self.get_serializer(trades, many=True)
        return Response(serializer.data)


class TradeRatingViewSet(viewsets.ModelViewSet):
    """ViewSet for managing trade ratings"""

    serializer_class = TradeRatingSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        return TradeRating.objects.filter(
            Q(rater=user) | Q(rated_trader=user)
        ).select_related('trade', 'rater', 'rated_trader').order_by('-created_at')

    def perform_create(self, serializer):
        # Ensure the rater is the current user
        trade = serializer.validated_data['trade']

        # Check if user was involved in this trade
        if self.request.user not in [trade.trader_offering, trade.trader_receiving]:
            raise PermissionError("You can only rate trades you were involved in")

        # Check if trade is completed
        if trade.status != 'completed':
            raise ValueError("You can only rate completed trades")

        # Check if rating already exists
        if TradeRating.objects.filter(trade=trade, rater=self.request.user).exists():
            raise ValueError("You have already rated this trade")

        serializer.save(rater=self.request.user)

    @action(detail=False, methods=['get'])
    def my_ratings_given(self, request):
        """Get ratings given by current user"""
        ratings = self.get_queryset().filter(rater=request.user)
        serializer = self.get_serializer(ratings, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def my_ratings_received(self, request):
        """Get ratings received by current user"""
        ratings = self.get_queryset().filter(rated_trader=request.user)
        serializer = self.get_serializer(ratings, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Get rating statistics for current user"""
        received_ratings = self.get_queryset().filter(rated_trader=request.user)

        if not received_ratings.exists():
            return Response({
                'total_ratings': 0,
                'average_rating': 0,
                'rating_breakdown': {}
            })

        avg_overall = received_ratings.aggregate(avg=Avg('overall_rating'))['avg']
        avg_communication = received_ratings.aggregate(avg=Avg('communication_rating'))['avg']
        avg_condition = received_ratings.aggregate(avg=Avg('item_condition_rating'))['avg']
        avg_shipping = received_ratings.aggregate(avg=Avg('shipping_rating'))['avg']

        return Response({
            'total_ratings': received_ratings.count(),
            'average_rating': round(avg_overall, 2) if avg_overall else 0,
            'rating_breakdown': {
                'overall': round(avg_overall, 2) if avg_overall else 0,
                'communication': round(avg_communication, 2) if avg_communication else 0,
                'item_condition': round(avg_condition, 2) if avg_condition else 0,
                'shipping': round(avg_shipping, 2) if avg_shipping else 0,
            }
        })


class InterestViewSet(viewsets.ModelViewSet):
    """ViewSet for managing interests/tags"""

    serializer_class = InterestSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        queryset = Interest.objects.all()

        # Filter by active status
        active_only = self.request.query_params.get('active', None)
        if active_only and active_only.lower() == 'true':
            queryset = queryset.filter(is_active=True)

        # Search functionality
        search = self.request.query_params.get('search', None)
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search) | Q(description__icontains=search)
            )

        return queryset.order_by('name')

    @action(detail=False, methods=['get'])
    def popular(self, request):
        """Get most popular interests based on item count"""
        interests = self.get_queryset().filter(is_active=True)

        # Annotate with item count and order by popularity
        from django.db.models import Count
        interests = interests.annotate(
            active_item_count=Count('items', filter=Q(items__is_active=True))
        ).order_by('-active_item_count')[:10]

        serializer = self.get_serializer(interests, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def items(self, request, pk=None):
        """Get items with this interest"""
        interest = self.get_object()
        items = Item.objects.filter(
            interests=interest,
            is_active=True,
            is_available_for_trade=True
        ).select_related('owner').prefetch_related('images')

        from .serializers import ItemSerializer
        serializer = ItemSerializer(items, many=True, context={'request': request})
        return Response(serializer.data)


class ReviewViewSet(viewsets.ModelViewSet):
    """ViewSet for managing trade reviews"""

    serializer_class = ReviewSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        return Review.objects.filter(
            Q(reviewer=user) | Q(reviewed_trader=user)
        ).select_related('trade', 'reviewer', 'reviewed_trader').order_by('-created_at')

    def perform_create(self, serializer):
        # Validation is handled in the serializer
        serializer.save()

    @action(detail=False, methods=['get'])
    def my_reviews_given(self, request):
        """Get reviews given by current user"""
        reviews = self.get_queryset().filter(reviewer=request.user)
        serializer = self.get_serializer(reviews, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def my_reviews_received(self, request):
        """Get reviews received by current user"""
        reviews = self.get_queryset().filter(reviewed_trader=request.user)
        serializer = self.get_serializer(reviews, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Get review statistics for current user"""
        received_reviews = self.get_queryset().filter(reviewed_trader=request.user)

        if not received_reviews.exists():
            return Response({
                'total_reviews': 0,
                'average_rating': 0,
                'would_trade_again_percentage': 0,
                'rating_distribution': {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
            })

        total_reviews = received_reviews.count()
        avg_rating = received_reviews.aggregate(avg=Avg('rating'))['avg']
        would_trade_again_count = received_reviews.filter(would_trade_again=True).count()
        would_trade_again_percentage = (would_trade_again_count / total_reviews) * 100

        # Get rating distribution
        rating_distribution = {}
        for i in range(1, 6):
            rating_distribution[i] = received_reviews.filter(rating=i).count()

        return Response({
            'total_reviews': total_reviews,
            'average_rating': round(avg_rating, 2) if avg_rating else 0,
            'would_trade_again_percentage': round(would_trade_again_percentage, 1),
            'rating_distribution': rating_distribution
        })

    @action(detail=True, methods=['get'])
    def trade_review_status(self, request, pk=None):
        """Get review status for a specific trade"""
        try:
            trade = Trade.objects.get(pk=pk)

            # Ensure user was involved in this trade
            if request.user not in [trade.trader_offering, trade.trader_receiving]:
                return Response(
                    {'error': 'You can only check review status for trades you were involved in'},
                    status=status.HTTP_403_FORBIDDEN
                )

            return Response(trade.review_status)
        except Trade.DoesNotExist:
            return Response(
                {'error': 'Trade not found'},
                status=status.HTTP_404_NOT_FOUND
            )
