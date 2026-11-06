#!/usr/bin/env python3
"""Mac-only GitHub queue bridge. Explicit immutable file handoffs, no directory scans."""
import argparse
import fcntl
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import subprocess
import sys
import tempfile

BRANCH = "studio-handoff-queue"
QUEUE = "studio-handoff/queue.json"
CHANNELS = {"balislam", "dafatir-alzaman", "zubdat-alkutub"}
KINDS = {
    "video": {".mp4", ".webm"},
    "storyboard": {".json", ".md", ".pdf", ".png", ".jpg", ".jpeg", ".webp"},
}
TOKEN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]{0,100}$")
OID = re.compile(r"^[0-9a-f]{40}$")
HASH = re.compile(r"^[0-9a-f]{64}$")
MAX_BYTES = 500 * 1024 * 1024

def git(repo, *args):
    result = subprocess.run(["git", "-C", str(repo), *args], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if result.returncode:
        raise RuntimeError("git " + args[0] + ": " + result.stderr.decode(errors="replace")[:300])
    return result.stdout

def validate(job):
    if not isinstance(job, dict) or set(job) != {"id", "channel", "episode", "slot", "kind", "commit", "path", "sha256"}:
        raise ValueError("Unexpected job fields")
    for key in ("id", "episode", "slot"):
        if not isinstance(job[key], str) or not TOKEN.fullmatch(job[key]) or job[key] in (".", ".."):
            raise ValueError("Invalid " + key)
    if job["channel"] not in CHANNELS or job["kind"] not in KINDS:
        raise ValueError("Invalid channel or kind")
    if not isinstance(job["commit"], str) or not OID.fullmatch(job["commit"]):
        raise ValueError("Invalid commit")
    if not isinstance(job["sha256"], str) or not HASH.fullmatch(job["sha256"]):
        raise ValueError("Invalid SHA256")
    if not isinstance(job["path"], str):
        raise ValueError("Invalid file path")
    path = PurePosixPath(job["path"])
    prefix = ("channels", job["channel"], "episodes", job["episode"])
    if path.is_absolute() or ".." in path.parts or path.parts[:4] != prefix or len(path.parts) < 5:
        raise ValueError("Artifact not under its channel/episode")
    if not all(TOKEN.fullmatch(p) and p not in (".", "..") for p in path.parts):
        raise ValueError("Unsafe path component")
    if path.suffix.lower() not in KINDS[job["kind"]]:
        raise ValueError("Unsupported artifact type")
    relative = path.parts[4:]
    if job["kind"] == "video" and not (
        len(relative) == 2 and relative[0] == "previews"):
        raise ValueError("Video must be an episode preview slot")
    if job["kind"] == "storyboard" and not (
        len(relative) == 1 and relative[0] in ("plan.json", "storyboard.json", "storyboard-review.md")
        or len(relative) == 2 and relative[0] in ("storyboard", "storyboards")):
        raise ValueError("Storyboard source must use a dedicated folder or approved record name")
    if job["kind"] == "video" and "audio" in job["slot"].lower():
        raise ValueError("Protected audio slot")
    return job

def parse_queue(blob):
    doc = json.loads(blob)
    if not isinstance(doc, dict) or set(doc) != {"version", "jobs"} or doc["version"] != 1:
        raise ValueError("Unexpected queue schema")
    jobs = doc["jobs"]
    if not isinstance(jobs, list) or len(jobs) > 20:
        raise ValueError("Queue too large")
    ids = set()
    for job in jobs:
        validate(job)
        if job["id"] in ids:
            raise ValueError("Duplicate job id")
        ids.add(job["id"])
    return jobs

def artifact(repo, job):
    git(repo, "merge-base", "--is-ancestor", job["commit"], "refs/remotes/origin/" + BRANCH)
    object_name = job["commit"] + ":" + job["path"]
    mode = git(repo, "ls-tree", job["commit"], "--", job["path"]).decode().split()
    if not mode or mode[0] not in ("100644", "100755"):
        raise ValueError("Artifact is not a regular tracked file")
    length = int(git(repo, "cat-file", "-s", object_name))
    if length <= 0 or length > MAX_BYTES:
        raise ValueError("Artifact is empty or exceeds bridge size limit")
    content = git(repo, "show", object_name)
    if content.startswith(b"version https://git-lfs.github.com/spec/v1"):
        raise ValueError("Git LFS pointer is not a real media file")
    if len(content) != length or hashlib.sha256(content).hexdigest() != job["sha256"]:
        raise ValueError("Git content checksum mismatch")
    return content

def deliver(repo, base, jobs, dry_run):
    state_path = base / "bridge-delivered.json"
    state = json.loads(state_path.read_text()) if state_path.exists() else {}
    for job in jobs:
        fingerprint = hashlib.sha256(json.dumps(job, sort_keys=True).encode()).hexdigest()
        if job["id"] in state:
            if state[job["id"]] != fingerprint:
                raise ValueError("Job ID was already delivered with different content")
            print("ALREADY_DELIVERED", job["id"])
            continue
        data = artifact(repo, job)
        if dry_run:
            print("VALIDATED", job["id"], job["path"], len(data))
            continue
        with tempfile.TemporaryDirectory(prefix="studio-handoff-") as temp:
            source = Path(temp) / PurePosixPath(job["path"]).name
            source.write_bytes(data)
            cmd = [str(base / "studio-handoff.sh"), "upload", "--file", str(source),
                   "--kind", job["kind"], "--channel", job["channel"],
                   "--episode", job["episode"], "--slot", job["slot"]]
            run = subprocess.run(cmd, text=True, capture_output=True)
            if run.returncode or "VERIFIED " not in run.stdout or "LINK https://" not in run.stdout:
                raise RuntimeError("Cloud verification failed for " + job["id"] + ": " + run.stderr[-400:])
            print("DELIVERED", job["id"], "\n" + run.stdout.strip())
        state[job["id"]] = fingerprint
        with tempfile.NamedTemporaryFile(mode="w", dir=base, prefix=".bridge-", delete=False) as out:
            json.dump(state, out, sort_keys=True, indent=2)
            out.flush()
            os.fsync(out.fileno())
            pending = out.name
        os.replace(pending, state_path)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", default=str(Path.home() / "balislam"))
    parser.add_argument("--base", default=str(Path.home() / "Balislam-Preview-Sync"))
    parser.add_argument("--fetch", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    repo, base = Path(args.repo), Path(args.base)
    base.mkdir(parents=True, exist_ok=True)
    with (base / "bridge.lock").open("a+") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        if args.fetch:
            git(repo, "fetch", "origin", "+refs/heads/" + BRANCH + ":refs/remotes/origin/" + BRANCH)
        jobs = parse_queue(git(repo, "show", "refs/remotes/origin/" + BRANCH + ":" + QUEUE))
        if not args.dry_run and not (base / "studio-handoff.sh").is_file():
            raise RuntimeError("Shared Mac uploader missing")
        deliver(repo, base, jobs, args.dry_run)
        print("BRIDGE_OK", "DRY_RUN" if args.dry_run else "APPLIED", len(jobs), "jobs")

if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, ValueError, OSError, json.JSONDecodeError, BlockingIOError) as error:
        print("BRIDGE_ERROR:", error, file=sys.stderr)
        sys.exit(1)
