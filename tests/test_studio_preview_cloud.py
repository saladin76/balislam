"""Offline tests for cloud uploader: fake rclone, no account access required."""
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest import mock

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "studio-preview-cloud.py"
spec = importlib.util.spec_from_file_location("studio_preview_cloud", SCRIPT)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class TestPreviewSafety(unittest.TestCase):
    def test_atomic_index_replaces_same_slot(self):
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
            self.assertTrue(published.read_text())

    def test_unsafe_slot_rejected_before_cloud_call(self):
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / "video.mp4"
            source.write_bytes(b"sample")
            args = type("Args", (), {"file":str(source),"channel":"balislam","episode":"../other","slot":"scene"})
            with mock.patch.object(module, "run", side_effect=AssertionError("Should not upload")):
                with self.assertRaises(ValueError):
                    module.upload(args())

    def test_cloud_reuses_slot_and_updates_only_latest_link(self):
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / "video.mp4"
            source.write_bytes(b"version one")
            cloud = {}
            calls = []
            def rclone(*cmd):
                calls.append(cmd)
                operation = cmd[1]
                if operation == "md5sum":
                    key = cmd[2]
                    if key not in cloud:
                        raise RuntimeError("not found")
                    import hashlib
                    return hashlib.md5(cloud[key]).hexdigest() + "  " + key
                if operation == "copyto":
                    if Path(cmd[2]).resolve() == source.resolve():
                        cloud[cmd[3]] = source.read_bytes()
                    elif cmd[2].endswith(".md"):
                        cloud[cmd[3]] = Path(cmd[2]).read_bytes()
                    return ""
                if operation == "link":
                    return "https://drive.google.com/open?id=stable-id"
                raise AssertionError(cmd)
            args = type("Args", (), {"file":str(source),"channel":"balislam","episode":"001-sample","slot":"scene-c1-s1"})
            with mock.patch.dict(os.environ, {"BAL_PREVIEW_HOME":tmp}):
                with mock.patch.object(module, "run", side_effect=rclone):
                    module.upload(args())
                    source.write_bytes(b"version two")
                    module.upload(args())
            key = "studio_drive:Balislam-Studio-Previews/bilislam/episodes/001-sample/previews/scene-c1-s1.mp4"
            self.assertEqual(cloud[key], b"version two")
            index = json.loads((Path(tmp) / "preview-cloud-index.json").read_text())
            self.assertEqual(len(index), 1)
            self.assertEqual(index["bilislam|001-sample|scene-c1-s1|mp4"]["url"], "https://drive.google.com/open?id=stable-id")
            self.assertEqual(len([c for c in calls if c[1] == "copyto" and c[3] == key]), 2)
            self.assertTrue(source.exists())

    def test_checksum_failure_never_publishes_index(self):
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / "video.mp4"
            source.write_bytes(b"video")
            args = type("Args", (), {"file":str(source),"channel":"balislam","episode":"001","slot":"scene"})
            def broken(*cmd):
                if cmd[1] == "md5sum":
                    return "00000000000000000000000000000000  video.mp4"
                return ""
            with mock.patch.dict(os.environ, {"BAL_PREVIEW_HOME":tmp}):
                with mock.patch.object(module, "run", side_effect=broken):
                    with self.assertRaises(RuntimeError):
                        module.upload(args())
            self.assertFalse((Path(tmp) / "preview-cloud-index.json").exists())
            self.assertTrue(source.exists())

if __name__ == "__main__":
    unittest.main()
