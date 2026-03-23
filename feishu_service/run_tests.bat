@echo off
REM Run Tests
REM 运行测试

echo Running tests...
echo.

REM Activate virtual environment
call venv\Scripts\activate.bat

REM Run pytest
pytest tests/ -v --cov=app

pause
