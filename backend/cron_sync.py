import os
import sys
import time
import logging
import subprocess
import requests
from dotenv import load_dotenv
from supabase import create_client

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("cron_sync")

# Load environment variables
load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:8000")

def is_server_running(url):
    """Check if the server is running by hitting the root endpoint."""
    try:
        response = requests.get(url, timeout=3)
        return response.status_code == 200
    except requests.RequestException:
        return False

def start_backend_server():
    """Start the Flask backend app as a subprocess and wait for it to be ready."""
    logger.info("Starting Flask backend server locally...")
    # Find app.py path relative to this script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    app_path = os.path.join(script_dir, "app.py")
    
    # Start app.py using the current python executable
    process = subprocess.Popen(
        [sys.executable, app_path],
        cwd=script_dir,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL
    )
    
    # Wait for the server to become responsive
    max_retries = 15
    for i in range(max_retries):
        if is_server_running(BACKEND_URL):
            logger.info("✅ Backend server is up and running.")
            return process
        logger.info(f"Waiting for backend server to start (attempt {i+1}/{max_retries})...")
        time.sleep(2)
        
    # If it failed to start, terminate the process
    process.terminate()
    process.wait()
    raise RuntimeError("Failed to start backend server locally. Make sure app.py can run without errors.")

def run_sync():
    if not SUPABASE_URL or not SUPABASE_KEY:
        logger.error("SUPABASE_URL and SUPABASE_KEY must be set in environment or .env file.")
        sys.exit(1)

    # 1. Initialize Supabase client and get list of cities
    logger.info("Initializing Supabase client...")
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
        cities_resp = supabase.table("cities").select("name").execute()
        cities = [row["name"] for row in cities_resp.data]
        logger.info(f"Found {len(cities)} cities in the database: {', '.join(cities)}")
    except Exception as e:
        logger.error(f"Failed to fetch cities from Supabase: {e}")
        sys.exit(1)

    if not cities:
        logger.info("No cities found in database. Nothing to sync.")
        return

    # 2. Start the local server if needed
    spawned_process = None
    if BACKEND_URL == "http://localhost:8000" or BACKEND_URL == "http://127.0.0.1:8000":
        if not is_server_running(BACKEND_URL):
            try:
                spawned_process = start_backend_server()
            except Exception as e:
                logger.error(f"Error starting backend: {e}")
                sys.exit(1)
        else:
            logger.info("Backend server is already running.")

    # 3. Trigger audit sync for each city
    failed_cities = []
    
    for city_name in cities:
        logger.info(f"🚀 Triggering audit for {city_name} (force=true)...")
        try:
            # Call trigger endpoint
            trigger_url = f"{BACKEND_URL}/api/environmental-audit/{city_name}?force=true"
            response = requests.get(trigger_url, timeout=10)
            
            if response.status_code not in [200, 202]:
                logger.error(f"❌ Failed to trigger audit for {city_name}. Response: {response.text}")
                failed_cities.append(city_name)
                continue
                
            res_data = response.json()
            
            # If it was already cached and we somehow got cached response, skip polling
            if res_data.get("status") == "cached":
                logger.info(f"✅ {city_name} is already cached.")
                continue
                
            task_id = res_data.get("task_id")
            if not task_id:
                logger.error(f"❌ No task_id returned for {city_name}")
                failed_cities.append(city_name)
                continue
                
            # Poll task status
            status_url = f"{BACKEND_URL}/api/task-status/{task_id}"
            logger.info(f"Task ID: {task_id}. Polling status...")
            
            while True:
                time.sleep(5)
                status_resp = requests.get(status_url, timeout=5)
                if status_resp.status_code != 200:
                    logger.error(f"❌ Error fetching status for task {task_id}")
                    failed_cities.append(city_name)
                    break
                    
                status_data = status_resp.json()
                status = status_data.get("status")
                progress = status_data.get("progress", 0)
                
                logger.info(f"[{city_name}] Status: {status} | Progress: {progress}%")
                
                if status == "complete":
                    logger.info(f"✅ Successfully synced data for {city_name}.")
                    break
                elif status == "failed":
                    logger.error(f"❌ Sync failed for {city_name}. Error: {status_data.get('error')}")
                    failed_cities.append(city_name)
                    break
                    
        except Exception as e:
            logger.error(f"❌ Exception during sync for {city_name}: {e}")
            failed_cities.append(city_name)

    # 4. Clean up the spawned server process
    if spawned_process:
        logger.info("Stopping local backend server...")
        spawned_process.terminate()
        spawned_process.wait()
        logger.info("Backend server stopped.")

    if failed_cities:
        logger.error(f"Sync finished with errors. Failed cities: {', '.join(failed_cities)}")
        sys.exit(1)
    else:
        logger.info("🎉 All cities synchronized successfully!")
        sys.exit(0)

if __name__ == "__main__":
    run_sync()
