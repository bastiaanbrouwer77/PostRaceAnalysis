#!/bin/sh
set -e
cat > /usr/share/nginx/html/env-config.js <<'EOF'
window.REACT_APP_API_BASE = "${REACT_APP_API_BASE:-http://localhost:5000}";
EOF
exec nginx -g 'daemon off;'
