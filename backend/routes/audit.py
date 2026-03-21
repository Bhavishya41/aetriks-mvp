import uuid
import threading
import logging
from datetime import datetime

import osmnx as ox
from flask import Blueprint, jsonify, current_app

from gee.processor import process_city_data

logger = logging.getLogger(__name__)

audit_bp = Blueprint("audit", __name__)


# ---------------------------------------------------------------------------
# Helper: shared task store lives on the Flask app object so it's accessible
# from both the Blueprint and the background thread.
# ---------------------------------------------------------------------------

def _task_store(app) -> dict:
    """Return (and lazily create) the shared task store on the Flask app."""
    if not hasattr(app, "task_store"):
        app.task_store = {}
    return app.task_store


# ---------------------------------------------------------------------------
# Route 1 — Trigger an environmental audit for a city
# ---------------------------------------------------------------------------

@audit_bp.route("/api/environmental-audit/<city_name>", methods=["GET"])
def environmental_audit(city_name: str):
    """
    GET /api/environmental-audit/<city_name>

    1. Geocode the city name → bounding box (osmnx).
    2. Check Supabase cache for the current month's data.
    3a. Cache HIT  → return 200 with the cached rows.
    3b. Cache MISS → spawn background thread, return 202 with task_id.
    """
    supabase = current_app.supabase
    store    = _task_store(current_app._get_current_object())

    # --- Step 1: Geocode -------------------------------------------------
    try:
        gdf = ox.geocode_to_gdf(city_name)
    except Exception as exc:
        logger.warning("Geocoding failed for '%s': %s", city_name, exc)
        return jsonify({"error": f"City '{city_name}' not found.", "detail": str(exc)}), 404

    bounds = gdf.iloc[0].geometry.bounds  # (minx, miny, maxx, maxy) = (west, south, east, north)
    bbox = {
        "west":  bounds[0],
        "south": bounds[1],
        "east":  bounds[2],
        "north": bounds[3],
    }

    city_key   = city_name.lower().strip()
    current_ym = datetime.utcnow().strftime("%Y-%m")

    # --- Step 2: Check Supabase cache ------------------------------------
    try:
        cache_resp = (
            supabase
            .table("ward_environmental_data")
            .select("*")
            .eq("city", city_key)
            .eq("month_year", current_ym)
            .execute()
        )
        cached_rows = cache_resp.data if cache_resp.data else []
    except Exception as exc:
        logger.error("Supabase cache check failed: %s", exc)
        cached_rows = []

    # --- Step 3a: Cache HIT → return 200 ---------------------------------
    if cached_rows:
        # Fetch all 12 months for this city to return the full timeline
        try:
            full_resp = (
                supabase
                .table("ward_environmental_data")
                .select("*")
                .eq("city", city_key)
                .order("month_year", desc=False)
                .execute()
            )
            all_rows = full_resp.data or cached_rows
        except Exception:
            all_rows = cached_rows

        return jsonify({
            "status":  "cached",
            "city":    city_name,
            "bbox":    bbox,
            "months":  len(all_rows),
            "data":    all_rows,
        }), 200

    # --- Step 3b: Cache MISS → fire background thread -------------------
    task_id = str(uuid.uuid4())
    store[task_id] = {
        "status":   "pending",
        "progress": 0,
        "city":     city_name,
        "result":   None,
        "error":    None,
        "created_at": datetime.utcnow().isoformat(),
    }

    thread = threading.Thread(
        target=process_city_data,
        args=(task_id, city_name, bbox, store, supabase),
        daemon=True,
        name=f"gee-{task_id[:8]}",
    )
    thread.start()
    logger.info("Spawned GEE task %s for city '%s'", task_id, city_name)

    return jsonify({
        "status":  "pending",
        "task_id": task_id,
        "city":    city_name,
        "message": "Satellite data fetch started. Poll /api/task-status/<task_id> for progress.",
    }), 202


# ---------------------------------------------------------------------------
# Route 2 — Poll task status
# ---------------------------------------------------------------------------

@audit_bp.route("/api/task-status/<task_id>", methods=["GET"])
def task_status(task_id: str):
    """
    GET /api/task-status/<task_id>

    Returns the current state of an async GEE task:
      - status:   pending | running | complete | failed
      - progress: 0-100
      - result:   list of upserted rows (only when complete)
      - error:    error message (only when failed)
    """
    store = _task_store(current_app._get_current_object())

    task = store.get(task_id)
    if task is None:
        return jsonify({"error": f"Task '{task_id}' not found."}), 404

    return jsonify({
        "task_id":  task_id,
        "status":   task["status"],
        "progress": task["progress"],
        "city":     task.get("city"),
        "result":   task.get("result"),
        "error":    task.get("error"),
    }), 200
