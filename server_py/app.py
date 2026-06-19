from flask import Flask, request, jsonify, send_from_directory
import os, uuid, time
from xml.etree import ElementTree as ET

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = os.path.join(os.path.dirname(__file__), 'uploads')
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# simple in-memory store
events = {}

@app.after_request
def add_cors(resp):
    resp.headers['Access-Control-Allow-Origin'] = '*'
    resp.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization'
    resp.headers['Access-Control-Allow-Methods'] = 'GET,POST,OPTIONS'
    return resp

def parse_gpx(path):
    try:
        tree = ET.parse(path)
        root = tree.getroot()
        points = []
        for trkpt in root.findall('.//{*}trkpt'):
            lat = trkpt.get('lat')
            lon = trkpt.get('lon')
            time_el = trkpt.find('{*}time')
            t = time_el.text if time_el is not None else None
            points.append({'lat': float(lat), 'lon': float(lon), 'time': t})
        return points
    except Exception as e:
        return {'error': str(e)}

@app.route('/events', methods=['POST'])
def create_event():
    data = request.get_json() or {}
    eid = str(uuid.uuid4())
    events[eid] = {'id': eid, 'title': data.get('title','Untitled'), 'description': data.get('description',''), 'start_time': data.get('start_time'), 'media': [], 'boats': {}}
    return jsonify(events[eid]), 201

@app.route('/events/<eid>/boats', methods=['POST'])
def create_boat(eid):
    if eid not in events:
        return jsonify({'error':'Event not found'}), 404
    data = request.get_json() or {}
    name = data.get('name')
    if not name:
        return jsonify({'error':'Boat name required'}), 400
    bid = str(uuid.uuid4())
    events[eid]['boats'][bid] = {'id': bid, 'name': name, 'tracks': []}
    return jsonify(events[eid]['boats'][bid]), 201

@app.route('/events/<eid>/uploads', methods=['POST'])
def uploads(eid):
    if eid not in events:
        return jsonify({'error':'Event not found'}), 404
    boat_id = request.form.get('boatId')
    results = []
    files = request.files.getlist('files')
    for f in files:
        filename = str(int(time.time()*1000)) + '_' + f.filename
        save_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        f.save(save_path)
        info = {'original': f.filename, 'saved': filename}
        ext = os.path.splitext(f.filename)[1].lower()
        if ext == '.gpx':
            pts = parse_gpx(save_path)
            if isinstance(pts, dict) and pts.get('error'):
                info['error'] = pts['error']
            else:
                info['points'] = pts
                if boat_id and boat_id in events[eid]['boats']:
                    events[eid]['boats'][boat_id]['tracks'].append({'id': str(uuid.uuid4()), 'source': filename, 'points': pts})
        else:
            events[eid]['media'].append({'id': str(uuid.uuid4()), 'original': f.filename, 'saved': filename, 'ext': ext})
        results.append(info)
    return jsonify({'uploaded': len(files), 'results': results}), 201

@app.route('/uploads/<path:filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.route('/events/<eid>/timeline', methods=['GET'])
def timeline(eid):
    if eid not in events:
        return jsonify({'error':'Event not found'}), 404
    ev = events[eid]
    return jsonify({'media': ev['media'], 'boats': list(ev['boats'].values())})

@app.route('/api/health')
def health():
    return jsonify({'status':'ok'})

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
