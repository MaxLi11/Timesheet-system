from sqlalchemy.orm import Session
from . import database
from datetime import date

def save_time_entries(db: Session, entries: list):
    """
    Saves a list of time entry dictionaries to the database using rolling updates.
    Optimized for large data volumes using bulk inserts.
    """
    if not entries:
        return 0

    # 1. Identify unique periods in the incoming entries
    periods = set((e['start_date'], e['end_date']) for e in entries)
    
    # 2. Clear old data for these specific periods
    for start, end in periods:
        db.query(database.TimeEntry).filter(
            database.TimeEntry.start_date == start,
            database.TimeEntry.end_date == end
        ).delete(synchronize_session=False)
    
    # 3. Bulk insert all new entries in chunks
    # bulk_insert_mappings is significantly faster, but chunking prevents memory issues
    CHUNK_SIZE = 5000
    for i in range(0, len(entries), CHUNK_SIZE):
        chunk = entries[i : i + CHUNK_SIZE]
        db.bulk_insert_mappings(database.TimeEntry, chunk)
    
    db.commit()
    return len(entries)

def get_stats(db: Session, start_date: date = None, end_date: date = None):
    """
    Retrieves all time entries, optionally filtered by date range.
    """
    query = db.query(database.TimeEntry)
    if start_date:
        query = query.filter(database.TimeEntry.start_date >= start_date)
    if end_date:
        query = query.filter(database.TimeEntry.end_date <= end_date)
    
    return query.all()

def clear_all_data(db: Session):
    """
    Clears all data from the time_entries table.
    """
    db.query(database.TimeEntry).delete()
    db.commit()

def get_reporting_rate(db: Session):
    """
    Returns all time entries grouped by (start_date, end_date, employee_id)
    so the frontend can compute reporting rate per employee per period.
    Returns only the fields needed for the reporting rate calculation.
    """
    entries = db.query(
        database.TimeEntry.start_date,
        database.TimeEntry.end_date,
        database.TimeEntry.employee_name,
        database.TimeEntry.employee_id,
        database.TimeEntry.department,
        database.TimeEntry.hours
    ).all()

    return [
        {
            "start_date": str(e.start_date),
            "end_date": str(e.end_date),
            "employee_name": e.employee_name,
            "employee_id": e.employee_id,
            "department": e.department,
            "hours": e.hours
        }
        for e in entries
    ]
