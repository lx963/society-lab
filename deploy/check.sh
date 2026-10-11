set -eu
systemctl is-active society-lab || true
ps -eo pid,etime,args | grep -E 'society-lab|uv |npm|curl' | head -15 || true
ls -ld /opt/society-lab/.venv /opt/society-lab/frontend/dist 2>/dev/null || true
journalctl -u society-lab -n 12 --no-pager
journalctl -u caddy -n 8 --no-pager
