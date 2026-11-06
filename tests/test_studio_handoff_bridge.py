"""Offline tests for explicit Mac Git handoff consumer."""
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest

P = Path(__file__).resolve().parents[1] / "scripts" / "studio-handoff-bridge.py"
spec = importlib.util.spec_from_file_location("studio_handoff_bridge", P)
bridge = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bridge)

class BridgeSafety(unittest.TestCase):
    def job(self, **overrides):
        j = dict(id="one", channel="balislam", episode="001-test", slot="scene",
                 kind="video", commit="a"*40,
                 path="channels/balislam/episodes/001-test/previews/scene.mp4", sha256="b"*64)
        return dict(j, **overrides)

    def test_accepted_video_and_storyboard(self):
        bridge.validate(self.job())
        bridge.validate(self.job(kind="storyboard", path="channels/balislam/episodes/001-test/plan.json"))

    def test_wrong_channel_and_path_traversal_rejected(self):
        for j in [self.job(channel="dafatir-alzaman"),
                  self.job(path="channels/balislam/episodes/001-test/../secret.mp4"),
                  self.job(path="/tmp/scene.mp4")]:
            with self.assertRaises(ValueError): bridge.validate(j)

    def test_bad_schema_and_protected_audio_rejected(self):
        with self.assertRaises(ValueError): bridge.validate(self.job(slot="scene-audio"))
        with self.assertRaises(ValueError): bridge.parse_queue(json.dumps({"version":1,"jobs":[dict(self.job(),shell="rm -rf /")]}))
        with self.assertRaises(ValueError): bridge.parse_queue(json.dumps({"version":1,"jobs":[self.job(),self.job()]}))

    def test_real_git_blob_and_digest(self):
        with tempfile.TemporaryDirectory() as temp:
            repo = Path(temp)
            def git(*args):
                return subprocess.check_output(["git","-C",temp,*args],stderr=subprocess.DEVNULL).decode().strip()
            git("init","-q")
            git("config","user.email","test@example.test")
            git("config","user.name","Test")
            target = repo / "channels/balislam/episodes/001-test"
            target.mkdir(parents=True)
            data = b'{"scene":"test"}'
            (target / "plan.json").write_bytes(data)
            git("add",".")
            git("commit","-qm","fixture")
            commit = git("rev-parse","HEAD")
            git("update-ref","refs/remotes/origin/studio-handoff-queue",commit)
            job = self.job(commit=commit,kind="storyboard",
                           path="channels/balislam/episodes/001-test/plan.json",
                           sha256=hashlib.sha256(data).hexdigest())
            self.assertEqual(bridge.artifact(repo,job),data)
            with self.assertRaises(ValueError):
                bridge.artifact(repo,dict(job,sha256="0"*64))

    def test_empty_queue_no_upload(self):
        self.assertEqual(bridge.parse_queue('{"version":1,"jobs":[]}'),[])

if __name__ == "__main__":
    unittest.main()
