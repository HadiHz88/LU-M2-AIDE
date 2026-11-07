"""Unit tests: exercise auth.py directly. No Flask, no HTTP."""
import pytest

from auth import AuthError, hash_password, verify_password


# 1 ── A pure function: hashing round-trip
def test_hash_and_verify_password():
    stored = hash_password("secret123")

    assert "secret123" not in stored            # never store plain text
    assert verify_password("secret123", stored)
    assert not verify_password("wrong-pass1", stored)


# 2 ── Parametrize: one test, many bad inputs
@pytest.mark.parametrize(
    "username, password, message",
    [
        ("ab", "secret123", "Username"),          # too short
        ("bad name!", "secret123", "Username"),   # illegal characters
        ("alice", "short1", "at least 8"),        # password too short
        ("alice", "nodigitshere", "digit"),       # no digit
    ],
)
def test_register_rejects_invalid_input(store, username, password, message):
    with pytest.raises(AuthError, match=message):
        store.register(username, password)

    assert len(store) == 0                         # nothing was saved


# 3 ── State + fixture: duplicate usernames, case-insensitive
def test_register_rejects_duplicate_username(store):
    store.register("Alice", "secret123")

    with pytest.raises(AuthError, match="already taken"):
        store.register("alice", "another123")

    assert len(store) == 1
    assert store.login("ALICE", "secret123")
