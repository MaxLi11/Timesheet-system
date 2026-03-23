@echo off
REM Feishu Service Development Server
REM 飞书服务开发服务器

echo Starting Feishu Timesheet Sync Service...
echo.

REM Activate virtual environment
call venv\Scripts\activate.bat

REM Run FastAPI with auto-reload
uvicorn app.main:app --reload --port 8001

pause
