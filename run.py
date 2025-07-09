# run.py
"""
Entry point for the Kern-Energy-Nexus application.

This script is responsible for loading the environment, creating the Flask app
from the app factory, and launching a production-grade WSGI server (Waitress).

For development, it is recommended to use the Flask CLI:
> flask run

This allows for use of the interactive debugger and reloader.
"""

import os
from dotenv import load_dotenv
import waitress
from app import create_app

def main() -> None:
    """
    Application entry point.
    Loads environment, creates app, and serves it.
    """
    load_dotenv()

    # Create the Flask app instance using the app factory
    app = create_app()

    # --- DEBUG: Force host to 0.0.0.0 ---
    host = "0.0.0.0"
    port = int(os.getenv("PORT", 5000))
    threads = int(os.getenv("W_THREADS", 4))
    
    # Get the application environment
    environment = os.getenv('FLASK_ENV', 'development')

    print(f"Starting server in {environment} mode.")
    
    print(f"Serving on http://{host}:{port} with {threads} threads.")
    waitress.serve(app, host=host, port=port, threads=threads)

if __name__ == "__main__":
    main()
