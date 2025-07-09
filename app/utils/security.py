# app/utils/security.py
"""
Security utilities for password hashing and verification.
"""

from werkzeug.security import generate_password_hash, check_password_hash


def hash_password(password: str) -> str:
    return generate_password_hash(password, method="scrypt")


def verify_password(password: str, hashed: str) -> bool:
    return check_password_hash(hashed, password)
