from django.contrib import admin
from django.urls import path
from django.conf import settings
from django.conf.urls.static import static

from core import api_urls


urlpatterns = [
    path('admin/', admin.site.urls),
]

urlpatterns += api_urls.urlpatterns

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
