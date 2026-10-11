set -eu
systemctl is-active --quiet society-lab
systemctl is-enabled --quiet society-lab
runuser -u society-lab -- env HOME=/var/lib/society-lab /opt/society-lab/.venv/bin/python - <<'PY'
import os
# Upstream validates model variables at import time. These process-only values
# allow an import smoke check without saving credentials or calling a model.
os.environ.update(AGENTSOCIETY_LLM_API_KEY='import-check-only', AGENTSOCIETY_LLM_API_BASE='http://127.0.0.1:9/v1', AGENTSOCIETY_LLM_MODEL='import-check-only')
from agentsociety2.config.llm_dispatcher import LLMClient
from agentsociety2.contrib.env.prisoners_dilemma import PrisonersDilemmaEnv
from agentsociety2.contrib.env.public_goods import PublicGoodsEnv
from agentsociety2.contrib.env.reputation_game import ReputationGameConfig, ReputationGameEnv
from agentsociety2.storage import ColumnDef, ReplayWriter, TableSchema
print('PASS: full experiment runtime imports as service user')
PY
python3 - <<'PY'
import json
import re
import socket
import urllib.error
import urllib.request
# Test origin HTTPS with normal certificate validation; public Cloudflare access
# is separately verified in the browser (its bot protection blocks urllib).
resolve = socket.getaddrinfo
socket.getaddrinfo = lambda host, port, *args, **kwargs: resolve('127.0.0.1' if host == 'society-lab.wei67.top' else host, port, *args, **kwargs)
for base in ['http://127.0.0.1:8012', 'https://society-lab.wei67.top']:
    def get(path):
        with urllib.request.urlopen(base + path, timeout=20) as response:
            assert response.status == 200
            return response.read()
    config = json.loads(get('/api/config'))
    assert config['read_only'] is False
    assert config['env'] == {'api_key_configured': False, 'api_base': '', 'model': ''}
    runs = json.loads(get('/api/runs'))
    assert len(runs) == 18
    modes = {}
    for run in runs:
        result = json.loads(get('/api/runs/' + run['id']))
        assert result['status'] == 'completed' and result['events']
        modes[result['mode']] = modes.get(result['mode'], 0) + 1
    assert modes == {'llm': 6, 'offline': 12}
    request = urllib.request.Request(base + '/api/config', data=b'{}', headers={'Content-Type': 'application/json'}, method='POST')
    with urllib.request.urlopen(request, timeout=20) as response:
        assert json.load(response)['read_only'] is False
    payload = {'example': 'prisoners_dilemma', 'agents': [{'id': 1, 'name': 'A'}, {'id': 2, 'name': 'B'}]}
    request = urllib.request.Request(base + '/api/runs', data=json.dumps(payload).encode(), headers={'Content-Type': 'application/json'}, method='POST')
    try:
        urllib.request.urlopen(request, timeout=20)
    except urllib.error.HTTPError as error:
        assert error.code == 422
        assert 'AGENTSOCIETY_LLM_API_KEY' in json.load(error)['detail']
    else:
        raise AssertionError('Unconfigured model should require configuration')
    if base.startswith('https'):
        html = get('/').decode()
        assets = re.findall(r'(?:src|href)="(/assets/[^\"]+)"', html)
        assert len(assets) >= 2
        for asset in assets:
            assert get(asset)
        assert get('/nested-spa-route') == html.encode()
    print('PASS:', base, '18 completed runs, 6 LLM + 12 offline, configuration writable, missing model validated')
PY
echo SOCIETY_LAB_VERIFY_OK
