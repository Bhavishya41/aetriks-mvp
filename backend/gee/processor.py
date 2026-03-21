"""
gee/processor.py
----------------
Background pipeline task:
  City Init → Ward Grid → 12-Month GEE Fetch → ward_environment Upsert

Tables used (must exist in Supabase):
  cities          (id SERIAL, name TEXT UNIQUE, bbox JSONB)
  wards           (id SERIAL, city_id INT, name TEXT, boundary_json JSONB, UNIQUE(city_id,name))
  ward_environment(id SERIAL, ward_id INT, month INT, year INT,
                   temp FLOAT, air_quality FLOAT, vegetation FLOAT,
                   is_anomaly BOOLEAN, health_risk_score INT,
                   UNIQUE(ward_id, month, year))
"""

import ee
import os
import logging
from datetime import datetime
from dateutil.relativedelta import relativedelta

from gee.grid import create_fishnet

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# GEE Initialisation
# ─────────────────────────────────────────────────────────────────────────────

def _initialize_gee():
    """Initialize GEE with service account credentials from environment."""
    service_account = os.environ.get("GEE_SERVICE_ACCOUNT")
    key_file = os.environ.get("GEE_KEY_FILE", "gee-key.json")

    if not service_account or not os.path.exists(key_file):
        raise EnvironmentError(
            f"GEE credentials missing. "
            f"Ensure GEE_SERVICE_ACCOUNT and GEE_KEY_FILE are set, "
            f"and that '{key_file}' exists."
        )

    credentials = ee.ServiceAccountCredentials(service_account, key_file)
    ee.Initialize(credentials)
    logger.info("✅ GEE initialized with service account: %s", service_account)


# ─────────────────────────────────────────────────────────────────────────────
# Date Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _get_month_range(year: int, month: int):
    """Return ISO date strings for the start and end of a given month."""
    start = datetime(year, month, 1)
    end = start + relativedelta(months=1)
    return start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d")


# ─────────────────────────────────────────────────────────────────────────────
# GEE Fetch Helpers (per-ward bbox)
# ─────────────────────────────────────────────────────────────────────────────

def _ee_region(bbox: dict):
    """Build an ee.Geometry.BBox from a bbox dict."""
    return ee.Geometry.BBox(
        float(bbox["west"]),
        float(bbox["south"]),
        float(bbox["east"]),
        float(bbox["north"]),
    )


def _fetch_no2_mean(bbox: dict, start_date: str, end_date: str) -> float | None:
    """Mean NO₂ column density (mol/m²) scaled to µg/m³ proxy."""
    try:
        region = _ee_region(bbox)
        col = (
            ee.ImageCollection("COPERNICUS/S5P/OFFL/L3_NO2")
            .filterDate(start_date, end_date)
            .filterBounds(region)
            .select("NO2_column_number_density")
        )
        if col.size().getInfo() == 0:
            return None
        stats = col.mean().reduceRegion(
            reducer=ee.Reducer.mean(), geometry=region, scale=1000, maxPixels=1e9
        )
        val = stats.getInfo().get("NO2_column_number_density")
        return float(round(val * 1e6, 4)) if val is not None else None
    except Exception as exc:
        logger.warning("NO₂ fetch failed (%s – %s): %s", start_date, end_date, exc)
        return None


def _fetch_temp_mean(bbox: dict, start_date: str, end_date: str) -> float | None:
    """Mean daytime LST (°C) from MODIS MOD11A2."""
    try:
        region = _ee_region(bbox)
        col = (
            ee.ImageCollection("MODIS/061/MOD11A2")
            .filterDate(start_date, end_date)
            .filterBounds(region)
            .select("LST_Day_1km")
        )
        if col.size().getInfo() == 0:
            return None
        stats = col.mean().reduceRegion(
            reducer=ee.Reducer.mean(), geometry=region, scale=1000, maxPixels=1e9
        )
        val = stats.getInfo().get("LST_Day_1km")
        # MODIS scale factor ×0.02, convert K → °C
        return float(round(val * 0.02 - 273.15, 2)) if val is not None else None
    except Exception as exc:
        logger.warning("Temp fetch failed (%s – %s): %s", start_date, end_date, exc)
        return None


def _fetch_ndvi_mean(bbox: dict, start_date: str, end_date: str) -> float | None:
    """Mean NDVI from MODIS MOD13A1."""
    try:
        region = _ee_region(bbox)
        col = (
            ee.ImageCollection("MODIS/061/MOD13A1")
            .filterDate(start_date, end_date)
            .filterBounds(region)
            .select("NDVI")
        )
        if col.size().getInfo() == 0:
            return None
        stats = col.mean().reduceRegion(
            reducer=ee.Reducer.mean(), geometry=region, scale=500, maxPixels=1e9
        )
        val = stats.getInfo().get("NDVI")
        # MODIS NDVI scale factor ×0.0001
        return float(round(val * 0.0001, 4)) if val is not None else None
    except Exception as exc:
        logger.warning("NDVI fetch failed (%s – %s): %s", start_date, end_date, exc)
        return None


# ─────────────────────────────────────────────────────────────────────────────
# DB Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _get_or_create_city(supabase, city_name: str, bbox: dict) -> int:
    """
    Return the `id` (int) of the city row, inserting if absent.
    bbox is stored as JSONB: {"west":…, "south":…, "east":…, "north":…}
    """
    key = city_name.lower().strip()

    existing = (
        supabase.table("cities")
        .select("id")
        .eq("name", key)
        .limit(1)
        .execute()
    )
    if existing.data:
        city_id: int = existing.data[0]["id"]
        logger.info("City '%s' already in DB (id=%s)", key, city_id)
        return city_id

    bbox_json = {
        "west":  float(bbox["west"]),
        "south": float(bbox["south"]),
        "east":  float(bbox["east"]),
        "north": float(bbox["north"]),
    }
    inserted = (
        supabase.table("cities")
        .insert({"name": key, "bbox": bbox_json})
        .execute()
    )
    city_id = inserted.data[0]["id"]
    logger.info("Inserted new city '%s' with id=%s", key, city_id)
    return city_id


def _wards_exist(supabase, city_id: int) -> bool:
    """Return True if at least one ward row exists for this city."""
    resp = (
        supabase.table("wards")
        .select("id")
        .eq("city_id", city_id)
        .limit(1)
        .execute()
    )
    return bool(resp.data)


def _insert_wards(supabase, city_id: int, cells: list) -> dict:
    """
    Bulk-insert ward cells; return mapping  name → ward_id (int).
    Inserts in chunks of 100 to stay within Supabase payload limits.
    """
    CHUNK = 100
    name_to_id: dict = {}

    rows = [
        {
            "city_id":       city_id,
            "name":          cell["name"],
            "boundary_json": cell["boundary_json"],   # already plain dict
        }
        for cell in cells
    ]

    for i in range(0, len(rows), CHUNK):
        chunk = rows[i: i + CHUNK]
        resp = supabase.table("wards").insert(chunk).execute()
        for row in resp.data:
            name_to_id[row["name"]] = row["id"]

    logger.info("Inserted %d ward rows for city_id=%s", len(name_to_id), city_id)
    return name_to_id


def _get_ward_map(supabase, city_id: int) -> dict:
    """Return mapping  name → ward_id  for all wards of a city."""
    resp = (
        supabase.table("wards")
        .select("id,name")
        .eq("city_id", city_id)
        .execute()
    )
    return {row["name"]: row["id"] for row in resp.data}


# ─────────────────────────────────────────────────────────────────────────────
# Main Pipeline Entry Point
# ─────────────────────────────────────────────────────────────────────────────

def process_city_data(
    task_id: str,
    city_name: str,
    bbox: dict,
    task_store: dict,
    supabase,
):
    """
    Background pipeline task.

    Steps:
      1. Init GEE.
      2. Upsert city into `cities`.
      3. Generate fishnet + insert into `wards` (skipped if wards already exist).
      4. Loop last 12 months × every ward → fetch LST/NO₂/NDVI → upsert ward_environment.
    """
    task_store[task_id].update({"status": "running", "progress": 0, "result": None, "error": None})

    # ── Step 1: GEE init ────────────────────────────────────────────────────
    try:
        _initialize_gee()
    except EnvironmentError as exc:
        logger.error("GEE init failed: %s", exc)
        task_store[task_id].update({"status": "failed", "error": str(exc)})
        return

    # ── Step 2: City upsert ─────────────────────────────────────────────────
    try:
        city_id = _get_or_create_city(supabase, city_name, bbox)
    except Exception as exc:
        logger.error("City DB operation failed: %s", exc)
        task_store[task_id].update({"status": "failed", "error": str(exc)})
        return

    # ── Step 3: Ward grid ───────────────────────────────────────────────────
    if _wards_exist(supabase, city_id):
        logger.info("Wards already exist for city_id=%s — skipping grid generation", city_id)
        ward_map = _get_ward_map(supabase, city_id)
        cells = []  # we only need the bbox per ward — re-derive from DB or skip
        # Re-derive cell bboxes from boundary_json for the GEE fetch loop
        resp = (
            supabase.table("wards")
            .select("id,name,boundary_json")
            .eq("city_id", city_id)
            .execute()
        )
        ward_cells = [
            {
                "name":  row["name"],
                "ward_id": row["id"],
                "_bbox": _bbox_from_geojson(row["boundary_json"]),
            }
            for row in resp.data
        ]
    else:
        cells = create_fishnet(bbox, cell_size_m=500, max_cells=50)
        logger.info("Generated %d fishnet cells for city_id=%s", len(cells), city_id)
        try:
            ward_map = _insert_wards(supabase, city_id, cells)
        except Exception as exc:
            logger.error("Ward insert failed: %s", exc)
            task_store[task_id].update({"status": "failed", "error": str(exc)})
            return

        ward_cells = [
            {
                "name":    cell["name"],
                "ward_id": ward_map[cell["name"]],
                "_bbox":   cell["_bbox"],
            }
            for cell in cells
            if cell["name"] in ward_map
        ]

    # ── Step 4: 12-Month satellite loop ─────────────────────────────────────
    today = datetime.utcnow()
    months = []
    for offset in range(11, -1, -1):
        target = today - relativedelta(months=offset)
        months.append((target.year, target.month))

    total_ops = len(months) * max(len(ward_cells), 1)
    ops_done = 0
    rows_upserted = 0

    for year, month in months:
        start_date, end_date = _get_month_range(year, month)
        logger.info("[%s] Fetching %d-%02d for %d wards …", task_id[:8], year, month, len(ward_cells))

        for wc in ward_cells:
            ward_id  = wc["ward_id"]
            ward_bbox = wc["_bbox"]

            temp        = _fetch_temp_mean(ward_bbox, start_date, end_date)
            air_quality = _fetch_no2_mean(ward_bbox, start_date, end_date)
            vegetation  = _fetch_ndvi_mean(ward_bbox, start_date, end_date)

            row = {
                "ward_id":      int(ward_id),
                "month":        int(month),
                "year":         int(year),
                "temp":         temp,
                "air_quality":  air_quality,
                "vegetation":   vegetation,
                "is_anomaly":   False,
                "health_risk_score": None,
            }

            try:
                supabase.table("ward_environment").upsert(
                    row,
                    on_conflict="ward_id,month,year",
                ).execute()
                rows_upserted += 1
            except Exception as exc:
                logger.error(
                    "Upsert failed for ward_id=%s %d-%02d: %s",
                    ward_id, year, month, exc,
                )

            ops_done += 1
            task_store[task_id]["progress"] = int((ops_done / total_ops) * 100)

    task_store[task_id].update({
        "status":   "complete",
        "progress": 100,
        "result":   {"city_id": city_id, "wards": len(ward_cells), "rows_upserted": rows_upserted},
    })
    logger.info(
        "[%s] ✅ Done — %d env rows upserted for city '%s' (%d wards, 12 months).",
        task_id[:8], rows_upserted, city_name, len(ward_cells),
    )


# ─────────────────────────────────────────────────────────────────────────────
# Utility
# ─────────────────────────────────────────────────────────────────────────────

def _bbox_from_geojson(geojson: dict) -> dict:
    """
    Derive a bbox dict from a GeoJSON Polygon's coordinates.
    Handles both `{"type":"Polygon","coordinates":[…]}` and plain coordinate lists.
    """
    try:
        coords = geojson["coordinates"][0]  # outer ring
        xs = [c[0] for c in coords]
        ys = [c[1] for c in coords]
        return {
            "west":  float(min(xs)),
            "south": float(min(ys)),
            "east":  float(max(xs)),
            "north": float(max(ys)),
        }
    except Exception:
        # Fallback: return empty bbox — GEE fetch will return None gracefully
        return {"west": 0.0, "south": 0.0, "east": 0.0, "north": 0.0}
