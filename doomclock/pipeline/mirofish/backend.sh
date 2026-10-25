#!/bin/sh
# Starts the patched MiroFish backend on :5001 (task 102): MODEL_TIMEOUT=30 makes camel time out
# a stuck model call after 30 s (openai_model.py:118; max_retries stays 3). Run it inside the Herdr
# pane that hosts the backend so it stays in the foreground there.
cd "${MIROFISH_DIR:-$HOME/dev/MiroFish}/backend" || exit 1
MODEL_TIMEOUT=30 exec uv run python run.py
