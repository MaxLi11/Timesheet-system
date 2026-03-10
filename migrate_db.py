import sqlite3
import os

db_path = r"d:\Antigravity\Project-timesheet\timesheet.db"

if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    try:
        # Check if column exists
        cursor.execute("PRAGMA table_info(time_entries)")
        columns = [column[1] for column in cursor.fetchall()]
        if 'department' not in columns:
            print("Adding 'department' column to 'time_entries' table...")
            cursor.execute("ALTER TABLE time_entries ADD COLUMN department TEXT")
            conn.commit()
            print("Migration successful.")
        else:
            print("Column 'department' already exists.")
    except Exception as e:
        print(f"Migration error: {e}")
    finally:
        conn.close()
else:
    print("Database file not found, skipping migration.")
