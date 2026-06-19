"""PostRaceAnalysis server."""

import os
import sqlite3
import datetime
from flask import Flask, jsonify, request, abort, current_app, g
from flask_cors import CORS
from werkzeug.utils import secure_filename

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_DB_PATH = os.path.join(BASE_DIR, 'data', 'events.db')
DEFAULT_UPLOAD_DIR = os.path.join(BASE_DIR, 'uploads')

UPLOAD_FIELDS = {'video', 'photo', 'gpx', 'fit'}


def normalize_event_folder(name, date):
    safe_name = secure_filename(name) or 'race'
    safe_name = safe_name.replace(' ', '_')
    return f"{safe_name}_{date}"


def create_app(test_config=None):
    app = Flask(__name__)
    app.config['EVENT_DB_PATH'] = DEFAULT_DB_PATH
    app.config['EVENT_UPLOAD_DIR'] = DEFAULT_UPLOAD_DIR

    if test_config:
        app.config.update(test_config)

    CORS(app, resources={r"/api/*": {"origins": "*"}})
    init_app(app)
    register_routes(app)
    app.teardown_appcontext(close_db)
    return app


def init_app(app):
    db_path = app.config['EVENT_DB_PATH']
    upload_dir = app.config['EVENT_UPLOAD_DIR']
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    os.makedirs(upload_dir, exist_ok=True)

    with sqlite3.connect(db_path) as conn:
        conn.execute('PRAGMA foreign_keys = ON')
        conn.execute(
            '''
            CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                date TEXT NOT NULL,
                created_at TEXT NOT NULL,
                folder_name TEXT NOT NULL
            )
            '''
        )
        conn.execute(
            '''
            CREATE TABLE IF NOT EXISTS boats (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
            )
            '''
        )
        conn.execute(
            '''
            CREATE TABLE IF NOT EXISTS uploads (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_id INTEGER NOT NULL,
                filename TEXT NOT NULL,
                media_type TEXT NOT NULL,
                boat_id INTEGER,
                uploaded_at TEXT NOT NULL,
                FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
                FOREIGN KEY (boat_id) REFERENCES boats(id) ON DELETE SET NULL
            )
            '''
        )

        existing_columns = {row[1] for row in conn.execute("PRAGMA table_info(events)").fetchall()}
        if 'folder_name' not in existing_columns:
            conn.execute('ALTER TABLE events ADD COLUMN folder_name TEXT NOT NULL DEFAULT ""')
            for row in conn.execute('SELECT id, name, date FROM events').fetchall():
                conn.execute(
                    'UPDATE events SET folder_name = ? WHERE id = ?',
                    (normalize_event_folder(row[1], row[2]), row[0]),
                )

        upload_columns = {row[1] for row in conn.execute("PRAGMA table_info(uploads)").fetchall()}
        if 'boat_id' not in upload_columns:
            conn.execute('ALTER TABLE uploads ADD COLUMN boat_id INTEGER')


def get_db():
    if 'db' not in g:
        db_path = current_app.config['EVENT_DB_PATH']
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        conn.execute('PRAGMA foreign_keys = ON')
        g.db = conn
    return g.db


def close_db(exception=None):
    db = g.pop('db', None)
    if db is not None:
        db.close()


def register_routes(app):
    @app.route('/api/health')
    def health():
        return jsonify({'status': 'ok'})

    @app.route('/api/events', methods=['GET'])
    def list_events():
        query = request.args.get('query', '').strip()
        db = get_db()
        if query:
            rows = db.execute(
                'SELECT id, name, date, created_at, folder_name FROM events WHERE name LIKE ? ORDER BY date DESC',
                (f'%{query}%',),
            ).fetchall()
        else:
            rows = db.execute(
                'SELECT id, name, date, created_at, folder_name FROM events ORDER BY date DESC'
            ).fetchall()
        return jsonify([dict(row) for row in rows])

    @app.route('/api/events', methods=['POST'])
    def create_event():
        data = request.get_json(force=True, silent=True)
        if not data:
            abort(400, 'JSON body is required')

        name = (data.get('name') or '').strip()
        date = (data.get('date') or '').strip()
        if not name or not date:
            abort(400, 'Both name and date are required')

        try:
            datetime.date.fromisoformat(date)
        except ValueError:
            abort(400, 'Date must be in YYYY-MM-DD format')

        db = get_db()
        created_at = datetime.datetime.utcnow().isoformat() + 'Z'
        folder_name = normalize_event_folder(name, date)
        cursor = db.execute(
            'INSERT INTO events (name, date, created_at, folder_name) VALUES (?, ?, ?, ?)',
            (name, date, created_at, folder_name),
        )
        db.commit()
        event_id = cursor.lastrowid
        row = db.execute(
            'SELECT id, name, date, created_at, folder_name FROM events WHERE id = ?',
            (event_id,),
        ).fetchone()
        return jsonify(dict(row)), 201

    @app.route('/api/events/<int:event_id>', methods=['GET'])
    def get_event(event_id):
        db = get_db()
        row = db.execute(
            'SELECT id, name, date, created_at, folder_name FROM events WHERE id = ?',
            (event_id,),
        ).fetchone()
        if row is None:
            abort(404, 'Event not found')
        return jsonify(dict(row))

    @app.route('/api/events/<int:event_id>/boats', methods=['GET'])
    def list_boats(event_id):
        db = get_db()
        event = db.execute('SELECT id FROM events WHERE id = ?', (event_id,)).fetchone()
        if event is None:
            abort(404, 'Event not found')
        rows = db.execute(
            'SELECT id, event_id, name, created_at FROM boats WHERE event_id = ? ORDER BY name',
            (event_id,),
        ).fetchall()
        return jsonify([dict(row) for row in rows])

    @app.route('/api/events/<int:event_id>/boats', methods=['POST'])
    def create_boat(event_id):
        data = request.get_json(force=True, silent=True)
        if not data:
            abort(400, 'JSON body is required')

        name = (data.get('name') or '').strip()
        if not name:
            abort(400, 'Boat name is required')

        db = get_db()
        event = db.execute('SELECT id FROM events WHERE id = ?', (event_id,)).fetchone()
        if event is None:
            abort(404, 'Event not found')

        created_at = datetime.datetime.utcnow().isoformat() + 'Z'
        cursor = db.execute(
            'INSERT INTO boats (event_id, name, created_at) VALUES (?, ?, ?)',
            (event_id, name, created_at),
        )
        db.commit()
        boat_id = cursor.lastrowid
        row = db.execute(
            'SELECT id, event_id, name, created_at FROM boats WHERE id = ?',
            (boat_id,),
        ).fetchone()
        return jsonify(dict(row)), 201

    @app.route('/api/events/<int:event_id>/uploads', methods=['GET'])
    def list_uploads(event_id):
        db = get_db()
        event = db.execute('SELECT id, folder_name FROM events WHERE id = ?', (event_id,)).fetchone()
        if event is None:
            abort(404, 'Event not found')

        rows = db.execute(
            'SELECT u.id, u.event_id, u.filename, u.media_type, u.uploaded_at, u.boat_id, b.name AS boat_name '
            'FROM uploads u LEFT JOIN boats b ON u.boat_id = b.id '
            'WHERE u.event_id = ? ORDER BY u.uploaded_at DESC',
            (event_id,),
        ).fetchall()

        uploads = [dict(row) for row in rows]
        found_files = {upload['filename'] for upload in uploads}
        event_folder = os.path.join(current_app.config['EVENT_UPLOAD_DIR'], event['folder_name'])
        if os.path.isdir(event_folder):
            for filename in sorted(os.listdir(event_folder)):
                if filename in found_files:
                    continue
                uploads.append(
                    {
                        'id': None,
                        'event_id': event_id,
                        'filename': filename,
                        'media_type': 'unknown',
                        'uploaded_at': None,
                        'boat_id': None,
                        'boat_name': None,
                    }
                )

        return jsonify(uploads)

    @app.route('/api/events/<int:event_id>/uploads', methods=['POST'])
    def upload_media(event_id):
        db = get_db()
        event = db.execute('SELECT id, folder_name FROM events WHERE id = ?', (event_id,)).fetchone()
        if event is None:
            abort(404, 'Event not found')

        if 'file' not in request.files:
            abort(400, 'Missing file upload')

        uploaded_file = request.files['file']
        if uploaded_file.filename == '':
            abort(400, 'No file selected')

        media_type = (request.form.get('media_type') or 'video').lower().strip()
        if media_type not in UPLOAD_FIELDS:
            abort(400, 'Invalid media type')

        boat_id = None
        if media_type in {'gpx', 'fit'}:
            boat_id_str = (request.form.get('boat_id') or '').strip()
            if not boat_id_str:
                abort(400, 'Boat is required for GPS uploads')
            try:
                boat_id = int(boat_id_str)
            except ValueError:
                abort(400, 'Boat identifier must be numeric')

            boat = db.execute(
                'SELECT id FROM boats WHERE id = ? AND event_id = ?',
                (boat_id, event_id),
            ).fetchone()
            if boat is None:
                abort(400, 'Boat not found for this event')

        filename = secure_filename(uploaded_file.filename)
        event_folder = os.path.join(current_app.config['EVENT_UPLOAD_DIR'], event['folder_name'])
        os.makedirs(event_folder, exist_ok=True)
        save_path = os.path.join(event_folder, filename)
        uploaded_file.save(save_path)

        uploaded_at = datetime.datetime.utcnow().isoformat() + 'Z'
        db.execute(
            'INSERT INTO uploads (event_id, filename, media_type, boat_id, uploaded_at) VALUES (?, ?, ?, ?, ?)',
            (event_id, filename, media_type, boat_id, uploaded_at),
        )
        db.commit()

        return jsonify(
            {
                'event_id': event_id,
                'filename': filename,
                'media_type': media_type,
                'boat_id': boat_id,
                'uploaded_at': uploaded_at,
            }
        ), 201


app = create_app()

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=os.getenv('FLASK_ENV') != 'production')
