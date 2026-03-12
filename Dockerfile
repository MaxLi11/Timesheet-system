# --- Build Frontend ---
FROM node:18-slim AS frontend-build
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
# Set temporary API URL to empty to let it use relative paths
RUN VITE_API_URL="" npm run build

# --- Build Final Image ---
FROM python:3.9-slim
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y nginx && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code and DB
COPY backend ./backend
COPY timesheet.db .

# Copy frontend build to nginx path
COPY --from=frontend-build /frontend/dist /usr/share/nginx/html

# Nginx config for single port usage
RUN echo 'server { \
    listen 7860; \
    location /api/ { \
        proxy_pass http://localhost:8000/; \
    } \
    location / { \
        root /usr/share/nginx/html; \
        index index.html; \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/sites-available/default

# Start script
RUN echo '#!/bin/bash\n\
nginx\n\
uvicorn backend.main:app --host 0.0.0.0 --port 8000\n\
' > /app/start.sh && chmod +x /app/start.sh

# Hugging Face uses port 7860
EXPOSE 7860
CMD ["/app/start.sh"]
