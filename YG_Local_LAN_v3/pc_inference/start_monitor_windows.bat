@echo off
cd /d "%~dp0"
".venv\Scripts\python.exe" monitor_lan.py
if errorlevel 1 pause
