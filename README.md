# PostRaceAnalysis — Njord-like MVP

This repository contains an MVP for a post-race analysis player: create events, upload videos/photos and GPS (GPX/FIT), link GPS to boats, and view a dual-pane player (video + map with boat tracks).

Quickstart (local):
- Backend (Flask): server runs on port 5000
  - cd server_py && python -m venv venv && venv\Scripts\activate && pip install -r requirements.txt
  - python app.py
- Client (dev): cd client && npm install && npm run dev

Docker (recommended):
- Build and run both services with docker-compose: docker-compose up --build

Render deploy:
- Render will auto-detect services from render.yaml. Connect this repository in your Render dashboard and create two services: postrace-api and postrace-web, or let Render create them from render.yaml.

Files of interest:
- server_py/app.py — Flask API handling events, boats, uploads and GPX parsing
- client/ — Vite React client and Dockerfile
- docker-compose.yml — local dev stack
- render.yaml — Render service definitions

Notes:
- This is an MVP scaffold. For production: add persistent DB (Postgres), S3 storage, authentication, background workers for media processing and HLS transcoding.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
