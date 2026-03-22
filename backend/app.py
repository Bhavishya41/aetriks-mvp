import os
import logging
from flask import Flask, jsonify
from flask_cors import CORS
from supabase import create_client, Client
from dotenv import load_dotenv

from routes.audit import audit_bp
from routes.forecast import forecast_bp
from routes.panel import panel_bp
from routes.chat import chat_bp

# ── Configuration ──────────────────────────────────────────────────────────
load_dotenv()
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

# ── App setup ───────────────────────────────────────────────────────────────
app = Flask(__name__)
CORS(app)  # Allow Vite frontend (localhost:5173) to call this API

# ── Supabase client (attached to app so Blueprints can access it) ────────────
supabase_url: str = os.environ.get("SUPABASE_URL")
supabase_key: str = os.environ.get("SUPABASE_KEY")

if not supabase_url or not supabase_key:
    raise EnvironmentError("SUPABASE_URL and SUPABASE_KEY must be set in .env")

app.supabase: Client = create_client(supabase_url, supabase_key)

# ── Blueprints ───────────────────────────────────────────────────────────────
app.register_blueprint(audit_bp)
app.register_blueprint(forecast_bp)
app.register_blueprint(panel_bp)
app.register_blueprint(chat_bp)

# ── Core routes ─────────────────────────────────────────────────────────────

@app.route("/")
def home():
    return jsonify({"message": "Health Sentinel API is running ✅", "version": "1.0"})


# Ward data is now returned relationally via GET /api/city-health/<city_name>


# ── Entrypoint ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    port = int(os.environ.get("PORT",8000))
    app.run(host='0.0.0.0',port=port)