# Speaking instead of typing

The emergency screen ("In your own words") and the Ask screen have a button
to speak instead of typing. The recording is turned into text by Whisper
running on the same laptop, so it works with no internet connection.

On the emergency screen, what you say is also used straight away to fill in
the questions. On the Ask screen, the question is asked straight away. The
text always appears in the box, so it can be checked and corrected.

## Setup (once per laptop, needs internet once)

Only the laptop used for the demo needs this. Without it, the speaking
buttons are hidden and everything works by typing.

1. Install whisper.cpp with Homebrew (Mac):

   ```bash
   brew install whisper-cpp
   ```

2. Download the English model (about 150 MB) into `private/whisper/`, which
   Git ignores. Run this from the project folder:

   ```bash
   mkdir -p private/whisper && curl -L -o private/whisper/ggml-base.en.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin
   ```

3. Restart the app. The browser asks once for permission to use the
   microphone; choose Allow.

To check Whisper on its own:

```bash
say -o private/whisper/test.wav --data-format=LEI16@16000 "I cut my left arm on a panel"
```

```bash
whisper-cli -m private/whisper/ggml-base.en.bin -f private/whisper/test.wav -nt
```

## How it works

- `frontend/js/speech.js` records from the microphone (up to 30 seconds) and
  converts the recording to 16 kHz WAV in the browser.
- `backend/ai/speech.py` checks the recording is not silent, then runs
  `whisper-cli` on it and returns the text.
- Silent recordings are rejected before Whisper runs, because Whisper tends
  to invent a word such as "you" when it hears nothing.

## Credits

whisper.cpp (MIT licence) by Georgi Gerganov and contributors, running
OpenAI's Whisper model (MIT licence).
