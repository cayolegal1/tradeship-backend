from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

# Create router and register viewsets
router = DefaultRouter()
router.register(r'wallet', views.UserWalletViewSet, basename='wallet')
router.register(r'transactions', views.WalletTransactionViewSet, basename='transactions')
router.register(r'payment-methods', views.PaymentMethodViewSet, basename='payment-methods')
router.register(r'bank-accounts', views.BankAccountViewSet, basename='bank-accounts')

urlpatterns = [
    # API routes
    path('', include(router.urls)),

    # Webhook endpoints
    path('webhooks/stripe/', views.stripe_webhook, name='stripe-webhook'),

    # Health check
    path('health/', views.health_check, name='payment-health'),
]
