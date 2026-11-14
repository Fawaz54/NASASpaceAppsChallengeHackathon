// Owner: Frontend 1. The only place the frontend talks to the backend.
// If /api/state fails, getState() returns the saved example in mock/state.json,
// so the screens still draw while the backend is being changed.

export async function getState() {
  try {
    const response = await fetch("/api/state");
    if (!response.ok) throw new Error(response.status);
    return await response.json();
  } catch {
    return (await fetch("mock/state.json")).json();
  }
}

export async function setScenario(name) {
  await fetch("/api/scenario", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
}

// TODO (Frontend 2): sendCheckin(data) -> POST /api/checkin
// TODO (Frontend 3): ask(question) -> POST /api/ask
