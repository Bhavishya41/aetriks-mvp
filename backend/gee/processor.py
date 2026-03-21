import ee
import os
import time
import logging
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta

logger = logging.getLogger(__name__)


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


def _get_month_range(year: int, month: int):
    """Return ISO date strings for the start and end of a given month."""
    start = datetime(year, month, 1)
    # End is the first day of the next month
    end = start + relativedelta(months=1)
    return start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d")


def _fetch_no2_mean(bbox, start_date: str, end_date: str) -> float | None:
    """Fetch mean NO₂ column density (mol/m²) over bbox for a date range."""
    try:
        region = ee.Geometry.BBox(bbox["west"], bbox["south"], bbox["east"], bbox["north"])
        collection = (
            ee.ImageCollection("COPERNICUS/S5P/OFFL/L3_NO2")
            .filterDate(start_date, end_date)
            .filterBounds(region)
            .select("NO2_column_number_density")
        )
        if collection.size().getInfo() == 0:
            return None
        mean_image = collection.mean()
        stats = mean_image.reduceRegion(
            reducer=ee.Reducer.mean(), geometry=region, scale=1000, maxPixels=1e9
        )
        val = stats.getInfo().get("NO2_column_number_density")
        # Convert mol/m² → µg/m³ (approx multiply by 1e6 for display)
        return round(val * 1e6, 4) if val is not None else None
    except Exception as exc:
        logger.warning("NO₂ fetch failed (%s – %s): %s", start_date, end_date, exc)
        return None


def _fetch_temp_mean(bbox, start_date: str, end_date: str) -> float | None:
    """Fetch mean daytime Land Surface Temperature (°C) over bbox."""
    try:
        region = ee.Geometry.BBox(bbox["west"], bbox["south"], bbox["east"], bbox["north"])
        collection = (
            ee.ImageCollection("MODIS/061/MOD11A2")
            .filterDate(start_date, end_date)
            .filterBounds(region)
            .select("LST_Day_1km")
        )
        if collection.size().getInfo() == 0:
            return None
        mean_image = collection.mean()
        stats = mean_image.reduceRegion(
            reducer=ee.Reducer.mean(), geometry=region, scale=1000, maxPixels=1e9
        )
        val = stats.getInfo().get("LST_Day_1km")
        # MODIS LST scale factor: ×0.02, convert Kelvin → Celsius
        return round(val * 0.02 - 273.15, 2) if val is not None else None
    except Exception as exc:
        logger.warning("Temp fetch failed (%s – %s): %s", start_date, end_date, exc)
        return None


def _fetch_ndvi_mean(bbox, start_date: str, end_date: str) -> float | None:
    """Fetch mean NDVI over bbox."""
    try:
        region = ee.Geometry.BBox(bbox["west"], bbox["south"], bbox["east"], bbox["north"])
        collection = (
            ee.ImageCollection("MODIS/061/MOD13A1")
            .filterDate(start_date, end_date)
            .filterBounds(region)
            .select("NDVI")
        )
        if collection.size().getInfo() == 0:
            return None
        mean_image = collection.mean()
        stats = mean_image.reduceRegion(
            reducer=ee.Reducer.mean(), geometry=region, scale=500, maxPixels=1e9
        )
        val = stats.getInfo().get("NDVI")
        # MODIS NDVI scale factor: ×0.0001
        return round(val * 0.0001, 4) if val is not None else None
    except Exception as exc:
        logger.warning("NDVI fetch failed (%s – %s): %s", start_date, end_date, exc)
        return None


def process_city_data(task_id: str, city_name: str, bbox: dict, task_store: dict, supabase):
    """
    Background task: fetch 12 months of satellite data for a city and upsert
    results into the Supabase `ward_environmental_data` table.

    Args:
        task_id:    UUID string identifying this task in task_store.
        city_name:  Human-readable city name (used as the DB partition key).
        bbox:       Dict with keys north, south, east, west (decimal degrees).
        task_store: Shared in-memory dict for task status updates.
        supabase:   Initialized supabase-py client.
    """
    task_store[task_id].update({"status": "running", "progress": 0, "result": None, "error": None})

    try:
        _initialize_gee()
    except EnvironmentError as exc:
        logger.error("GEE init failed: %s", exc)
        task_store[task_id].update({"status": "failed", "error": str(exc)})
        return

    # Build list of (year, month) for the past 12 months (oldest first)
    today = datetime.utcnow()
    months = []
    for offset in range(11, -1, -1):
        target = today - relativedelta(months=offset)
        months.append((target.year, target.month))

    total = len(months)
    rows_upserted = []

    for idx, (year, month) in enumerate(months):
        month_label = f"{year}-{month:02d}"
        logger.info("[%s] Fetching data for %s month=%s …", task_id[:8], city_name, month_label)

        start_date, end_date = _get_month_range(year, month)

        no2   = _fetch_no2_mean(bbox, start_date, end_date)
        temp  = _fetch_temp_mean(bbox, start_date, end_date)
        ndvi  = _fetch_ndvi_mean(bbox, start_date, end_date)

        row = {
            "city":       city_name.lower().strip(),
            "month_year": month_label,
            "no2_mean":   no2,
            "temp_mean":  temp,
            "ndvi_mean":  ndvi,
        }

        try:
            supabase.table("ward_environmental_data").upsert(
                row, on_conflict="city,month_year"
            ).execute()
            rows_upserted.append(row)
        except Exception as exc:
            logger.error("Supabase upsert failed for %s: %s", month_label, exc)
            # Continue — don't abort the whole job for one month's failure

        progress = round(((idx + 1) / total) * 100)
        task_store[task_id]["progress"] = progress

    task_store[task_id].update({
        "status":   "complete",
        "progress": 100,
        "result":   rows_upserted,
    })
    logger.info("[%s] ✅ Done. %d months upserted for '%s'.", task_id[:8], len(rows_upserted), city_name)
