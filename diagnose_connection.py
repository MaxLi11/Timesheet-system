import socket
import os
import sys

def check_port(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('127.0.0.1', port)) == 0

def diagnose():
    print("=== Timesheet App Diagnostics ===")
    
    # Check D drive
    if os.path.exists("d:/Antigravity/Project-timesheet"):
        print("[OK] Project directory found on D drive.")
    else:
        print("[ERROR] Project directory NOT found on D drive!")

    # Check database
    db_path = "d:/Antigravity/Project-timesheet/timesheet.db"
    if os.path.exists(db_path):
        print(f"[OK] Database found at {db_path}")
    else:
        print("[WARNING] Database not found (will be created on first upload).")

    # Check Port 8000 (Backend)
    if check_port(8000):
        print("[OK] Port 8000 is occupied (Backend might be running).")
    else:
        print("[ERROR] Port 8000 is FREE. Backend is NOT running!")

    # Check Port 5173 (Frontend)
    if check_port(5173):
        print("[OK] Port 5173 is occupied (Frontend might be running).")
    else:
        print("[ERROR] Port 5173 is FREE. Frontend is NOT running!")

    print("\nSuggestions:")
    print("1. If Backend is NOT running, check the 'Timesheet-Backend' window for errors.")
    print("2. If Backend IS running but 'Failed to fetch' persists, it might be a Firewall or Antivirus blocking the connection.")
    print("3. Try visiting http://127.0.0.1:8000/ in your browser manually.")

if __name__ == "__main__":
    diagnose()
    input("\nPress Enter to exit...")
