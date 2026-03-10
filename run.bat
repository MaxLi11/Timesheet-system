@echo off
echo Starting Timesheet Application...

:: Start Backend
start "Backend Server" cmd /k "cd backend && ..\.venv\Scripts\python -m uvicorn main:app --reload --port 8000"

:: Start Frontend
start "Frontend Dev" cmd /k "cd frontend && npm run dev"

echo Application launched! 
echo Backend running on http://localhost:8000
echo Frontend running on http://localhost:5173
echo Please open http://localhost:5173 in your browser.
pause
