from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from . import database, parser, crud
import shutil
import os

app = FastAPI(title="Timesheet Analysis API")

# Enable CORS for frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

@app.get("/ping")
def ping():
    return {"status": "pong"}

@app.get("/health")
def health():
    return {"status": "healthy"}

# Initialize database
@app.on_event("startup")
async def startup_event():
    print("Starting up... Initializing database...")
    try:
        database.init_db()
        print("Database initialized successfully.")
    except Exception as e:
        print(f"Database initialization failed: {e}")

# Dependency for DB session
def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/")
def read_root():
    return {"status": "ok", "message": "Timesheet Analysis API is running"}

@app.post("/upload")
async def upload_timesheet(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """
    Uploads an Excel file, parses it, and saves data to the database.
    """
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Invalid file format. Please upload an Excel file.")

    # Temporary save file on D drive
    temp_path = f"d:/Antigravity/Project-timesheet/temp_{file.filename}"
    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        entries = parser.parse_timesheet(temp_path)
        if not entries:
            raise HTTPException(status_code=400, detail="No valid data found in the Excel file.")
            
        count = crud.save_time_entries(db, entries)
        return {"message": "Upload successful", "rows_processed": count}
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

@app.get("/stats")
def get_statistics(db: Session = Depends(get_db)):
    """
    Returns all time entries for the frontend to aggregate/visualize.
    """
    entries = crud.get_stats(db)
    return entries

@app.post("/clear")
def clear_data(db: Session = Depends(get_db)):
    """
    Clears all data from the database.
    """
    crud.clear_all_data(db)
    return {"message": "All data cleared successfully"}
