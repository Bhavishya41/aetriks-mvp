"""
Tests for the Environmental Audit API routes.
GEE, osmnx, and Supabase are all mocked so no credentials needed.

Run from the backend/ directory:
    pytest tests/test_audit.py -v
"""

import sys
import os
import pytest
from unittest.mock import patch, MagicMock

# Ensure the backend root is on the import path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# ── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture
def client():
    """Create a Flask test client with a mocked Supabase."""
    # Must patch env BEFORE importing app so create_client doesn't fail
    env_patch = {
        "SUPABASE_URL": "https://fake.supabase.co",
        "SUPABASE_KEY": "fake-key",
        "GEE_SERVICE_ACCOUNT": "fake@fake.iam.gserviceaccount.com",
        "GEE_KEY_FILE": "fake-key.json",
    }
    with patch.dict(os.environ, env_patch):
        with patch("supabase.create_client") as mock_create:
            mock_supabase = MagicMock()
            mock_create.return_value = mock_supabase

            from app import app
            app.config["TESTING"] = True
            app.supabase = mock_supabase  # Override directly

            with app.test_client() as c:
                yield c, mock_supabase


# ── Tests ─────────────────────────────────────────────────────────────────────

class TestEnvironmentalAudit:

    def test_invalid_city_returns_404(self, client):
        """Geocoding a nonsense city name should return 404."""
        test_client, _ = client
        with patch("routes.audit.ox.geocode_to_gdf", side_effect=Exception("not found")):
            resp = test_client.get("/api/environmental-audit/XYZNonExistentCity99999")
        assert resp.status_code == 404
        data = resp.get_json()
        assert "error" in data

    def test_cache_hit_returns_200(self, client):
        """If Supabase already has data for the current month, return 200."""
        test_client, mock_sb = client

        # Mock geocoding
        mock_gdf = MagicMock()
        mock_gdf.iloc[0].geometry.bounds = (77.4, 12.8, 77.8, 13.1)

        # Mock Supabase: current month cache exists
        mock_sb.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = [
            {"city": "bengaluru", "month_year": "2026-03", "no2_mean": 55.0, "temp_mean": 34.0, "ndvi_mean": 0.28}
        ]
        mock_sb.table.return_value.select.return_value.eq.return_value.order.return_value.execute.return_value.data = [
            {"city": "bengaluru", "month_year": "2026-03", "no2_mean": 55.0, "temp_mean": 34.0, "ndvi_mean": 0.28}
        ]

        with patch("routes.audit.ox.geocode_to_gdf", return_value=mock_gdf):
            resp = test_client.get("/api/environmental-audit/Bengaluru")

        assert resp.status_code == 200
        data = resp.get_json()
        assert data["status"] == "cached"
        assert "data" in data

    def test_cache_miss_returns_202_with_task_id(self, client):
        """If no cache data, return 202 with a task_id and start background thread."""
        test_client, mock_sb = client

        mock_gdf = MagicMock()
        mock_gdf.iloc[0].geometry.bounds = (77.4, 12.8, 77.8, 13.1)

        # Mock Supabase: no existing data
        mock_sb.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = []

        with patch("routes.audit.ox.geocode_to_gdf", return_value=mock_gdf), \
             patch("routes.audit.threading.Thread") as mock_thread:
            mock_thread.return_value = MagicMock()
            resp = test_client.get("/api/environmental-audit/Bengaluru")

        assert resp.status_code == 202
        data = resp.get_json()
        assert data["status"] == "pending"
        assert "task_id" in data
        assert len(data["task_id"]) > 0
        mock_thread.return_value.start.assert_called_once()


class TestTaskStatus:

    def test_unknown_task_returns_404(self, client):
        """Unknown task_id should return 404."""
        test_client, _ = client
        resp = test_client.get("/api/task-status/00000000-0000-0000-0000-000000000000")
        assert resp.status_code == 404

    def test_known_task_returns_status(self, client):
        """A task that exists should return its current status fields."""
        test_client, _ = client
        from app import app

        task_id = "test-task-abc"
        with app.app_context():
            if not hasattr(app, "task_store"):
                app.task_store = {}
            app.task_store[task_id] = {
                "status": "running",
                "progress": 50,
                "city": "Bengaluru",
                "result": None,
                "error": None,
            }

        resp = test_client.get(f"/api/task-status/{task_id}")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["task_id"] == task_id
        assert data["status"] == "running"
        assert data["progress"] == 50
