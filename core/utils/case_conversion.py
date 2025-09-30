"""
Utility functions for converting between camelCase and snake_case.
Used for API request/response field name conversion.
"""

import re
from typing import Any, Dict, List, Union


def snake_to_camel(snake_str: str) -> str:
    """
    Convert snake_case string to camelCase.

    Args:
        snake_str: String in snake_case format

    Returns:
        String in camelCase format

    Examples:
        >>> snake_to_camel('user_name')
        'userName'
        >>> snake_to_camel('is_active_for_trade')
        'isActiveForTrade'
    """
    if not snake_str:
        return snake_str

    # Split by underscore and convert to camelCase
    components = snake_str.split('_')
    # First component stays lowercase, rest are capitalized
    return components[0] + ''.join(word.capitalize() for word in components[1:])


def camel_to_snake(camel_str: str) -> str:
    """
    Convert camelCase string to snake_case.

    Args:
        camel_str: String in camelCase format

    Returns:
        String in snake_case format

    Examples:
        >>> camel_to_snake('userName')
        'user_name'
        >>> camel_to_snake('isActiveForTrade')
        'is_active_for_trade'
    """
    if not camel_str:
        return camel_str

    # Insert underscore before uppercase letters and convert to lowercase
    snake_str = re.sub('([a-z0-9])([A-Z])', r'\1_\2', camel_str)
    return snake_str.lower()


def convert_dict_keys_to_camel(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Recursively convert dictionary keys from snake_case to camelCase.

    Args:
        data: Dictionary with snake_case keys

    Returns:
        Dictionary with camelCase keys
    """
    if not isinstance(data, dict):
        return data

    converted = {}
    for key, value in data.items():
        # Convert the key
        camel_key = snake_to_camel(key)

        # Recursively convert nested dictionaries and lists
        if isinstance(value, dict):
            converted[camel_key] = convert_dict_keys_to_camel(value)
        elif isinstance(value, list):
            converted[camel_key] = convert_list_to_camel(value)
        else:
            converted[camel_key] = value

    return converted


def convert_dict_keys_to_snake(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Recursively convert dictionary keys from camelCase to snake_case.

    Args:
        data: Dictionary with camelCase keys

    Returns:
        Dictionary with snake_case keys
    """
    if not isinstance(data, dict):
        return data

    converted = {}
    for key, value in data.items():
        # Convert the key
        snake_key = camel_to_snake(key)

        # Recursively convert nested dictionaries and lists
        if isinstance(value, dict):
            converted[snake_key] = convert_dict_keys_to_snake(value)
        elif isinstance(value, list):
            converted[snake_key] = convert_list_to_snake(value)
        else:
            converted[snake_key] = value

    return converted


def convert_list_to_camel(data: List[Any]) -> List[Any]:
    """
    Recursively convert list items from snake_case to camelCase.

    Args:
        data: List that may contain dictionaries with snake_case keys

    Returns:
        List with dictionaries converted to camelCase keys
    """
    if not isinstance(data, list):
        return data

    converted = []
    for item in data:
        if isinstance(item, dict):
            converted.append(convert_dict_keys_to_camel(item))
        elif isinstance(item, list):
            converted.append(convert_list_to_camel(item))
        else:
            converted.append(item)

    return converted


def convert_list_to_snake(data: List[Any]) -> List[Any]:
    """
    Recursively convert list items from camelCase to snake_case.

    Args:
        data: List that may contain dictionaries with camelCase keys

    Returns:
        List with dictionaries converted to snake_case keys
    """
    if not isinstance(data, list):
        return data

    converted = []
    for item in data:
        if isinstance(item, dict):
            converted.append(convert_dict_keys_to_snake(item))
        elif isinstance(item, list):
            converted.append(convert_list_to_snake(item))
        else:
            converted.append(item)

    return converted


def convert_data_to_camel(data: Union[Dict, List, Any]) -> Union[Dict, List, Any]:
    """
    Convert data structure from snake_case to camelCase.

    Args:
        data: Data structure to convert

    Returns:
        Data structure with camelCase keys
    """
    if isinstance(data, dict):
        return convert_dict_keys_to_camel(data)
    elif isinstance(data, list):
        return convert_list_to_camel(data)
    else:
        return data


def convert_data_to_snake(data: Union[Dict, List, Any]) -> Union[Dict, List, Any]:
    """
    Convert data structure from camelCase to snake_case.

    Args:
        data: Data structure to convert

    Returns:
        Data structure with snake_case keys
    """
    if isinstance(data, dict):
        return convert_dict_keys_to_snake(data)
    elif isinstance(data, list):
        return convert_list_to_snake(data)
    else:
        return data


def convert_errors_to_camel(errors: Dict[str, Any]) -> Dict[str, Any]:
    """
    Convert DRF validation errors from snake_case to camelCase field names.

    Args:
        errors: DRF validation errors dictionary

    Returns:
        Errors dictionary with camelCase field names
    """
    if not isinstance(errors, dict):
        return errors

    converted_errors = {}
    for field, error_list in errors.items():
        camel_field = snake_to_camel(field)

        # Handle nested errors (for nested serializers)
        if isinstance(error_list, dict):
            converted_errors[camel_field] = convert_errors_to_camel(error_list)
        elif isinstance(error_list, list):
            # Handle list of errors or list of nested error dicts
            converted_list = []
            for error in error_list:
                if isinstance(error, dict):
                    converted_list.append(convert_errors_to_camel(error))
                else:
                    converted_list.append(error)
            converted_errors[camel_field] = converted_list
        else:
            converted_errors[camel_field] = error_list

    return converted_errors
