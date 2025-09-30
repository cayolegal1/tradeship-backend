from django.urls import include, re_path
from rest_framework import routers
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
    TokenVerifyView
)

PREFIX = "api"

router = routers.DefaultRouter()

urlpatterns = [
    re_path(f"{PREFIX}/", include(router.urls)),
    re_path(f'{PREFIX}/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    re_path(f'{PREFIX}/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    re_path(f'{PREFIX}/token/verify/', TokenVerifyView.as_view(), name='token_verify'),
    re_path(f'{PREFIX}/auth/', include('apps.auth.urls')),
    re_path(f'{PREFIX}/notifications/', include('apps.notification.urls')),
    re_path(f'{PREFIX}/trade/', include('apps.trade.urls')),
    re_path(f'{PREFIX}/payment/', include('apps.payment.urls')),
]
