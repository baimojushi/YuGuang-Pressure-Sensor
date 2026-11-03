"""python run.py (or packaged YGLocalInference.exe)"""
from __future__ import annotations
import logging
import uvicorn
from settings import Settings
from server import create_app

def main():
    settings = Settings.from_env()
    logging.basicConfig(level=logging.INFO)
    app = create_app(settings)
    logging.info("LAN inference: http://%s:%s/", settings.host, settings.port)
    logging.info("Model configured: %s", bool(settings.model_path))
    uvicorn.run(app, host=settings.host, port=settings.port,
                log_level="info", access_log=False)

if __name__ == "__main__":
    main()
