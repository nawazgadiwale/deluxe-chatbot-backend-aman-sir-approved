import { EventEmitter } from "node:events";

export const WhatsAppEvents = Object.freeze({
  MESSAGE_RECEIVED: "whatsapp.message.received",
  MESSAGE_SENT: "whatsapp.message.sent",
  MESSAGE_DELIVERED: "whatsapp.message.delivered",
  MESSAGE_READ: "whatsapp.message.read",
  MESSAGE_FAILED: "whatsapp.message.failed",
  CONVERSATION_UPDATED: "whatsapp.conversation.updated",
});

class WhatsAppRealtimeService extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(100);
    this.sseClients = new Set();
  }

  static getInstance() {
    if (!global.__whatsappRealtimeServiceInstance) {
      global.__whatsappRealtimeServiceInstance = new WhatsAppRealtimeService();
    }
    return global.__whatsappRealtimeServiceInstance;
  }

  /**
   * Emit a typed WhatsApp event to local listeners and all SSE clients.
   * @param {string} eventName
   * @param {Object} payload
   */
  emitEvent(eventName, payload = {}) {
    const eventData = {
      event: eventName,
      timestamp: Date.now(),
      data: payload,
    };

    // Emit on internal EventEmitter
    this.emit(eventName, eventData);
    this.emit("*", eventData);

    // Broadcast to active SSE clients
    const sseMessage = `event: ${eventName}\ndata: ${JSON.stringify(eventData)}\n\n`;
    for (const res of this.sseClients) {
      try {
        res.write(sseMessage);
      } catch (err) {
        console.error("[WhatsApp Realtime] SSE write error:", err.message);
        this.sseClients.delete(res);
      }
    }
  }

  /**
   * Register an Express response for Server-Sent Events (SSE) streaming.
   * @param {Object} req - Express request
   * @param {Object} res - Express response
   */
  registerSSEClient(req, res) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    if (typeof res.flushHeaders === "function") {
      res.flushHeaders();
    }

    // Send initial connected event
    res.write(
      `event: connected\ndata: ${JSON.stringify({ connected: true, timestamp: Date.now() })}\n\n`,
    );

    this.sseClients.add(res);

    // Heartbeat ping every 25 seconds
    const intervalId = setInterval(() => {
      try {
        res.write(`: ping\n\n`);
      } catch {
        clearInterval(intervalId);
        this.sseClients.delete(res);
      }
    }, 25000);

    req.on("close", () => {
      clearInterval(intervalId);
      this.sseClients.delete(res);
      try {
        res.end();
      } catch {
        // ignore
      }
    });
  }
}

export default WhatsAppRealtimeService;
