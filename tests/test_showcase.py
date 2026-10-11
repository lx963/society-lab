import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient
import backend.app as api


class ShowcaseTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix=".showcase-test-", dir=Path(__file__).resolve().parents[1])
        self.root = Path(self.temp.name)
        self.patches = [patch.object(api, "ROOT", self.root), patch.object(api, "RUNS", self.root / "data/runs"), patch.dict(os.environ, {"SOCIETY_LAB_READ_ONLY": "1", "AGENTSOCIETY_LLM_API_KEY": "private-test-key"})]
        for item in self.patches:
            item.start()
        for directory, run_id in [("data/runs", "a" * 32), ("examples/offline", "b" * 32)]:
            result = {"id": run_id, "example": "hello_agent" if directory.startswith("examples") else "public_goods", "created_at": "2026-09-26T00:00:00+00:00", "status": "completed", "events": [{"step": 1, "action": "test", "result": {}}], "inputs": {"agents": []}}
            folder = self.root / directory / run_id
            folder.mkdir(parents=True)
            (folder / "result.json").write_text(json.dumps(result), encoding="utf-8")
        self.client = TestClient(api.app)

    def tearDown(self):
        self.client.close()
        for item in reversed(self.patches):
            item.stop()
        self.temp.cleanup()

    def test_showcase_reads_live_and_archived_results(self):
        runs = self.client.get("/api/runs").json()
        self.assertEqual(len(runs), 2)
        for run in runs:
            response = self.client.get("/api/runs/" + run["id"])
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["status"], "completed")
        self.assertEqual(self.client.get("/api/runs/invalid").status_code, 404)

    def test_showcase_rejects_writes_before_validation(self):
        for path in ["/api/config", "/api/runs"]:
            self.assertEqual(self.client.post(path, json={}).status_code, 403)
        config = self.client.get("/api/config").json()
        self.assertTrue(config["read_only"])
        self.assertEqual(config["env"], {"api_key_configured": False, "api_base": "", "model": ""})

    def test_local_mode_keeps_archive_separate(self):
        with patch.dict(os.environ, {"SOCIETY_LAB_READ_ONLY": "0"}):
            self.assertEqual(len(self.client.get("/api/runs").json()), 1)
            self.assertEqual(self.client.get("/api/runs/" + "b" * 32).status_code, 404)
            self.assertFalse(self.client.get("/api/config").json()["read_only"])


if __name__ == "__main__":
    unittest.main()
