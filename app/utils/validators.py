# app/utils/validators.py
"""
Custom input validators (for forms or CLI tools).
"""

import re


def is_valid_email(email: str) -> bool:
    pattern = r"^[\w\.-]+@[\w\.-]+\.\w+$"
    return re.match(pattern, email) is not None


def is_valid_username(username: str) -> bool:
    return len(username) >= 3 and username.isalnum()


def is_valid_password(password: str) -> bool:
    return len(password) >= 6  # Add complexity checks if needed
