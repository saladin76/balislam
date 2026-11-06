#!/usr/bin/env python3
"""Upload one completed video to Google Drive. No scanning, no Mac deletion."""
import argparse
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
from datetime import datetime, timezone

CHANNELS = {"balislam":"bilislam","dafatir-alzaman":"dafatir-alzaman","zubdat-alkutub":"zubdat-al-kutub"}
ROOT = "studio_drive:Balislam-Studio-Previews"
SAFE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]{0,100}$")
KINDS = {"video": ("previews", {".mp4", ".webm"}), "storyboard": ("storyboard", {".md", ".json", ".pdf", ".png", ".jpg", ".jpeg", ".webp"})}

def run(*args):
    result = subprocess.run(args, capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError("rclone failed: " + result.stderr.strip())
    return result.stdout.strip()

def md5(path):
    h = hashlib.md5()
    with open(path, "rb") as file:
        for block in iter(lambda: file.read(1048576), b""):
            h.update(block)
    return h.hexdigest()

def cloud_md5(path):
    out = run("rclone", "md5sum", path)
    return out.split()[0].lower() if out else ""

def atomic_json(path, data):
    fd, tmp = tempfile.mkstemp(prefix=".cloud-index-", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)

def upload(a):
    source = Path(a.file).expanduser().resolve(strict=True)
    kind = getattr(a, "kind", "video")
    folder, allowed = KINDS[kind]
    if not source.is_file() or source.suffix.lower() not in allowed or not source.stat().st_size:
        raise ValueError("Expected a nonempty completed file of supported kind")
    for value in (a.episode, a.slot):
        if not SAFE.fullmatch(value) or value in (".", ".."):
            raise ValueError("Unsafe episode or slot")
    channel = CHANNELS[a.channel]
    cloud = f"{ROOT}/{channel}/episodes/{a.episode}/{folder}/{a.slot}{source.suffix.lower()}"
    base = Path(os.environ.get("BAL_PREVIEW_HOME", str(Path.home() / "Balislam-Preview-Sync")))
    base.mkdir(parents=True, exist_ok=True)
    with (base / "preview-cloud.lock").open("a+") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        before = source.stat()
        digest = md5(source)
        if (source.stat().st_mtime_ns, source.stat().st_size) != (before.st_mtime_ns, before.st_size):
            raise RuntimeError("Source changed during checksum")
        try:
            current = cloud_md5(cloud) == digest
        except RuntimeError:
            current = False
        if not current:
            run("rclone", "copyto", str(source), cloud, "--retries", "3")
        if cloud_md5(cloud) != digest:
            raise RuntimeError("Cloud checksum mismatch: index NOT updated")
        if (source.stat().st_mtime_ns, source.stat().st_size) != (before.st_mtime_ns, before.st_size):
            raise RuntimeError("Source changed during upload: index NOT updated")
        url = run("rclone", "link", cloud)
        if not url.startswith("https://"):
            raise RuntimeError("No preview URL")
        manifest = base / "preview-cloud-index.json"
        index = json.loads(manifest.read_text(encoding="utf-8")) if manifest.exists() else {}
        key = f"{channel}|{a.episode}|{a.slot}|{source.suffix.lower()[1:]}" if kind == "video" else f"{channel}|{a.episode}|storyboard|{a.slot}|{source.suffix.lower()[1:]}"
        index[key] = {"remote":cloud,"url":url,"md5":digest,"updated":datetime.now(timezone.utc).isoformat()}
        atomic_json(manifest, index)
        handoff = write_handoff(base, index, channel, a.episode)
        # A stable per-episode review handoff accessible to cloud reviewers.
        # No credentials or original media are stored in this text-only report.
        handoff_cloud = f"{ROOT}/{channel}/episodes/{a.episode}/handoff.md"
        run("rclone", "copyto", str(handoff), handoff_cloud)
        if cloud_md5(handoff_cloud) != md5(handoff):
            raise RuntimeError("Cloud handoff checksum mismatch")
        handoff_url = run("rclone", "link", handoff_cloud)
        if not handoff_url.startswith("https://"):
            raise RuntimeError("No handoff URL")
        lines = ["# Balislam Studio - Live Previews", "", "Updated: "+datetime.now(timezone.utc).isoformat(), ""]
        for name, item in sorted(index.items()):
            lines.append("- [" + name.replace("|", " / ") + "](" + item["url"] + ")")
        md = base / "preview-cloud-index.md"
        md.write_text("\n".join(lines)+"\n", encoding="utf-8")
        # Separate index: never overwrite existing legacy index without review.
        run("rclone", "copyto", str(md), ROOT + "/production-preview-index.md")
        print("VERIFIED "+cloud+"\nLINK "+url+"\nHANDOFF "+str(handoff)+"\nHANDOFF_LINK "+handoff_url)


def make_handoff(index, channel, episode):
    """A channel-scoped handoff. No approval or publication is inferred."""
    prefix = channel + "|" + episode + "|"
    items = [(key, item) for key, item in index.items() if key.startswith(prefix)]
    lines = [
        "# Balislam Studio — Review Handoff",
        "",
        "Channel: " + channel,
        "Episode: " + episode,
        "Generated (UTC): " + datetime.now(timezone.utc).isoformat(),
        "Review status: PENDING — no visual approval inferred",
        "",
        "## Review files",
        "",
    ]
    if not items:
        lines.append("No verified uploaded files in the local index.")
    for key, item in sorted(items):
        part = key[len(prefix):].replace("|", " / ")
        lines.extend([
            "- " + part + ": " + item["url"],
            "  - MD5: " + item["md5"],
            "  - Verified upload: " + item["updated"],
        ])
    lines.extend([
        "",
        "## For the reviewer (ChatGPT)",
        "",
        "Check the linked storyboard and videos; inspect content, framing, transitions and timing.",
        "Record exact defects with scene IDs and give the next directive to Claude.",
        "Do not mark a deliverable approved merely because it was uploaded.",
        "",
        "## For the implementer (Claude)",
        "",
        "Include commands executed, tests, files changed, known limitations, and any failures in the execution report.",
        "Re-upload updated artifacts into their existing logical slots.",
        "",
    ])
    return "\n".join(lines)

def write_handoff(base, index, channel, episode):
    directory = base / "handoffs" / channel
    directory.mkdir(parents=True, exist_ok=True)
    destination = directory / (episode + ".md")
    destination.write_text(make_handoff(index, channel, episode), encoding="utf-8")
    return destination

def handoff_report(a):
    for value in (a.episode,):
        if not SAFE.fullmatch(value):
            raise ValueError("Unsafe episode")
    channel = CHANNELS[a.channel]
    base = Path(os.environ.get("BAL_PREVIEW_HOME", str(Path.home() / "Balislam-Preview-Sync")))
    index_file = base / "preview-cloud-index.json"
    if not index_file.exists():
        raise ValueError("No verified previews in local index")
    index = json.loads(index_file.read_text(encoding="utf-8"))
    report = write_handoff(base, index, channel, a.episode)
    print("HANDOFF " + str(report))

def cleanup_report(a):
    record = json.loads(Path(a.publish_json).expanduser().read_text(encoding="utf-8"))
    if record.get("status") != "published" or record.get("approved") is not True or not str(record.get("url","")).startswith("https://"):
        raise ValueError("Missing approved published record with URL")
    print("PUBLISH_RECORD_VALID. Local deletion DISABLED; original source and masters protected.")

def main():
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)
    p = sub.add_parser("upload")
    p.add_argument("--file", required=True)
    p.add_argument("--channel", required=True, choices=CHANNELS.keys())
    p.add_argument("--episode", required=True)
    p.add_argument("--slot", required=True)
    p.add_argument("--kind", choices=KINDS.keys(), default="video")
    p.set_defaults(action=upload)
    p = sub.add_parser("handoff")
    p.add_argument("--channel", required=True, choices=CHANNELS.keys())
    p.add_argument("--episode", required=True)
    p.set_defaults(action=handoff_report)
    p = sub.add_parser("cleanup-report")
    p.add_argument("--publish-json", required=True)
    p.set_defaults(action=cleanup_report)
    a = parser.parse_args()
    try:
        a.action(a)
    except (OSError, RuntimeError, ValueError, json.JSONDecodeError) as e:
        print("ERROR: "+str(e),file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
