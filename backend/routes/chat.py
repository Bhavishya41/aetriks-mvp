import os
import logging
from collections import defaultdict

from flask import Blueprint, jsonify, request, current_app
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

# Configure Gemini once at import time
_api_key = os.environ.get("GEMINI_API_KEY")
if _api_key:
    genai.configure(api_key=_api_key)

chat_bp = Blueprint("chat", __name__)


def _get_city_summary(city_name: str, supabase) -> dict:
    """
    Fetch the 12-month averaged LST, AQI, NDVI and simple trend
    for the given city from Supabase.
    Returns a dict with keys: lst_avg, aqi_avg, ndvi_avg, lst_trend, next_lst.
    Falls back to N/A strings if data is unavailable.
    """
    try:
        city_key = city_name.lower().strip()
        city_resp = (
            supabase.table("cities")
            .select("id,name")
            .eq("name", city_key)
            .limit(1)
            .execute()
        )
        if not city_resp.data:
            return {}

        city_id = city_resp.data[0]["id"]

        wards_resp = (
            supabase.table("wards")
            .select("id")
            .eq("city_id", city_id)
            .execute()
        )
        ward_ids = [w["id"] for w in (wards_resp.data or [])]
        if not ward_ids:
            return {}

        env_resp = (
            supabase.table("ward_environment")
            .select("year,month,temp,air_quality,vegetation")
            .in_("ward_id", ward_ids)
            .execute()
        )
        env_data = env_resp.data or []
        if not env_data:
            return {}

        # Average across wards per month
        monthly: dict = defaultdict(lambda: {"temp": [], "aqi": [], "ndvi": []})
        for row in env_data:
            key = (row["year"], row["month"])
            if row.get("temp") is not None:
                monthly[key]["temp"].append(float(row["temp"]))
            if row.get("air_quality") is not None:
                monthly[key]["aqi"].append(float(row["air_quality"]))
            if row.get("vegetation") is not None:
                monthly[key]["ndvi"].append(float(row["vegetation"]))

        sorted_keys = sorted(monthly.keys())

        def avg(lst):
            return round(sum(lst) / len(lst), 2) if lst else None

        lst_vals = [avg(monthly[k]["temp"]) for k in sorted_keys]
        aqi_vals = [avg(monthly[k]["aqi"]) for k in sorted_keys]
        ndvi_vals = [avg(monthly[k]["ndvi"]) for k in sorted_keys]

        non_null_lst = [v for v in lst_vals if v is not None]
        non_null_aqi = [v for v in aqi_vals if v is not None]
        non_null_ndvi = [v for v in ndvi_vals if v is not None]

        lst_avg = round(sum(non_null_lst) / len(non_null_lst), 2) if non_null_lst else "N/A"
        aqi_avg = round(sum(non_null_aqi) / len(non_null_aqi), 2) if non_null_aqi else "N/A"
        ndvi_avg = round(sum(non_null_ndvi) / len(non_null_ndvi), 4) if non_null_ndvi else "N/A"

        # Simple trend: last value vs second-last
        lst_trend = "stable"
        if len(non_null_lst) >= 2:
            diff = non_null_lst[-1] - non_null_lst[-2]
            lst_trend = f"rising (+{diff:.2f}°C)" if diff > 0 else f"falling ({diff:.2f}°C)"

        # Simple linear forecast: last value ×1.01
        next_lst = round(non_null_lst[-1] * 1.01, 2) if non_null_lst else "N/A"

        return {
            "lst_avg": lst_avg,
            "aqi_avg": aqi_avg,
            "ndvi_avg": ndvi_avg,
            "lst_trend": lst_trend,
            "next_lst": next_lst,
        }
    except Exception as exc:
        logger.warning("_get_city_summary failed: %s", exc)
        return {}


@chat_bp.route("/api/chat", methods=["POST"])
def chat():
    """
    POST /api/chat
    Body: { "message": str, "city": str, "metrics": list[str] }
    Returns: { "reply": str }
    """
    if not _api_key:
        return jsonify({"error": "GEMINI_API_KEY not configured on server."}), 500

    body = request.get_json(silent=True) or {}
    user_message = (body.get("message") or "").strip()
    city = (body.get("city") or "unknown").strip()
    metrics = body.get("metrics") or ["LST", "NDVI", "NO2"]

    if not user_message:
        return jsonify({"error": "No message provided."}), 400

    # Harvest city context
    supabase = current_app.supabase
    ctx = _get_city_summary(city, supabase)

    lst_avg   = ctx.get("lst_avg",  "N/A")
    aqi_avg   = ctx.get("aqi_avg",  "N/A")
    ndvi_avg  = ctx.get("ndvi_avg", "N/A")
    lst_trend = ctx.get("lst_trend", "stable")
    next_lst  = ctx.get("next_lst",  "N/A")

    metrics_str = ", ".join(metrics) if metrics else "LST, NDVI, NO2"

    system_instruction = (
        f"You are Sentinel AI Analyst for NagarDrishti, an urban environmental intelligence platform. "
        f"The current city is {city.title()}. "
        f"Active monitoring metrics: {metrics_str}. "
        f"12-month average temperature (LST): {lst_avg}°C, trend: {lst_trend}. "
        f"12-month average AQI (NO2 proxy): {aqi_avg} µg/m³. "
        f"12-month average NDVI (vegetation): {ndvi_avg}. "
        f"Next month temperature prediction: {next_lst}°C. "
        f"Answer the user's question concisely and professionally in 2-4 sentences. "
        f"Do not use markdown formatting. Speak as a data-driven analyst."
    )

    try:
        model = genai.GenerativeModel(
            model_name="gemini-2.0-flash",
            system_instruction=system_instruction,
            generation_config={"temperature": 0.4, "max_output_tokens": 300},
        )
        response = model.generate_content(user_message)
        reply = response.text.strip()
    except Exception as exc:
        logger.error("Gemini chat error: %s", exc)
        return jsonify({"error": "Gemini request failed. Please try again."}), 500

    return jsonify({"reply": reply})
