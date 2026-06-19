Race analysis application with Python backend and web frontend.

## Getting Started

### Prerequisites
- Python 3.8+
- Docker (optional)

### Running locally

```bash
cd server_py
pip install -r requirements.txt
python app.py
```

In another terminal, run the frontend with a web container or static server. For local development with Docker Compose:

```bash
docker-compose up
```

The web UI will be available at `http://localhost` and the API at `http://localhost:5000`.

## Creating a race

Use the web UI to:

- enter a race name
- select a date
- submit to create a race
- search and select races by name

Once a race is selected, you can upload media files for that event.

## API Endpoints

- `GET /api/events` - list races
- `POST /api/events` - create a race with JSON `{ "name": "Race name", "date": "YYYY-MM-DD" }`
- `GET /api/events/:id` - retrieve a race
- `POST /api/events/:id/uploads` - upload a file for a race
- `GET /api/events/:id/uploads` - list uploads for a race

## Render setup notes

If deploying the frontend and API as separate Render services, set the web service env var:

- `REACT_APP_API_BASE=https://<your-api-service-name>.onrender.com`

The client uses that value at runtime to call the API.

## Project Structure

- `server_py/` - Flask backend and tests
- `client/` - Frontend HTML/JavaScript
- `docker-compose.yml` - Docker configuration
- `render.yaml` - Render deployment config

## License

MIT
