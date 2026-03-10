from sqlalchemy.orm import Session
from . import database
from datetime import date

def save_time_entries(db: Session, entries: list):
    """
    Saves a list of time entry dictionaries to the database.
    Prevents duplicates by checking employee_id, project_name, start_date, and end_date.
    """
    count = 0
    for entry_data in entries:
        # Check if entry already exists to allow rolling updates/overwrites
        existing = db.query(database.TimeEntry).filter(
            database.TimeEntry.employee_id == entry_data['employee_id'],
            database.TimeEntry.project_name == entry_data['project_name'],
            database.TimeEntry.start_date == entry_data['start_date'],
            database.TimeEntry.end_date == entry_data['end_date']
        ).first()

        if existing:
            # Update existing entry
            existing.hours = entry_data['hours']
            existing.task_details = entry_data['task_details']
            existing.approval_status = entry_data['approval_status']
            existing.category = entry_data['category']
            existing.employee_name = entry_data['employee_name']
            existing.department = entry_data['department']
        else:
            # Create new entry
            db_entry = database.TimeEntry(**entry_data)
            db.add(db_entry)
        
        count += 1
    
    db.commit()
    return count

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
