"""
Custom DRF parsers and renderers for camelCase/snake_case conversion.
"""

from typing import Any
from django.conf import settings
from rest_framework.parsers import JSONParser
from rest_framework.renderers import JSONRenderer
from rest_framework.exceptions import ParseError

from .case_conversion import convert_data_to_snake, convert_data_to_camel, convert_errors_to_camel


class CamelCaseJSONParser(JSONParser):
    """
    Custom JSON parser that converts camelCase field names to snake_case
    for internal Django processing.
    """

    def parse(self, stream, media_type=None, parser_context=None):
        """
        Parse the incoming JSON request and convert camelCase keys to snake_case.
        """
        # Check if camelCase conversion is enabled
        if not getattr(settings, 'ENABLE_CAMEL_CASE_API', False):
            return super().parse(stream, media_type, parser_context)

        try:
            # Parse the JSON data normally first
            data = super().parse(stream, media_type, parser_context)

            # Convert camelCase keys to snake_case
            if data is not None:
                data = convert_data_to_snake(data)

            return data

        except ValueError as exc:
            raise ParseError('JSON parse error - %s' % str(exc))


class CamelCaseJSONRenderer(JSONRenderer):
    """
    Custom JSON renderer that converts snake_case field names to camelCase
    for API responses.
    """

    def render(self, data, accepted_media_type=None, renderer_context=None):
        """
        Render the response data and convert snake_case keys to camelCase.
        """
        # Check if camelCase conversion is enabled
        if not getattr(settings, 'ENABLE_CAMEL_CASE_API', False):
            return super().render(data, accepted_media_type, renderer_context)

        # Handle error responses specially
        response = renderer_context.get('response') if renderer_context else None
        if response and response.status_code >= 400:
            data = self._convert_error_response(data)
        elif data is not None:
            # Convert snake_case keys to camelCase for success responses
            data = convert_data_to_camel(data)

        return super().render(data, accepted_media_type, renderer_context)

    def _convert_error_response(self, data: Any) -> Any:
        """
        Convert error response data to camelCase.
        Special handling for DRF validation errors.
        """
        if isinstance(data, dict):
            # Handle DRF validation errors
            if 'detail' in data or any(isinstance(v, list) for v in data.values()):
                return convert_errors_to_camel(data)
            else:
                # Handle other error responses
                return convert_data_to_camel(data)

        return data


class CamelCaseMultiPartParser(JSONParser):
    """
    Custom multipart parser that handles camelCase field names in form data.
    """

    def parse(self, stream, media_type=None, parser_context=None):
        """
        Parse multipart form data and convert camelCase field names to snake_case.
        """
        # Check if camelCase conversion is enabled
        if not getattr(settings, 'ENABLE_CAMEL_CASE_API', False):
            return super().parse(stream, media_type, parser_context)

        try:
            # Parse the form data normally first
            data = super().parse(stream, media_type, parser_context)

            # Convert camelCase keys to snake_case for form fields
            if isinstance(data, dict):
                converted_data = {}
                for key, value in data.items():
                    # Convert field names but keep file objects as-is
                    if hasattr(value, 'read'):  # File-like object
                        converted_data[convert_data_to_snake(key) if isinstance(key, str) else key] = value
                    else:
                        # Convert both key and value if it's a nested structure
                        snake_key = convert_data_to_snake(key) if isinstance(key, str) else key
                        if isinstance(value, (dict, list)):
                            converted_data[snake_key] = convert_data_to_snake(value)
                        else:
                            converted_data[snake_key] = value
                data = converted_data

            return data

        except ValueError as exc:
            raise ParseError('Form data parse error - %s' % str(exc))
