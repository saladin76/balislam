"""Offline safety checks for the explicit cloud preview uploader."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "studio-preview-cloud.py"
spec = importlib.util.spec_from_file_location("studio_preview_cloud", SCRIPT)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class TestPreviewSafety(unittest.TestCase):
    def test_atomic_index_keeps_one_logical_slot(self):
        with tempfile.TemporaryDirectory() as tmp:
            index = Path(tmp) / "index.json"
            slot = "bilislam|001|scene-c1-s1|mp4"
            module.atomic_json(index, {slot: {"url": "https://example.test/old"}})
            module.atomic_json(index, {slot: {"url": "https://example.test/new"}})
            output = json.loads(index.read_text())
            self.assertEqual(len(output), 1)
            self.assertEqual(output[slot]["url"], "https://example.test/new")

    def test_cleanup_is_report_only(self):
        with tempfile.TemporaryDirectory() as tmp:
            published = Path(tmp) / "publish.json"
            published.write_text(json.dumps({"status":"published","approved":True,"url":"https://youtube.com/video"}))
            module.cleanup_report(type("Args", (), {"publish_json": str(published)})())
            self.assertTrue(published.is_file())

    def test_unsafe_path_rejected_before_cloud_call(self):
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / "video.mp4"
            source.write_bytes(b"sample")
            args = type("Args", (), {"file":str(source),"channel":"balislam","episode":"../other","slot":"scene"})
            with self.assertRaises(ValueError):
                module.upload(args())

if __name__ == "__main__":
    unittest.main()
