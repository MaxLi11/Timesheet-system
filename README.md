---
title: Anx Showtime
emoji: "📊"
colorFrom: indigo
colorTo: blue
sdk: docker
pinned: false
license: apache-2.0
---

# Anx Showtime

Project timesheet and schedule analytics dashboard.

## Stack

- Frontend: React + Vite
- Backend: FastAPI
- Deployment: Docker on Hugging Face Spaces

## Notes

- Root `README.md` includes the Hugging Face Space configuration front matter.
- Frontend source lives under `frontend/`.
- Backend source lives under `backend/`.

## Local Verification

Install runtime and test dependencies:

```bash
python3 -m pip install -r requirements-dev.txt
cd frontend && npm install
```

Run the full local verification before pushing to GitHub or syncing Hugging Face:

```bash
./scripts/verify-local.sh
```

The script runs the Python test suite with `python3 -m pytest` and then builds the Vite frontend with `npm run build`.
