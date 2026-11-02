#!/usr/bin/env python3
"""Download ZeroTTS weights once to a stable local folder for offline inference."""
import os
from pathlib import Path

from huggingface_hub import snapshot_download

ROOT = Path(__file__).resolve().parents[1]
DESTINATION = Path(os.environ.get("ZEROTTS_MODEL_PATH", ROOT / "models" / "zerotts")).resolve()
DESTINATION.mkdir(parents=True, exist_ok=True)

print(f"Downloading zeroweight-ai/ZeroTTS into: {DESTINATION}", flush=True)
snapshot_download(
    repo_id="zeroweight-ai/ZeroTTS",
    local_dir=str(DESTINATION),
    max_workers=2,
)
if not (DESTINATION / "config.json").is_file():
    raise SystemExit("Download completed, but config.json is missing from the model folder.")
print("ZeroTTS model is ready. Set ZEROTTS_MODEL_PATH to this folder to use local weights.", flush=True)
