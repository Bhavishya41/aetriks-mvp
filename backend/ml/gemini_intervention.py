import os
import json
import logging
from datetime import datetime, timezone
from dotenv import load_dotenv

import google.generativeai as genai
from ml.forecast import predict_next_month

logger = logging.getLogger(__name__)

# Load environment variables (ensures GEMINI_API_KEY is available)
load_dotenv()
api_key = os.environ.get("GEMINI_API_KEY")
if api_key:
    genai.configure(api_key=api_key)

def get_gemini_intervention(ward_id: int, supabase) -> dict:
    """
    Generate an environmental action plan using Gemini, with a 24-hour cache.
    Uses 'ward_insights' table to cache responses.
    """
    if not api_key:
        logger.error("GEMINI_API_KEY is missing. Cannot fetch intervention.")
        return {"error": "GEMINI_API_KEY not set in environment."}

    # (Caching logic removed per user request: generate a new insight every time)

    # 2. Fetch Context Data
    # Fetch Ward & City Names
    try:
        ward_resp = supabase.table("wards").select("id, name, city_id").eq("id", ward_id).limit(1).execute()
        if not ward_resp.data:
            raise ValueError(f"Ward {ward_id} not found.")
        
        ward_name = ward_resp.data[0]["name"]
        city_id = ward_resp.data[0]["city_id"]

        city_resp = supabase.table("cities").select("id, name").eq("id", city_id).limit(1).execute()
        city_name = city_resp.data[0]["name"] if city_resp.data else "Unknown City"
    except Exception as e:
        logger.error("Failed to fetch ward/city metadata: %s", e)
        return {"error": "Failed to fetch geographic context."}

    # Fetch 12-month metrics
    try:
        env_resp = (
            supabase.table("ward_environment")
            .select("temp,air_quality")
            .eq("ward_id", ward_id)
            .order("year", desc=True)
            .order("month", desc=True)
            .limit(12)
            .execute()
        )
        
        temps = [float(r["temp"]) for r in env_resp.data if r.get("temp") is not None]
        no2s = [float(r["air_quality"]) for r in env_resp.data if r.get("air_quality") is not None]

        temp_min = round(min(temps), 2) if temps else "N/A"
        temp_max = round(max(temps), 2) if temps else "N/A"
        temp_avg = round(sum(temps) / len(temps), 2) if temps else "N/A"

        no2_min = round(min(no2s), 2) if no2s else "N/A"
        no2_max = round(max(no2s), 2) if no2s else "N/A"
        no2_avg = round(sum(no2s) / len(no2s), 2) if no2s else "N/A"
    except Exception as e:
        logger.error("Failed to aggregate historical data: %s", e)
        return {"error": "Failed to aggregate historical context."}

    # Fetch Forecast for Next Month
    forecast = predict_next_month(ward_id, supabase)

    # 3. Construct Prompt
    sys_instruction = "You are an Urban Climate Scientist for an Indian Municipality."
    prompt = f"""
I need a localized environmental action plan for the administrative ward below. 
You must analyze the historical data alongside the projected model forecasts to devise urban strategies.

City: {city_name}
Ward: {ward_name}

12-Month Temperature (°C):
- Min: {temp_min}
- Max: {temp_max}
- Average: {temp_avg}

12-Month Air Quality (NO2 Proxy µg/m³):
- Min: {no2_min}
- Max: {no2_max}
- Average: {no2_avg}

Predicted Next Month Risk Indicators:
- Temperature Projection: {forecast.get('temp', 'N/A')} °C
- NO2 Projection: {forecast.get('air_quality', 'N/A')} µg/m³
- NDVI Projection (Vegetation): {forecast.get('vegetation', 'N/A')}
- ML Hotspot Flag Triggered: {forecast.get('is_hotspot', False)}

Force JSON formulation. Return a JSON object mapped exactly to the following keys, with no extra code blocks or markdown wrappers:
{{
  "status_label": "e.g., Critical: Heat Island Detected",
  "risk_summary": "A 2-sentence explanation of the 12-month trend.",
  "immediate_actions": ["practical action 1", "practical action 2", "practical action 3"],
  "long_term_policy": "A policy-level suggestion (e.g., Mandatory white-reflective roofing for industrial sheds).",
  "health_warning": "A specific medical advisory for citizens (e.g., High respiratory risk for elderly between 2 PM - 5 PM)."
}}
"""

    logger.info("Querying Gemini for ward_id=%s...", ward_id)
    
    try:
        model = genai.GenerativeModel(
            model_name="gemini-2.5-flash",
            system_instruction=sys_instruction,
            generation_config={
                "response_mime_type": "application/json",
                "temperature": 0.3
            }
        )

        response = model.generate_content(prompt)
        insights_json = json.loads(response.text)
    except Exception as e:
        logger.error("Failed to generate or parse Gemini response: %s", e)
        return {"error": "Failed to generate valid insight from LLM."}

    # Returning fresh content


    return insights_json
