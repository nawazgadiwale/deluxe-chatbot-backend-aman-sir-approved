const SESSION_KEY = "deluxe_ai_session_id";

export function getSessionId() {
  if (typeof window === "undefined") {
    return null;
  }

  let sessionId = localStorage.getItem(SESSION_KEY);

  if (!sessionId) {
    sessionId = crypto.randomUUID();

    localStorage.setItem(SESSION_KEY, sessionId);
  }

  return sessionId;
}

export function createSession() {
  if (typeof window === "undefined") {
    return null;
  }

  const sessionId = crypto.randomUUID();

  localStorage.setItem(SESSION_KEY, sessionId);

  return sessionId;
}

export function resetSession() {
  if (typeof window === "undefined") {
    return null;
  }

  return createSession();
}

export function removeSession() {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.removeItem(SESSION_KEY);
}

export function hasSession() {
  if (typeof window === "undefined") {
    return false;
  }

  return Boolean(localStorage.getItem(SESSION_KEY));
}