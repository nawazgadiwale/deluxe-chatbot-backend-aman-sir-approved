const KEY = "deluxe_ai_session";

class SessionService {
  getSessionId() {
    if (typeof window === "undefined") return null;

    let id = localStorage.getItem(KEY);

    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(KEY, id);
    }

    return id;
  }

  newSession() {
    const id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
    return id;
  }

  clear() {
    localStorage.removeItem(KEY);
  }
}

export default new SessionService();
