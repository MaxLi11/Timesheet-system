import socket
import os
import re

def get_local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # doesn't even have to be reachable
        s.connect(('10.255.255.255', 1))
        IP = s.getsockname()[0]
    except Exception:
        IP = '127.0.0.1'
    finally:
        s.close()
    return IP

def update_frontend_ip(ip):
    app_path = os.path.join('frontend', 'src', 'App.jsx')
    if not os.path.exists(app_path):
        print(f"Error: {app_path} not found.")
        return

    with open(app_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Look for: const API_BASE_URL = ...;
    new_content = re.sub(
        r"const API_BASE_URL = [^;]+;",
        f"const API_BASE_URL = 'http://{ip}:8000';",
        content
    )

    with open(app_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    
    print(f"Successfully updated API_BASE_URL to http://{ip}:8000 in App.jsx")

if __name__ == "__main__":
    local_ip = get_local_ip()
    print(f"Detected Local IP: {local_ip}")
    update_frontend_ip(local_ip)
    # Also write IP to a temp file for the batch script
    with open('current_ip.txt', 'w') as f:
        f.write(local_ip)
