from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

# Create a router for ViewSets
router = DefaultRouter()
router.register(r'profiles', views.UserProfileViewSet, basename='userprofile')
router.register(r'users', views.UserViewSet, basename='user')

# URL patterns
urlpatterns = [
    # Authentication endpoints
    path('register/', views.register_user, name='register'),
    path('login/', views.login_user, name='login'),
    path('me/', views.current_user, name='current-user'),
    path('me/update/', views.update_user, name='update-user'),
    path('me/change-password/', views.change_password, name='change-password'),

    # Interests endpoints
    path('interests/', views.list_interests, name='list-interests'),

    # Health check
    path('health/', views.health_check, name='health-check'),

    # Include router URLs
    path('', include(router.urls)),
]
