from sqlalchemy.orm import Session
from . import database
from datetime import date

def save_time_entries(db: Session, entries: list):
    """
    Saves a list of time entry dictionaries to the database using rolling updates.
    For every unique period (start_date, end_date) in the new data, existing entries
    in the database for that period are deleted before inserting the new ones.
    """
    # 1. Identify unique periods in the incoming entries
    periods = set((e['start_date'], e['end_date']) for e in entries)
    
    # 2. Clear old data for these specific periods
    for start, end in periods:
        db.query(database.TimeEntry).filter(
            database.TimeEntry.start_date == start,
            database.TimeEntry.end_date == end
        ).delete(synchronize_session=False)
    
    # 3. Insert all new entries
    for entry_data in entries:
        db_entry = database.TimeEntry(**entry_data)
        db.add(db_entry)
    
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
