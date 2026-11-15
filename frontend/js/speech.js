// "Speak instead of typing": records from the microphone, sends the audio to
// this laptop's own Whisper (backend/ai/speech.py) and hands back the text.
// Nothing leaves the laptop, so it works offline.
//
// Whisper reads plain WAV files, so the recording is converted here to
// 16 kHz mono WAV, whatever format the browser recorded in.
import { h } from "./common.js";
import { session } from "./session.js";

const MAX_SECONDS = 30;
const RATE = 16000;

export async function toWav(blob) {   // exported so it can be tested on its own
  const raw = await blob.arrayBuffer();
  const decoded = await new AudioContext().decodeAudioData(raw);
  const length = Math.max(1, Math.ceil(decoded.duration * RATE));
  const offline = new OfflineAudioContext(1, length, RATE);   // one channel at 16 kHz
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start();
  const samples = (await offline.startRendering()).getChannelData(0);

  const wav = new DataView(new ArrayBuffer(44 + samples.length * 2));
  const text = (offset, value) => [...value].forEach((c, i) => wav.setUint8(offset + i, c.charCodeAt(0)));
  text(0, "RIFF"); wav.setUint32(4, 36 + samples.length * 2, true); text(8, "WAVE");
  text(12, "fmt "); wav.setUint32(16, 16, true); wav.setUint16(20, 1, true); wav.setUint16(22, 1, true);
  wav.setUint32(24, RATE, true); wav.setUint32(28, RATE * 2, true); wav.setUint16(32, 2, true); wav.setUint16(34, 16, true);
  text(36, "data"); wav.setUint32(40, samples.length * 2, true);
  samples.forEach((s, i) => wav.setInt16(44 + i * 2, Math.max(-1, Math.min(1, s)) * 0x7fff, true));
  return new Blob([wav], { type: "audio/wav" });
}

async function sendToWhisper(wav) {
  const user = session.get();
  const response = await fetch("/api/speech", {
    method: "POST", body: wav,
    headers: { "Content-Type": "audio/wav", ...(user ? { "X-User": user.username } : {}) },
  });
  return response.json();
}

// Returns a button, plus a status line under it. onText(text) is called with what was said.
// Returns null when speech to text is not set up on this laptop, so screens can skip it.
export function micButton({ available, onText, label = "Speak instead of typing" }) {
  if (!available || !navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) return null;
  const button = h("button", { type: "button" }, label);
  const note = h("span", { class: "muted small", role: "status" });
  let recorder = null, stream = null, timer = null, seconds = 0;

  const idle = () => { button.textContent = label; button.classList.remove("help"); button.disabled = false; };

  async function start() {
    note.textContent = "";
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      note.textContent = "The microphone is blocked. Allow it in the browser's address bar, then try again.";
      return;
    }
    const chunks = [];
    recorder = new MediaRecorder(stream);
    recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
    recorder.onstop = async () => {
      clearInterval(timer);
      stream.getTracks().forEach((track) => track.stop());
      button.textContent = "Writing it down…";
      button.classList.remove("help");
      button.disabled = true;
      try {
        const result = await sendToWhisper(await toWav(new Blob(chunks, { type: recorder.mimeType })));
        if (result.error) note.textContent = result.error;
        else { note.textContent = ""; onText(result.text); }
      } catch {
        note.textContent = "That recording could not be turned into text. Try again.";
      }
      idle();
    };
    recorder.start();
    seconds = 0;
    button.classList.add("help");
    button.textContent = `Stop and use what I said (0 s)`;
    note.textContent = "Listening…";
    timer = setInterval(() => {
      seconds += 1;
      button.textContent = `Stop and use what I said (${seconds} s)`;
      if (seconds >= MAX_SECONDS) recorder.stop();
    }, 1000);
  }

  button.addEventListener("click", () => {
    if (recorder && recorder.state === "recording") recorder.stop();
    else start();
  });
  idle();
  return h("div", { class: "row", style: "margin-top:8px" }, button, note);
}
