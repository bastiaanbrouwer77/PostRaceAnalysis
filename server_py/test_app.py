import tempfile
from pathlib import Path

import pytest

from app import create_app


@pytest.fixture
def client(tmp_path):
    db_file = tmp_path / 'events.db'
    upload_dir = tmp_path / 'uploads'
    app = create_app({'EVENT_DB_PATH': str(db_file), 'EVENT_UPLOAD_DIR': str(upload_dir)})
    app.config['TESTING'] = True

    with app.test_client() as client:
        yield client


def test_create_event_and_search(client):
    response = client.post('/api/events', json={'name': 'Test Race', 'date': '2025-05-01'})
    assert response.status_code == 201
    body = response.get_json()
    assert body['name'] == 'Test Race'
    assert body['date'] == '2025-05-01'
    assert 'id' in body

    response = client.get('/api/events')
    assert response.status_code == 200
    events = response.get_json()
    assert any(event['name'] == 'Test Race' for event in events)

    response = client.get('/api/events', query_string={'query': 'Test'})
    assert response.status_code == 200
    events = response.get_json()
    assert len(events) == 1
    assert events[0]['name'] == 'Test Race'


def test_upload_media(client, tmp_path):
    response = client.post('/api/events', json={'name': 'Upload Race', 'date': '2025-06-01'})
    assert response.status_code == 201
    event_id = response.get_json()['id']

    test_file = tmp_path / 'sample.txt'
    test_file.write_text('dummy content')

    with open(test_file, 'rb') as fp:
        response = client.post(
            f'/api/events/{event_id}/uploads',
            data={'file': (fp, 'recording.mp4'), 'media_type': 'video'},
            content_type='multipart/form-data',
        )

    assert response.status_code == 201
    upload_body = response.get_json()
    assert upload_body['media_type'] == 'video'
    assert upload_body['filename'] == 'recording.mp4'

    response = client.get(f'/api/events/{event_id}/uploads')
    assert response.status_code == 200
    uploads = response.get_json()
    assert len(uploads) == 1
    assert uploads[0]['filename'] == 'recording.mp4'
