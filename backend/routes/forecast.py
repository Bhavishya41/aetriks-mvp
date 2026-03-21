"""
routes/forecast.py
------------------
Blueprint: forecast_bp

Routes
------
GET /api/forecast/<city_name>
    Returns the predicted environmental metrics for the upcoming month for
    each ward in the city, using a Linear Regression model.
"""

import logging
from flask import Blueprint, jsonify, current_app

from ml.forecast import predict_next_month

logger = logging.getLogger(__name__)
forecast_bp = Blueprint("forecast", __name__)


@forecast_bp.route("/api/forecast/<city_name>", methods=["GET"])
def get_city_forecast(city_name: str):
    """
    GET /api/forecast/<city_name>

    1. Looks up city_id for city_name.
    2. Fetches all wards for the city.
    3. Iterates over wards, calling predict_next_month on each.
    4. Returns a Feature Collection (GeoJSON-like) containing the predictions
       and the "Future Hotspot" flags.
    """
    supabase = current_app.supabase
    city_key = city_name.lower().strip()

    # 1. Lookup city
    try:
        city_resp = (
            supabase.table("cities")
            .select("id,name,bbox")
            .eq("name", city_key)
            .limit(1)
            .execute()
        )
    except Exception as exc:
        logger.error("Forecast city lookup failed: %s", exc)
        return jsonify({"error": "DB error during city lookup.", "detail": str(exc)}), 500

    if not city_resp.data:
        return jsonify({"error": f"City '{city_name}' not found. Cannot forecast."}), 404

    city_row = city_resp.data[0]
    city_id  = city_row["id"]

    # 2. Fetch wards
    try:
        wards_resp = (
            supabase.table("wards")
            .select("id,name,boundary_json")
            .eq("city_id", city_id)
            .execute()
        )
    except Exception as exc:
        logger.error("Forecast wards fetch failed: %s", exc)
        return jsonify({"error": "DB error fetching wards.", "detail": str(exc)}), 500
        
    if not wards_resp.data:
        return jsonify({"error": "No wards found to forecast for."}), 404

    ward_rows = wards_resp.data

    # 3. Forecast per ward
    features = []
    for ward in ward_rows:
        ward_id = ward["id"]
        forecast_data = predict_next_month(ward_id, supabase)

        features.append({
            "ward_id":           ward_id,
            "ward_name":         ward["name"],
            "boundary_json":     ward["boundary_json"],
            
            # Forecast Output
            "predicted_temp":        forecast_data["temp"],
            "predicted_air_quality": forecast_data["air_quality"],
            "predicted_vegetation":  forecast_data["vegetation"],
            "confidence_score":      forecast_data["confidence"],
            "is_future_hotspot":     forecast_data["is_hotspot"],
        })

    return jsonify({
        "city":     city_row["name"],
        "city_id":  city_id,
        "bbox":     city_row["bbox"],
        "count":    len(features),
        "features": features,
    }), 200
