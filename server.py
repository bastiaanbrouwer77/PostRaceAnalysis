"""PostRaceAnalysis server"""

from flask import Flask, render_template, jsonify
import os

app = Flask(__name__, static_folder='client', static_url_path='')

@app.route('/')
def index():
    """Serve index page"""
    return app.send_static_file('index.html')

@app.route('/api/health')
def health():
    """Health check endpoint"""
    return jsonify({'status': 'ok'})

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
