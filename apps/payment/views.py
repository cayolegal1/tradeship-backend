from rest_framework import status, permissions, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response

from .models import UserWallet, WalletTransaction, PaymentMethod, BankAccount
from .serializers import (
    UserWalletSerializer, WalletTransactionSerializer, PaymentMethodSerializer,
    BankAccountSerializer, DepositRequestSerializer,
    WithdrawalRequestSerializer, EscrowOperationSerializer, ShippingPaymentSerializer,
    WalletSummarySerializer
)
from .services import WalletService, PaymentMethodService


class UserWalletViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for user wallet (read-only)"""

    serializer_class = UserWalletSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """Return current user's wallet only"""
        return UserWallet.objects.filter(user=self.request.user)

    def get_object(self):
        """Get or create user wallet"""
        return WalletService.get_or_create_wallet(self.request.user)

    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Get wallet summary with recent transactions"""
        summary = WalletService.get_wallet_summary(request.user)
        serializer = WalletSummarySerializer(summary)
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def deposit(self, request):
        """Create a deposit transaction"""
        serializer = DepositRequestSerializer(data=request.data)

        # Here, create the payment intent and return client_secret

        if serializer.is_valid():
            result = WalletService.create_deposit_intent(
                user=request.user,
                amount=serializer.validated_data['amount'],
                payment_method_id=serializer.validated_data['payment_method_id'],
                description=serializer.validated_data.get('description', '')
            )

            if result['success']:
                return Response({
                    'success': True,
                    'transaction_id': result['transaction_id'],
                    'client_secret': result['payment_intent']['client_secret'],
                    'message': 'Deposit initiated successfully'
                }, status=status.HTTP_201_CREATED)
            else:
                return Response({
                    'success': False,
                    'error': result['error']
                }, status=status.HTTP_400_BAD_REQUEST)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def withdraw(self, request):
        """Create a withdrawal transaction"""
        serializer = WithdrawalRequestSerializer(data=request.data)

        if serializer.is_valid():
            result = WalletService.create_withdrawal(
                user=request.user,
                amount=serializer.validated_data['amount'],
                bank_account_id=serializer.validated_data.get('bank_account_id'),
                description=serializer.validated_data.get('description', '')
            )

            if result['success']:
                return Response({
                    'success': True,
                    'transaction_id': result['transaction_id'],
                    'bank_account': result['bank_account'],
                    'message': 'Withdrawal initiated successfully'
                }, status=status.HTTP_201_CREATED)
            else:
                return Response({
                    'success': False,
                    'error': result['error']
                }, status=status.HTTP_400_BAD_REQUEST)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def escrow_deposit(self, request):
        """Move funds to escrow for a trade"""
        serializer = EscrowOperationSerializer(data=request.data)

        if serializer.is_valid():
            result = WalletService.escrow_deposit(
                user=request.user,
                amount=serializer.validated_data['amount'],
                trade_id=str(serializer.validated_data['trade_id']),
                description=serializer.validated_data.get('description', '')
            )

            if result['success']:
                return Response({
                    'success': True,
                    'transaction_id': result['transaction_id'],
                    'escrow_balance': result['escrow_balance'],
                    'message': 'Funds moved to escrow successfully'
                })
            else:
                return Response({
                    'success': False,
                    'error': result['error']
                }, status=status.HTTP_400_BAD_REQUEST)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def escrow_release(self, request):
        """Release funds from escrow"""
        serializer = EscrowOperationSerializer(data=request.data)

        if serializer.is_valid():
            to_available = request.data.get('to_available', True)

            result = WalletService.release_escrow(
                user=request.user,
                amount=serializer.validated_data['amount'],
                trade_id=str(serializer.validated_data['trade_id']),
                to_available=to_available,
                description=serializer.validated_data.get('description', '')
            )

            if result['success']:
                return Response({
                    'success': True,
                    'transaction_id': result['transaction_id'],
                    'available_balance': result['available_balance'],
                    'escrow_balance': result['escrow_balance'],
                    'message': 'Funds released from escrow successfully'
                })
            else:
                return Response({
                    'success': False,
                    'error': result['error']
                }, status=status.HTTP_400_BAD_REQUEST)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def pay_shipping(self, request):
        """Pay for shipping from available balance"""
        serializer = ShippingPaymentSerializer(data=request.data)

        if serializer.is_valid():
            result = WalletService.shipping_payment(
                user=request.user,
                amount=serializer.validated_data['amount'],
                trade_id=str(serializer.validated_data['trade_id']),
                description=serializer.validated_data.get('description', '')
            )

            if result['success']:
                return Response({
                    'success': True,
                    'transaction_id': result['transaction_id'],
                    'available_balance': result['available_balance'],
                    'message': 'Shipping payment processed successfully'
                })
            else:
                return Response({
                    'success': False,
                    'error': result['error']
                }, status=status.HTTP_400_BAD_REQUEST)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class WalletTransactionViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for wallet transactions (read-only)"""

    serializer_class = WalletTransactionSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['transaction_type', 'status', 'trade_id']
    search_fields = ['description', 'stripe_payment_intent_id', 'trade_id']
    ordering_fields = ['created_at', 'amount']
    ordering = ['-created_at']

    def get_queryset(self):
        """Return current user's transactions only"""
        wallet = WalletService.get_or_create_wallet(self.request.user)
        return WalletTransaction.objects.filter(wallet=wallet)


class PaymentMethodViewSet(viewsets.ModelViewSet):
    """ViewSet for payment methods"""

    serializer_class = PaymentMethodSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """Return current user's payment methods only"""
        return PaymentMethod.objects.filter(user=self.request.user, is_active=True)

    def create(self, request, *args, **kwargs):
        """Add a new payment method"""
        stripe_payment_method_id = request.data.get('stripe_payment_method_id')

        if not stripe_payment_method_id:
            return Response({
                'error': 'stripe_payment_method_id is required'
            }, status=status.HTTP_400_BAD_REQUEST)

        result = PaymentMethodService.add_payment_method(
            user=request.user,
            stripe_payment_method_id=stripe_payment_method_id
        )

        if result['success']:
            payment_method = PaymentMethod.objects.get(id=result['payment_method_id'])
            serializer = self.get_serializer(payment_method)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        else:
            return Response({
                'error': result['error']
            }, status=status.HTTP_400_BAD_REQUEST)

    def destroy(self, request, *args, **kwargs):
        """Remove a payment method"""
        payment_method = self.get_object()

        result = PaymentMethodService.remove_payment_method(
            user=request.user,
            payment_method_id=str(payment_method.id)
        )

        if result['success']:
            return Response(status=status.HTTP_204_NO_CONTENT)
        else:
            return Response({
                'error': result['error']
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def set_default(self, request, pk=None):
        """Set payment method as default"""
        payment_method = self.get_object()

        # Remove default from other methods
        PaymentMethod.objects.filter(
            user=request.user, is_default=True
        ).update(is_default=False)

        # Set this one as default
        payment_method.is_default = True
        payment_method.save()

        serializer = self.get_serializer(payment_method)
        return Response(serializer.data)


class BankAccountViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for bank accounts (read-only for now)"""

    serializer_class = BankAccountSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """Return current user's bank accounts only"""
        return BankAccount.objects.filter(user=self.request.user, is_active=True)


# Webhook endpoint for Stripe events
@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def stripe_webhook(request):
    """Handle Stripe webhook events"""
    import stripe
    from django.conf import settings
    # from django.views.decorators.csrf import csrf_exempt
    # from django.utils.decorators import method_decorator

    payload = request.body
    sig_header = request.META.get('HTTP_STRIPE_SIGNATURE')
    endpoint_secret = settings.STRIPE_WEBHOOK_SECRET

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, endpoint_secret
        )
    except ValueError:
        return Response({'error': 'Invalid payload'}, status=400)
    except stripe.error.SignatureVerificationError:
        return Response({'error': 'Invalid signature'}, status=400)

    # Handle the event
    if event['type'] == 'payment_intent.succeeded':
        payment_intent = event['data']['object']
        transaction_id = payment_intent['metadata'].get('transaction_id')

        if transaction_id:
            WalletService.complete_deposit(
                transaction_id=transaction_id,
                stripe_charge_id=payment_intent.get('latest_charge')
            )

    elif event['type'] == 'payment_intent.payment_failed':
        payment_intent = event['data']['object']
        transaction_id = payment_intent['metadata'].get('transaction_id')

        if transaction_id:
            try:
                transaction = WalletTransaction.objects.get(id=transaction_id)
                transaction.status = 'failed'
                transaction.save()
            except WalletTransaction.DoesNotExist:
                pass

    return Response({'status': 'success'})


# Health check endpoint
@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def health_check(request):
    """API health check endpoint"""
    return Response({
        'status': 'healthy',
        'message': 'Payment API is running'
    })
