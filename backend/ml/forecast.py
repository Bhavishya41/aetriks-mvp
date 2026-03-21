"""
ml/forecast.py
--------------
Scikit-Learn linear regression forecasting engine.
Predicts the next month's environmental metrics (temp, NO2, NDVI) based on
the previous 12 months for a given ward.
"""

import logging
import numpy as np
from sklearn.linear_model import LinearRegression

logger = logging.getLogger(__name__)

# Thresholds for Future Hotspot detection
HOTSPOT_TEMP_C = 42.0
HOTSPOT_NO2_PROXY_UG = 50.0  # Just a proxy threshold (µg/m³)


def predict_next_month(ward_id: int, supabase) -> dict:
    """
    Fetch up to 12 historical entries for ward_id, sort them chronologically,
    and predict the $X=N+1$ value using Linear Regression for each metric.

    Returns:
    {
        "temp":            float | None,
        "air_quality":     float | None,
        "vegetation":      float | None,
        "confidence":      float | None,  # Average R^2
        "is_hotspot":      bool
    }
    """
    try:
        # Fetch the last 12 chronological entries
        resp = (
            supabase.table("ward_environment")
            .select("year,month,temp,air_quality,vegetation")
            .eq("ward_id", ward_id)
            .order("year", desc=False)
            .order("month", desc=False)
            .limit(12)
            .execute()
        )
    except Exception as exc:
        logger.error("Forecast fetch failed for ward_id=%s: %s", ward_id, exc)
        return _empty_forecast()

    rows = resp.data
    if not rows or len(rows) < 3:
        # Not enough data points to do a meaningful regression
        # Could do an average fallback, but the requirements specify LinearRegression
        return _empty_forecast()

    # Create sequence X = [1, 2, ..., N]
    X = np.array(range(1, len(rows) + 1)).reshape(-1, 1)
    X_next = np.array([[len(rows) + 1]])

    # Extract sequences for Y
    y_temp_raw = [r.get("temp") for r in rows]
    y_air_raw  = [r.get("air_quality") for r in rows]
    y_veg_raw  = [r.get("vegetation") for r in rows]

    temp_pred, temp_r2 = _regress(X, X_next, y_temp_raw)
    air_pred, air_r2   = _regress(X, X_next, y_air_raw)
    veg_pred, veg_r2   = _regress(X, X_next, y_veg_raw)

    # Average the R^2 scores for the metrics that were successfully modeled
    r2_scores = [score for score in (temp_r2, air_r2, veg_r2) if score is not None]
    avg_confidence = sum(r2_scores) / len(r2_scores) if r2_scores else None
    if avg_confidence is not None:
        avg_confidence = round(avg_confidence, 2)

    # Hotspot Detection
    is_hotspot = False
    if temp_pred is not None and temp_pred > HOTSPOT_TEMP_C:
        is_hotspot = True
    if air_pred is not None and air_pred > HOTSPOT_NO2_PROXY_UG:
        is_hotspot = True

    return {
        "temp":        temp_pred,
        "air_quality": air_pred,
        "vegetation":  veg_pred,
        "confidence":  avg_confidence,
        "is_hotspot":  is_hotspot,
    }


def _regress(X, X_next, y_raw):
    """
    Fit a LinearRegression model on X and y, handling missing (None) values
    in the y_raw list by removing the corresponding X.
    Returns (prediction_for_X_next (rounded to 2 decimal places), R^2_score).
    """
    # Filter out None values
    valid_pairs = [(x[0], y) for x, y in zip(X, y_raw) if y is not None]

    # Need at least 2 points to draw a line
    if len(valid_pairs) < 2:
        return None, None

    X_filtered = np.array([p[0] for p in valid_pairs]).reshape(-1, 1)
    y_filtered = np.array([p[1] for p in valid_pairs])

    model = LinearRegression()
    model.fit(X_filtered, y_filtered)

    # R^2 score
    r2 = model.score(X_filtered, y_filtered)
    # Predict next
    pred = model.predict(X_next)[0]

    return round(float(pred), 2), r2


def _empty_forecast() -> dict:
    """Return an empty forecast structure when prediction is not possible."""
    return {
        "temp":        None,
        "air_quality": None,
        "vegetation":  None,
        "confidence":  None,
        "is_hotspot":  False,
    }
