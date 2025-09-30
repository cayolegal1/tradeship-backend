"""
Custom exception handlers for camelCase API responses.
"""

from django.conf import settings
from rest_framework.views import exception_handler

from .case_conversion import convert_errors_to_camel


def camel_case_exception_handler(exc, context):
    """
    Custom exception handler that converts error field names to camelCase.
    """
    # Call REST framework's default exception handler first
    response = exception_handler(exc, context)

    # Check if camelCase conversion is enabled
    if not getattr(settings, 'ENABLE_CAMEL_CASE_API', False):
        return response

    # If there is a response and it's an error response
    if response is not None and response.status_code >= 400:
        # Convert error field names to camelCase
        if isinstance(response.data, dict):
            response.data = convert_errors_to_camel(response.data)

    return response
