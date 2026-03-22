import os
import json
import logging
from dotenv import load_dotenv

from google import genai
from google.genai import types
from ml.forecast import predict_next_month

logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()
api_key = os.environ.get("GEMINI_API_KEY")


def get_gemini_intervention(ward_id: str, supabase) -> dict:
    """
    Generate an environmental action plan using Gemini 2.5 Flash.
    Uses the new google-genai SDK (google.genai).
    ward_id is a UUID string as stored in Supabase.
    """
    if not api_key:
        logger.error("GEMINI_API_KEY is missing. Cannot fetch intervention.")
        return {"error": "GEMINI_API_KEY not set in environment."}

    # ── 1. Fetch Ward & City Names ────────────────────────────────────────────
    try:
        ward_resp = (
            supabase.table("wards")
            .select("id, name, city_id")
            .eq("id", ward_id)
            .limit(1)
            .execute()
        )
        if not ward_resp.data:
            raise ValueError(f"Ward {ward_id} not found.")

        ward_name = ward_resp.data[0]["name"]
        city_id   = ward_resp.data[0]["city_id"]

        city_resp = (
            supabase.table("cities")
            .select("id, name")
            .eq("id", city_id)
            .limit(1)
            .execute()
        )
        city_name = city_resp.data[0]["name"] if city_resp.data else "Unknown City"
    except Exception as e:
        logger.error("Failed to fetch ward/city metadata: %s", e)
        return {"error": "Failed to fetch geographic context."}

    # ── 2. Fetch 12-month env metrics ─────────────────────────────────────────
    try:
        env_resp = (
            supabase.table("ward_environment")
            .select("temp,air_quality,vegetation")
            .eq("ward_id", ward_id)
            .order("year", desc=True)
            .order("month", desc=True)
            .limit(12)
            .execute()
        )

        temps = [float(r["temp"])        for r in env_resp.data if r.get("temp")        is not None]
        no2s  = [float(r["air_quality"]) for r in env_resp.data if r.get("air_quality") is not None]
        ndvis = [float(r["vegetation"])  for r in env_resp.data if r.get("vegetation")  is not None]

        temp_min = round(min(temps), 2) if temps else "N/A"
        temp_max = round(max(temps), 2) if temps else "N/A"
        temp_avg = round(sum(temps) / len(temps), 2) if temps else "N/A"

        no2_min  = round(min(no2s), 2)  if no2s  else "N/A"
        no2_max  = round(max(no2s), 2)  if no2s  else "N/A"
        no2_avg  = round(sum(no2s) / len(no2s), 2) if no2s  else "N/A"

        ndvi_avg = round(sum(ndvis) / len(ndvis), 4) if ndvis else "N/A"
    except Exception as e:
        logger.error("Failed to aggregate historical data: %s", e)
        return {"error": "Failed to aggregate historical context."}

    # ── 3. ML forecast for next month ─────────────────────────────────────────
    forecast = predict_next_month(ward_id, supabase)

    # ── 4. Build prompt ───────────────────────────────────────────────────────
    sys_instruction = "You are an Urban Climate Scientist advising an Indian Municipality."
    prompt = f"""
I need a localized environmental action plan for the administrative ward below.
Analyze the historical data and ML-projected forecasts to devise specific urban strategies.

City: {city_name}
Ward: {ward_name}

12-Month Temperature (°C):
- Min: {temp_min} | Max: {temp_max} | Average: {temp_avg}

12-Month Air Quality — NO₂ Proxy (µg/m³):
- Min: {no2_min} | Max: {no2_max} | Average: {no2_avg}

Average Vegetation Index (NDVI):
- Average: {ndvi_avg}

ML-Predicted Next Month Risk Indicators:
- Temperature Projection: {forecast.get('temp', 'N/A')} °C
- NO₂ Projection: {forecast.get('air_quality', 'N/A')} µg/m³
- NDVI Projection (Vegetation): {forecast.get('vegetation', 'N/A')}
- ML Hotspot Flag Triggered: {forecast.get('is_hotspot', False)}

Return a JSON object with EXACTLY these keys (no markdown, no code fences):
{{
  "status_label": "e.g., Critical: Heat Island Detected",
  "risk_summary": "A 2-sentence explanation of the 12-month trend and its implications.",
  "immediate_actions": ["specific action 1", "specific action 2", "specific action 3"],
  "long_term_policy": "A policy-level recommendation for the municipality.",
  "health_warning": "A specific medical advisory for citizens of this ward."
}}
"""

    # ── 5. Call Gemini via new google.genai SDK ───────────────────────────────
    logger.info("Querying Gemini 2.5 Flash for ward_id=%s (%s, %s)…", ward_id, city_name, ward_name)
    try:
        client = genai.Client(api_key=api_key)

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=sys_instruction,
                response_mime_type="application/json",
                temperature=0.3,
            ),
        )

        insights_json = json.loads(response.text)
        logger.info("Gemini response received successfully for ward_id=%s", ward_id)
        return insights_json

    except json.JSONDecodeError as e:
        logger.error("Gemini returned non-JSON response: %s | raw: %s", e, getattr(response, 'text', ''))
        return {"error": "Gemini returned an invalid JSON response."}
    except Exception as e:
        logger.error("Gemini API call failed for ward_id=%s: %s", ward_id, e)
        return {"error": f"Gemini API error: {str(e)}"}
