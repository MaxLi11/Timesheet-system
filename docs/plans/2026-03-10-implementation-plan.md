# Timesheet Application Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a web-based timesheet calculation and statistics system with persistence and D-drive isolation.

**Architecture:** Python (FastAPI) backend with SQLite for data persistence, React (Vite) frontend with ECharts for visualization. All environments (venv, node_modules) stay on the D drive.

**Tech Stack:** Python, FastAPI, Pandas, SQLAlchemy, SQLite, React, Vite, ECharts, Vanilla CSS.

---

### Task 1: Project Initialization & Backend Setup

**Files:**
- Create: `requirements.txt`
- Create: `backend/main.py`
- Create: `backend/database.py`

**Step 1: Create requirements.txt**
```text
fastapi
uvicorn
pandas
openpyxl
sqlalchemy
python-multipart
```

**Step 2: Initialize venv and install dependencies**
Run: `.venv\Scripts\pip install -r requirements.txt`

**Step 3: Setup database models and engine**
Define `Employee`, `Project`, and `TimeEntry` models in `backend/database.py`.

**Step 4: Create basic FastAPI shell**
Implement a health check endpoint in `backend/main.py`.

**Step 5: Commit**
```bash
git add requirements.txt backend/
git commit -m "feat: initialize backend and database setup"
```

### Task 2: Excel Parsing Logic

**Files:**
- Create: `backend/parser.py`
- Test: `tests/test_parser.py`

**Step 1: Write test for parser**
```python
import pandas as pd
from backend.parser import parse_timesheet

def test_parse_valid_excel():
    df = parse_timesheet("path/to/sample.xlsx")
    assert not df.empty
    assert "员工" in df.columns
```

**Step 2: Implement parser using Pandas**
Handle column mapping and basic data cleaning in `backend/parser.py`.

**Step 3: Verify tests pass**
Run: `pytest tests/test_parser.py`

**Step 4: Commit**
```bash
git add backend/parser.py tests/test_parser.py
git commit -m "feat: implement excel parsing logic"
```

### Task 3: Data Persistence & API

**Files:**
- Modify: `backend/main.py`
- Create: `backend/crud.py`

**Step 1: Implement CRUD for rolling updates**
Create logic to append new records and detect duplicates in `backend/crud.py`.

**Step 2: Implement Upload API**
Create `/upload` endpoint in `backend/main.py` using `python-multipart`.

**Step 3: Implement Statistics API**
Create `/stats` endpoint for multi-dimensional aggregation (week, month, etc.).

**Step 4: Commit**
```bash
git add backend/
git commit -m "feat: implement upload and statistics API"
```

### Task 4: Frontend Initialization

**Files:**
- [NEW] `frontend/` (via Vite)

**Step 1: Initialize Vite React app**
Run: `npm create vite@latest frontend -- --template react` in D drive.

**Step 2: Cleanup and setup Vanilla CSS**
Remove default assets and setup basic layout in `frontend/src/index.css`.

**Step 3: Install ECharts**
Run: `npm install echarts echarts-for-react` in `frontend/`.

**Step 4: Commit**
```bash
git add frontend/
git commit -m "feat: initialize frontend project"
```

### Task 5: Dashboard & Visualization

**Files:**
- Create: `frontend/src/components/Dashboard.jsx`
- Create: `frontend/src/components/Charts/`

**Step 1: Implement Chart components**
Create Bar, Line, Pie, Heatmap components using ECharts.

**Step 2: Implement Gantt/March chart**
Customize ECharts `custom` type for time-axis visualization.

**Step 3: Implement Filters component**
Dropdowns for Date, Project, Department with state synchronization.

**Step 4: Commit**
```bash
git add frontend/src/
git commit -m "feat: implement dashboard visualization"
```

### Task 6: Final Integration & One-Click Script

**Files:**
- Create: `run.bat`

**Step 1: Create background runner script**
`run.bat` should start both backend and frontend servers.

**Step 2: Final Verification**
Test the end-to-end flow with the provided sample Excel.

**Step 3: Commit**
```bash
git add run.bat
git commit -m "feat: add one-click run script"
```
