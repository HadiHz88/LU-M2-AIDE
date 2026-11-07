"""Pure business logic: validation, password hashing, and an in-memory user store.

Nothing in this module knows about Flask or HTTP, which makes it ideal for unit tests.
"""
import hashlib
import hmac
import os
import re

USERNAME_RE = re.compile(r"^[a-z0-9_]{3,20}$")
MIN_PASSWORD_LENGTH = 8


class AuthError(Exception):
    """Raised when registration or login input is invalid."""


def hash_password(password: str, salt: bytes | None = None) -> str:
    """Return 'salt$hash' (both hex) using PBKDF2-SHA256."""
    salt = salt or os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 100_000)
    return f"{salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    """Check a plain password against a stored 'salt$hash' string."""
    salt_hex, _ = stored.split("$")
    candidate = hash_password(password, bytes.fromhex(salt_hex))
    return hmac.compare_digest(candidate, stored)


def validate_username(username: str) -> None:
    if not USERNAME_RE.match(username):
        raise AuthError("Username must be 3-20 characters: letters, digits or underscore")


def validate_password(password: str) -> None:
    if len(password) < MIN_PASSWORD_LENGTH:
        raise AuthError(f"Password must be at least {MIN_PASSWORD_LENGTH} characters")
    if not any(c.isdigit() for c in password):
        raise AuthError("Password must contain at least one digit")


class UserStore:
    """Keeps users in a plain dict: {username: 'salt$hash'}. No database."""

    def __init__(self):
        self._users: dict[str, str] = {}

    @staticmethod
    def _normalize(username: str) -> str:
        return username.strip().lower()

    def register(self, username: str, password: str) -> str:
        username = self._normalize(username)
        validate_username(username)
        validate_password(password)
        if username in self._users:
            raise AuthError("Username already taken")
        self._users[username] = hash_password(password)
        return username

    def login(self, username: str, password: str) -> bool:
        stored = self._users.get(self._normalize(username))
        return stored is not None and verify_password(password, stored)

    def exists(self, username: str) -> bool:
        return self._normalize(username) in self._users

    def __len__(self) -> int:
        return len(self._users)
