#!/usr/bin/env python3
"""Mirror missing public runtime weights to vivibit. Run on a build host."""
import argparse
import concurrent.futures
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tarfile
import threading

from modelscope_hub import HubApi

ROOT = Path(__file__).resolve().parents[1]
CARD_LOCK = threading.Lock()


def download(urls, target, token=""):
    target.parent.mkdir(parents=True, exist_ok=True)
    partial = target.with_name(target.name + ".partial")
    if target.is_file() and target.stat().st_size:
        return
    for url in urls:
        args = ["curl", "-fLsS", "--connect-timeout", "15", "--max-time", "1800", "--speed-time", "30", "--speed-limit", "65536", "--retry", "1", "-C", "-", "-o", str(partial)]
        if token:
            args += ["-H", "Authorization: Bearer " + token]
        if subprocess.run(args + [url], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0:
            partial.rename(target)
            return
        # Candidate mirrors expose the exact same upstream object; keep partial
        # bytes when moving to another mirror instead of discarding progress.
    raise RuntimeError("download failed: " + target.name)


def github_urls(url):
    return ["https://ghfast.top/" + url, "https://gh-proxy.com/" + url, url]


def publish(item, work, keys):
    repo = item["repo"]
    api = HubApi(token=keys["modelscope"], endpoint="https://modelscope.cn")
    anonymous = HubApi(token="", endpoint="https://modelscope.cn")
    try:
        existing = Path(anonymous.download_file(repo, "model", "vsub-model.json", cache_dir=work / "sdk-cache"))
        if json.loads(existing.read_text()).get("id") == item["id"]:
            print("PUBLIC VERIFIED", repo, flush=True)
            return
    except Exception:
        pass
    spec = item["publish"]
    folder = work / item["group"] / item["id"]
    folder.mkdir(parents=True, exist_ok=True)
    if "archive" in spec and not all((folder / name).is_file() for name in item["required"]):
        archive = folder.parent / (item["id"] + ".tar.bz2")
        download(github_urls(spec["archive"]), archive)
        unpacked = folder.parent / (item["id"] + "-unpacked")
        unpacked.mkdir(exist_ok=True)
        with tarfile.open(archive) as handle:
            handle.extractall(unpacked, filter="data")
        roots = list(unpacked.iterdir())
        source = roots[0] if len(roots) == 1 and roots[0].is_dir() else unpacked
        output = folder / spec.get("archive_target", "")
        shutil.copytree(source, output, dirs_exist_ok=True)
        shutil.rmtree(unpacked)
        archive.unlink()
        (folder / ".unpacked").touch()
    for relative in spec.get("files", []):
        urls = [host + "/" + spec["hf_repo"] + "/resolve/main/" + relative for host in ["https://huggingface.co", "https://hf-mirror.com"]]
        download(urls, folder / relative, keys.get("hf", ""))
    if spec.get("hf_repo"):
        # Preserve the source model card (including licensing/attribution).
        card = work / "_upstream" / spec["hf_repo"] / "README.md"
        with CARD_LOCK:
            download([host + "/" + spec["hf_repo"] + "/resolve/main/README.md" for host in ["https://huggingface.co", "https://hf-mirror.com"]], card, keys.get("hf", ""))
        shutil.copy2(card, folder / "UPSTREAM_README.md")
    for relative, url in spec.get("extras", {}).items():
        download(github_urls(url) if url.startswith("https://github.com/") else [url], folder / relative)
    missing = [name for name in item["required"] if not (folder / name).is_file() or not (folder / name).stat().st_size]
    if missing:
        raise RuntimeError(repo + ": required files missing: " + ",".join(missing))
    (folder / ".unpacked").unlink(missing_ok=True)
    (folder / "vsub-model.json").write_text(json.dumps({k: v for k, v in item.items() if k != "publish"}, indent=2) + "\n")
    (folder / "configuration.json").write_text(json.dumps({"framework": "onnx" if item["group"] not in ["ggml", "ct2"] else "other", "task": "text-to-speech" if item["group"] == "tts" else "automatic-speech-recognition"}) + "\n")
    source_readme = folder / "README.md"
    if source_readme.is_file() and not (folder / "UPSTREAM_README.md").exists():
        source_readme.rename(folder / "UPSTREAM_README.md")
    source_readme.write_text(f"# V-Sub {item['id']}\n\nPublic runtime weights, mirrored without conversion.\n\nUpstream: {spec.get('archive') or 'https://huggingface.co/' + spec.get('hf_repo', '')}\n\nOriginal model terms and attribution apply; upstream license/readme files are retained.\n")
    checksums = []
    for file in sorted(folder.rglob("*")):
        if file.is_file() and file.name != "SHA256SUMS":
            digest = hashlib.file_digest(file.open("rb"), "sha256").hexdigest()
            checksums.append(f"{digest}  {file.relative_to(folder).as_posix()}")
    (folder / "SHA256SUMS").write_text("\n".join(checksums) + "\n")
    if not api.repo_exists(repo, "model"):
        api.create_repo(repo, "model", visibility="public", license=spec.get("license", "other"), description="V-Sub original runtime model package")
    api.upload_folder(repo, "model", str(folder), path_in_repo="", commit_message="Publish V-Sub runtime weights", max_workers=4)
    remote = json.loads(Path(anonymous.download_file(repo, "model", "vsub-model.json", cache_dir=work / "sdk-cache", force=True)).read_text())
    if remote.get("id") != item["id"]:
        raise RuntimeError(repo + ": anonymous verification failed")
    # Verify every required remote object, rather than just the descriptor.
    import urllib.request
    with urllib.request.urlopen("https://modelscope.cn/api/v1/models/" + repo + "/repo/files?Revision=master&Recursive=true") as response:
        files = {row["Path"]: row.get("Size", 0) for row in json.load(response)["Data"]["Files"]}
    if any(files.get(name) != (folder / name).stat().st_size for name in item["required"]):
        raise RuntimeError(repo + ": remote required file size mismatch")
    print("PUBLIC VERIFIED", repo, flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--keys", type=Path, required=True)
    parser.add_argument("--work-dir", type=Path, required=True)
    parser.add_argument("--workers", type=int, default=3)
    parser.add_argument("--groups", nargs="*", help="Limit publication to runtime groups, e.g. ggml")
    parser.add_argument("--id-prefixes", nargs="*", help="Limit publication to model ID prefixes")
    args = parser.parse_args()
    keys = json.loads(args.keys.read_text())
    models = [m for m in json.loads((ROOT / "catalog/modelhub.json").read_text()) if "publish" in m]
    if args.groups:
        models = [m for m in models if m["group"] in args.groups]
    if args.id_prefixes:
        models = [m for m in models if any(m["id"].startswith(prefix) for prefix in args.id_prefixes)]
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {pool.submit(publish, model, args.work_dir, keys): model for model in models}
        failed = []
        for future in concurrent.futures.as_completed(futures):
            try:
                future.result()
            except Exception as error:
                failed.append(futures[future]["repo"])
                print("FAILED", futures[future]["repo"], type(error).__name__, str(error) if isinstance(error, RuntimeError) and str(error).startswith("download failed:") else "verification/publication error", flush=True)
        if failed:
            raise SystemExit("Publication failed for: " + ", ".join(failed))
