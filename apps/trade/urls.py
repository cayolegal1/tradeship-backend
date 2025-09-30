from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

# Create a router and register our viewsets
router = DefaultRouter()
router.register(r'interests', views.InterestViewSet, basename='interest')
router.register(r'items', views.ItemViewSet, basename='item')
router.register(r'shipping-details', views.ShippingDetailsViewSet, basename='shipping-details')
router.register(r'item-images', views.ItemImageViewSet, basename='item-images')
router.register(r'item-files', views.ItemFileViewSet, basename='item-files')
router.register(r'shipping-addresses', views.ShippingAddressViewSet, basename='shipping-addresses')
router.register(r'shipping-preferences', views.ShippingPreferencesViewSet, basename='shipping-preferences')
router.register(r'payment-shipping-setup', views.PaymentShippingSetupViewSet, basename='payment-shipping-setup')
router.register(r'terms-agreements', views.TermsAgreementViewSet, basename='terms-agreements')
router.register(r'trades', views.TradeViewSet, basename='trades')
router.register(r'trade-ratings', views.TradeRatingViewSet, basename='trade-ratings')
router.register(r'reviews', views.ReviewViewSet, basename='reviews')

# The API URLs are now determined automatically by the router
urlpatterns = [
    path('', include(router.urls)),
]
