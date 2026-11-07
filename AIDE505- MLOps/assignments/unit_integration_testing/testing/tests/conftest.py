"""Shared fixtures. pytest discovers this file automatically."""
import sys
from pathlib import Path

import pytest

# Make the project root importable (so `import auth` / `import app` work).
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import create_app  # noqa: E402
from auth import UserStore  # noqa: E402


@pytest.fixture
def store():
    """A fresh, empty user store for each test."""
    return UserStore()


@pytest.fixture
def client(store):
    """A Flask test client wired to the same store, so tests can inspect it."""
    app = create_app(store=store, testing=True)
    with app.test_client() as client:
        yield client
