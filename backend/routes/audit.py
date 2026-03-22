"""
routes/audit.py
---------------
Blueprint: audit_bp

Routes
------
GET /api/environmental-audit/<city_name>
    Trigger (or return cached) 12-month satellite data pipeline for a city.
    Returns 200 (cached) or 202 + task_id (new background job).

GET /api/task-status/<task_id>
    Poll in-memory task progress.

GET /api/city-health/<city_name>?month=M&year=Y
    Joined response: ward boundaries + environment metrics for a given month.
    Defaults to the most recently completed month.
"""

import uuid
import threading
import logging
from datetime import datetime

import osmnx as ox
from flask import Blueprint, jsonify, request, current_app
from dateutil.relativedelta import relativedelta

from gee.processor import process_city_data

logger = logging.getLogger(__name__)
audit_bp = Blueprint("audit", __name__)


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _task_store(app) -> dict:
    """Return (and lazily create) the shared in-memory task store."""
    if not hasattr(app, "task_store"):
        app.task_store = {}
    return app.task_store


def _latest_month():
    """Return (month, year) for the most recently completed calendar month."""
    today = datetime.utcnow()
    last = today - relativedelta(months=1)
    return last.month, last.year


# ─────────────────────────────────────────────────────────────────────────────
# Route 1 — Trigger / check cache
# ─────────────────────────────────────────────────────────────────────────────

@audit_bp.route("/api/environmental-audit/<city_name>", methods=["GET"])
def environmental_audit(city_name: str):
    """
    GET /api/environmental-audit/<city_name>

    1. Geocode city → BBOX via osmnx.
    2. Check if city already has ward_environment rows for the current month
       (cache hit → 200).
    3. Cache miss → spawn background thread → 202 + task_id.
    """
    supabase = current_app.supabase
    store    = _task_store(current_app._get_current_object())

    # ── Geocode ──────────────────────────────────────────────────────────────
    try:
        gdf = ox.geocode_to_gdf(city_name)
    except Exception as exc:
        logger.warning("Geocoding failed for '%s': %s", city_name, exc)
        return jsonify({"error": f"City '{city_name}' not found.", "detail": str(exc)}), 404

    bounds = gdf.iloc[0].geometry.bounds   # (minx, miny, maxx, maxy)
    bbox = {
        "west":  float(bounds[0]),
        "south": float(bounds[1]),
        "east":  float(bounds[2]),
        "north": float(bounds[3]),
    }

    city_key = city_name.lower().strip()

    # ── Check cache: does this city already have wards stored in the DB? ──────
    # We consider a city "cached" if its wards exist — regardless of which
    # month the environment data was collected. This prevents the pipeline
    # from re-running (and the frontend from polling) every time the page
    # loads just because the stored data is from a past month.
    try:
        city_resp = (
            supabase.table("cities")
            .select("id")
            .eq("name", city_key)
            .limit(1)
            .execute()
        )

        if city_resp.data:
            city_id = city_resp.data[0]["id"]
            # City exists — check if it has at least one ward
            sample_ward = (
                supabase.table("wards")
                .select("id")
                .eq("city_id", city_id)
                .limit(1)
                .execute()
            )
            if sample_ward.data:
                # Wards are present → treat as fully cached, skip pipeline
                return jsonify({
                    "status":  "cached",
                    "city":    city_name,
                    "bbox":    bbox,
                    "message": "Data already exists. Use /api/city-health/<city_name> to fetch it.",
                }), 200
        else:
            city_id = None

    except Exception as exc:
        logger.error("Cache check failed: %s", exc)

    # ── Spawn background pipeline ─────────────────────────────────────────────
    task_id = str(uuid.uuid4())
    store[task_id] = {
        "status":     "pending",
        "progress":   0,
        "city":       city_name,
        "result":     None,
        "error":      None,
        "created_at": datetime.utcnow().isoformat(),
    }

    thread = threading.Thread(
        target=process_city_data,
        args=(task_id, city_name, bbox, store, supabase),
        daemon=True,
        name=f"gee-{task_id[:8]}",
    )
    thread.start()
    logger.info("Spawned GEE pipeline task %s for city '%s'", task_id, city_name)

    return jsonify({
        "status":  "pending",
        "task_id": task_id,
        "city":    city_name,
        "bbox":    bbox,
        "message": "Pipeline started. Poll /api/task-status/<task_id> for progress.",
    }), 202


# ─────────────────────────────────────────────────────────────────────────────
# Route 2 — Poll task status
# ─────────────────────────────────────────────────────────────────────────────

@audit_bp.route("/api/task-status/<task_id>", methods=["GET"])
def task_status(task_id: str):
    """
    GET /api/task-status/<task_id>

    Returns current state of an async GEE pipeline task.
    """
    store = _task_store(current_app._get_current_object())
    task  = store.get(task_id)

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


# ─────────────────────────────────────────────────────────────────────────────
# Route 3 — Joined city-health response
# ─────────────────────────────────────────────────────────────────────────────

@audit_bp.route("/api/city-health/<city_name>", methods=["GET"])
def city_health(city_name: str):
    """
    GET /api/city-health/<city_name>?month=M&year=Y

    Returns a list of ward features, each containing:
      - ward_id, ward_name
      - boundary_json  (GeoJSON Polygon)
      - temp           (LST °C)
      - air_quality    (NO₂ proxy µg/m³)
      - vegetation     (NDVI)
      - is_anomaly     (bool)
      - health_risk_score (int | null)

    Defaults to the previous calendar month if month/year are omitted.
    """
    supabase = current_app.supabase
    city_key = city_name.lower().strip()

    # ── Parse query params ─────────────────────────────────────────────────
    default_month, default_year = _latest_month()
    try:
        month = int(request.args.get("month", default_month))
        year  = int(request.args.get("year",  default_year))
    except ValueError:
        return jsonify({"error": "month and year must be integers."}), 400

    if not (1 <= month <= 12):
        return jsonify({"error": "month must be 1–12."}), 400

    # ── Look up city ───────────────────────────────────────────────────────
    try:
        city_resp = (
            supabase.table("cities")
            .select("id,name,bbox")
            .eq("name", city_key)
            .limit(1)
            .execute()
        )
    except Exception as exc:
        logger.error("City lookup failed: %s", exc)
        return jsonify({"error": "DB error during city lookup.", "detail": str(exc)}), 500

    if not city_resp.data:
        return jsonify({
            "error": f"City '{city_name}' not found in DB. "
                     f"Trigger /api/environmental-audit/{city_name} first."
        }), 404

    city_row = city_resp.data[0]
    city_id  = city_row["id"]

    # ── Fetch all wards for this city ──────────────────────────────────────
    try:
        wards_resp = (
            supabase.table("wards")
            .select("id,name,boundary_json")
            .eq("city_id", city_id)
            .execute()
        )
    except Exception as exc:
        logger.error("Wards fetch failed: %s", exc)
        return jsonify({"error": "DB error fetching wards.", "detail": str(exc)}), 500

    if not wards_resp.data:
        return jsonify({
            "error": "No wards found for this city. "
                     "The pipeline may still be running."
        }), 404

    ward_rows = wards_resp.data
    ward_ids  = [w["id"] for w in ward_rows]
    ward_map  = {w["id"]: w for w in ward_rows}  # id → ward row

    # ── Fetch ward_environment for the requested month/year ────────────────
    try:
        env_resp = (
            supabase.table("ward_environment")
            .select("ward_id,temp,air_quality,vegetation,is_anomaly,health_risk_score")
            .in_("ward_id", ward_ids)
            .eq("month", month)
            .eq("year", year)
            .execute()
        )
    except Exception as exc:
        logger.error("ward_environment fetch failed: %s", exc)
        return jsonify({"error": "DB error fetching environment data.", "detail": str(exc)}), 500

    env_map = {row["ward_id"]: row for row in (env_resp.data or [])}

    # ── Build joined feature list ──────────────────────────────────────────
    features = []
    for ward in ward_rows:
        wid = ward["id"]
        env = env_map.get(wid, {})
        features.append({
            "ward_id":           wid,
            "ward_name":         ward["name"],
            "boundary_json":     ward["boundary_json"],
            "temp":              env.get("temp"),
            "air_quality":       env.get("air_quality"),
            "vegetation":        env.get("vegetation"),
            "is_anomaly":        env.get("is_anomaly", False),
            "health_risk_score": env.get("health_risk_score"),
        })

    return jsonify({
        "city":     city_row["name"],
        "city_id":  city_id,
        "bbox":     city_row["bbox"],
        "month":    month,
        "year":     year,
        "count":    len(features),
        "features": features,
    }), 200
