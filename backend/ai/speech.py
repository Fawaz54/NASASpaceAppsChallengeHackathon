"""Speech to text with Whisper (whisper.cpp), running on this laptop, offline.

Setup, once per laptop (see docs/speech.md):
    brew install whisper-cpp
    mkdir -p private/whisper
    curl -L -o private/whisper/ggml-base.en.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin

If either is missing, available() is False and the screens hide the
microphone button, so the app still works by typing.
"""
import array
import os
import shutil
import subprocess
import tempfile
from pathlib import Path

import store

MODEL_DIR = store.PRIVATE / "whisper"
MAX_BYTES = 8 * 1024 * 1024   # about four minutes of 16 kHz audio; recordings stop well before that
TIMEOUT = 40


def _program():
    return shutil.which("whisper-cli") or next(
        (p for p in ("/opt/homebrew/bin/whisper-cli", "/usr/local/bin/whisper-cli") if os.path.exists(p)), None)


def _model():
    models = sorted(MODEL_DIR.glob("ggml-*.bin"))
    preferred = [m for m in models if m.name == "ggml-base.en.bin"]
    return (preferred or models or [None])[0]


def available():
    return bool(_program() and _model())


def _too_quiet(wav):
    """True if the recording is close to silent. Whisper tends to invent words
    such as "you" or "Thank you" when it hears nothing, so silence is caught first."""
    samples = array.array("h", wav[44:len(wav) - (len(wav) - 44) % 2])
    if not samples:
        return True
    loudest = max(abs(s) for s in samples[::4])   # every 4th sample is enough to judge
    return loudest < 0.02 * 32767


def transcribe(wav):
    """Turns a WAV recording (16 kHz mono, sent by the browser) into text. Returns (text, error)."""
    if not available():
        return None, "Speech to text is not set up on this laptop."
    if not wav or len(wav) > MAX_BYTES or wav[:4] != b"RIFF":
        return None, "The recording could not be read. Try again."
    if _too_quiet(wav):
        return None, "No speech was heard. Try again, a little closer to the microphone."
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as audio:
        audio.write(wav)
        path = Path(audio.name)
    try:
        result = subprocess.run(
            [_program(), "-m", str(_model()), "-f", str(path), "-nt", "-np", "-l", "en"],
            capture_output=True, text=True, timeout=TIMEOUT)
    except subprocess.TimeoutExpired:
        return None, "Transcribing took too long. Try a shorter recording."
    finally:
        path.unlink(missing_ok=True)
    text = " ".join(result.stdout.split())
    # Whisper writes bracketed notes such as [BLANK_AUDIO] when it hears no speech.
    if not text or (text.startswith("[") and text.endswith("]")) or text.startswith("(") and text.endswith(")"):
        return None, "No speech was heard. Try again, a little closer to the microphone."
    return text, None
