@echo off
set PROJECT_ROOT=%~dp0
cd /d %PROJECT_ROOT%
echo Starting Timesheet Application in %PROJECT_ROOT%...

:: Ensure dependencies are installed (first time only or after update)
echo Verifying Python dependencies...
.venv\Scripts\python -m pip install -r requirements.txt

:: Start Backend in a new window
echo Starting Backend Server...
start "Backend Server" cmd /c ".venv\Scripts\python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000"

:: Start Frontend in a new window
echo Starting Frontend Dev...
cd frontend
start "Frontend Dev" cmd /c "npm run dev"

echo.
echo ==================================================
echo Application launched! 
echo.
echo Backend running on: http://127.0.0.1:8000
echo Frontend running on: http://localhost:5173
echo.
echo Please open http://localhost:5173 in your browser.
echo 如果上传失败，请确保后台黑色窗口没有报错。
echo ==================================================
echo.
pause
