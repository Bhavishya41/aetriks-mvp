import os
from flask import Flask, jsonify, request
from flask_cors import CORS
from supabase import create_client, Client
from dotenv import load_dotenv

# 1. Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app) # This allows your Vite frontend to talk to this server

# 2. Initialize Supabase
url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_KEY")
supabase: Client = create_client(url, key)

@app.route('/')
def home():
    return "Health Sentinel API is Running!"

# 3. Endpoint to fetch Ward Data from DB
@app.route('/api/wards', methods=['GET'])
def get_wards():
    # This fetches all rows from a table named 'wards' in Supabase
    response = supabase.table("wards").select("*").execute()
    return jsonify(response.data)

if __name__ == '__main__':
    # Run in debug mode so it restarts when you save changes
    app.run(port=8000)