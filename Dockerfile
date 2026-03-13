# --- Build Frontend ---
FROM node:18-slim AS frontend-build
WORKDIR /frontend

# Set environment variables once
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV VITE_API_URL=""

# Better caching for dependencies
COPY frontend/package*.json ./
RUN npm install --no-update-notifier

COPY frontend/ ./
RUN npm run build

# --- Build Final Image ---
FROM python:3.9-slim
WORKDIR /app

# Combine installs to reduce layers
RUN apt-get update && apt-get install -y --no-install-recommends nginx \
    && rm -rf /var/lib/apt/lists/*

# Better caching for python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code, DB and frontend build
COPY backend ./backend
COPY timesheet.db .
COPY --from=frontend-build /frontend/dist /usr/share/nginx/html

# Nginx config
RUN echo 'server { \
    listen 7860; \
    client_max_body_size 200M; \
    location /api/ { \
        proxy_pass http://localhost:8000/; \
        proxy_set_header Host $host; \
        proxy_set_header X-Real-IP $remote_addr; \
        proxy_read_timeout 300s; \
    } \
    location / { \
        root /usr/share/nginx/html; \
        index index.html; \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/sites-available/default

# Unified start script
RUN printf "#!/bin/bash\nnginx\nuvicorn backend.main:app --host 0.0.0.0 --port 8000\n" > /app/start.sh \
    && chmod +x /app/start.sh

EXPOSE 7860
CMD ["/app/start.sh"]
