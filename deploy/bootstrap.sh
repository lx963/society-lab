set -eu
APP=/opt/society-lab
if [ ! -d "$APP/.git" ]; then
    git clone https://github.com/lx963/society-lab.git "$APP"
else
    git -C "$APP" pull --ff-only origin main
fi
id society-lab >/dev/null 2>&1 || useradd --system --home-dir "$APP" --shell /usr/sbin/nologin society-lab
if [ ! -x /opt/society-lab-tools/uv ]; then
    curl -fsSL https://astral.sh/uv/install.sh -o /tmp/society-lab-uv-install.sh
    UV_INSTALL_DIR=/opt/society-lab-tools UV_NO_MODIFY_PATH=1 sh /tmp/society-lab-uv-install.sh
fi
cd "$APP"
/opt/society-lab-tools/uv venv --python 3.12 .venv
/opt/society-lab-tools/uv pip install --python .venv/bin/python -r deploy/requirements-showcase.txt
cd frontend
npm ci --no-audit --no-fund
npm run build
cd "$APP"
install -m 644 deploy/society-lab.service /etc/systemd/system/society-lab.service
systemctl daemon-reload
systemctl enable --now society-lab
systemctl restart society-lab
for attempt in $(seq 1 15); do
    if curl -fsS http://127.0.0.1:8012/api/config; then break; fi
    sleep 1
done
curl -fsS http://127.0.0.1:8012/api/runs | python3 -c 'import json,sys; r=json.load(sys.stdin); assert len(r)==18; print("Showcase records:",len(r))'
mkdir -p /etc/caddy/sites
install -m 644 deploy/Caddyfile /etc/caddy/sites/society-lab.caddy
if ! grep -qxF 'import /etc/caddy/sites/*.caddy' /etc/caddy/Caddyfile; then
    cp -a /etc/caddy/Caddyfile "/etc/caddy/Caddyfile.before-society-lab.$(date +%Y%m%d%H%M%S)"
    printf '\nimport /etc/caddy/sites/*.caddy\n' >> /etc/caddy/Caddyfile
fi
caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy
echo SOCIETY_LAB_DEPLOY_OK
