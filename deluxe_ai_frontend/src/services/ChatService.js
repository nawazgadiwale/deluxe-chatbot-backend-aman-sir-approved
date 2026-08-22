import api from "./api";

class ChatService {
  // =====================================================
  // SEND MESSAGE
  // POST /v1/api/ai/chat
  // =====================================================

  async sendMessage(sessionId, message = "", action = null) {
    const payload = {
      sessionId,
      message,
    };

    if (action) {
      payload.action = action;
    }

    const response = await api.post("/chat", payload);

    // Backend returns the UI response inside `response`
    return response.response;
  }
  // =====================================================
  // GET CONVERSATION
  // GET /v1/api/ai/conversation/:sessionId
  // =====================================================

  async getConversation(sessionId) {
    return await api.get(`/conversation/${sessionId}`);
  }

  // =====================================================
  // COMPLETE CONVERSATION
  // POST /v1/api/ai/conversation/:sessionId/complete
  // =====================================================

  async completeConversation(sessionId) {
    return await api.post(`/conversation/${sessionId}/complete`);
  }
}

export default new ChatService();
