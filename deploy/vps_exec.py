"""Execute a UTF-8 shell file via the user's VPS helper without shell quoting issues."""
import base64
import importlib.util
import sys
from pathlib import Path

helper = Path(sys.argv[1])
script = Path(sys.argv[2]).read_text(encoding="utf-8")
spec = importlib.util.spec_from_file_location("vps_helper", helper)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
encoded = base64.b64encode(script.encode()).decode()
module.exec_cmd(f"printf %s '{encoded}' | base64 -d | bash")
