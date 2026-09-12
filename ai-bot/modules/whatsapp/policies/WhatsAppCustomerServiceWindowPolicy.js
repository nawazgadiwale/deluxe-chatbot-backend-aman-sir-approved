/**
 * WhatsAppCustomerServiceWindowPolicy.js
 *
 * Implements the WhatsApp 24-hour Customer Service Window business policy.
 *
 * Strict Rules:
 * 1. Customer service window is exactly 24 hours from the most recent verified inbound customer message.
 * 2. Window is OPEN when now < (lastUserMessageAt + 24 hours).
 * 3. Window is CLOSED when now >= (lastUserMessageAt + 24 hours).
 * 4. Exact boundary (now === lastUserMessageAt + 24 hours) is strictly CLOSED.
 * 5. Bot responses, system events, and delivery/read receipts DO NOT extend the window.
 * 6. Outbound messages are strictly blocked when the window is closed.
 * 7. Isolated per conversation (customer_wa_id).
 */

export const WINDOW_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours in ms
const MAX_FUTURE_DRIFT_MS = 5 * 60 * 1000; // 5 minutes clock drift allowance

export default class WhatsAppCustomerServiceWindowPolicy {
  constructor({ windowDurationMs = WINDOW_DURATION_MS } = {}) {
    this.windowDurationMs = windowDurationMs;
    // In-memory conversation window store: Map<customerWaId, lastUserMessageAtMs>
    this.conversationWindows = new Map();
  }

  // =====================================================
  // CORE WINDOW CALCULATIONS
  // =====================================================

  /**
   * Calculate exact window expiry timestamp for a given last customer message timestamp.
   * @param {number|Date|string} lastUserMessageAt
   * @returns {number|null} Expiry timestamp in ms, or null if invalid.
   */
  getWindowExpiry(lastUserMessageAt) {
    const timestamp = this.normalizeTimestamp(lastUserMessageAt);
    if (timestamp == null) {
      return null;
    }
    return timestamp + this.windowDurationMs;
  }

  /**
   * Determine if the customer service window is open.
   * Strict rule: now < expiry (at exact boundary now >= expiry, window is CLOSED).
   * @param {number|Date|string} lastUserMessageAt
   * @param {number|Date|string} now
   * @returns {boolean}
   */
  isWindowOpen(lastUserMessageAt, now = Date.now()) {
    const expiry = this.getWindowExpiry(lastUserMessageAt);
    if (expiry == null) {
      return false;
    }
    const current = this.normalizeTimestamp(now);
    if (current == null) {
      return false;
    }
    return current < expiry;
  }

  /**
   * Determine if the customer service window is expired.
   * Strict rule: now >= expiry or no inbound customer message timestamp.
   * @param {number|Date|string} lastUserMessageAt
   * @param {number|Date|string} now
   * @returns {boolean}
   */
  isWindowExpired(lastUserMessageAt, now = Date.now()) {
    return !this.isWindowOpen(lastUserMessageAt, now);
  }

  /**
   * Get remaining milliseconds in the customer service window.
   * Returns 0 if expired.
   * @param {number|Date|string} lastUserMessageAt
   * @param {number|Date|string} now
   * @returns {number}
   */
  getRemainingMilliseconds(lastUserMessageAt, now = Date.now()) {
    const expiry = this.getWindowExpiry(lastUserMessageAt);
    if (expiry == null) {
      return 0;
    }
    const current = this.normalizeTimestamp(now);
    if (current == null) {
      return 0;
    }
    const remaining = expiry - current;
    return remaining > 0 ? remaining : 0;
  }

  // =====================================================
  // OUTBOUND ELIGIBILITY GUARD
  // =====================================================

  /**
   * Evaluates if an outbound message is eligible for delivery under WhatsApp policy.
   * In Phase 1: No automatic send outside window even for templates.
   *
   * @param {Object} params
   * @param {number|Date|string} params.lastUserMessageAt - Timestamp of last inbound customer message.
   * @param {number|Date|string} [params.now] - Current timestamp (defaults to Date.now()).
   * @param {boolean} [params.isTemplate=false] - Whether this is an approved template message.
   * @returns {{ allowed: boolean, blocked: boolean, reason: string|null, remainingMs: number, windowExpiresAt: number|null }}
   */
  checkOutboundEligibility({
    lastUserMessageAt,
    now = Date.now(),
    isTemplate = false,
  } = {}) {
    const open = this.isWindowOpen(lastUserMessageAt, now);
    const remainingMs = this.getRemainingMilliseconds(lastUserMessageAt, now);
    const windowExpiresAt = this.getWindowExpiry(lastUserMessageAt);

    if (!open) {
      return {
        allowed: false,
        blocked: true,
        reason: "CUSTOMER_SERVICE_WINDOW_EXPIRED",
        remainingMs: 0,
        windowExpiresAt,
      };
    }

    return {
      allowed: true,
      blocked: false,
      reason: null,
      remainingMs,
      windowExpiresAt,
    };
  }

  // =====================================================
  // CONVERSATION TRACKING (Per Customer Identity)
  // =====================================================

  /**
   * Record arrival of a verified inbound customer message to open/reset the 24h window.
   * @param {string} conversationId - e.g. customer phone number or session ID.
   * @param {number|Date|string} [timestamp=Date.now()]
   */
  recordInboundCustomerMessage(conversationId, timestamp = Date.now()) {
    if (!conversationId) {
      return;
    }
    const normalizedTime = this.normalizeTimestamp(timestamp);
    if (normalizedTime != null) {
      this.conversationWindows.set(String(conversationId), normalizedTime);
    }
  }

  /**
   * Get the last inbound customer message timestamp for a conversation.
   * @param {string} conversationId
   * @returns {number|null}
   */
  getLastUserMessageAt(conversationId) {
    if (!conversationId) {
      return null;
    }
    return this.conversationWindows.get(String(conversationId)) ?? null;
  }

  /**
   * Asynchronously resolve last inbound customer message timestamp from memory or MongoDB.
   * Enables 24-hour policy to survive process/server restarts.
   * @param {string} conversationId
   * @param {Object} [conversationRepository]
   * @returns {Promise<number|null>}
   */
  async getLastUserMessageAtAsync(
    conversationId,
    conversationRepository = null,
  ) {
    if (!conversationId) {
      return null;
    }

    const inMemory = this.getLastUserMessageAt(conversationId);
    if (inMemory != null) {
      return inMemory;
    }

    if (!conversationRepository) {
      return null;
    }

    try {
      let conv = null;
      if (String(conversationId).startsWith("whatsapp:")) {
        conv = await conversationRepository.findBySessionId(
          String(conversationId),
        );
      } else {
        const cleanWaId = String(conversationId).replace(/\D/g, "");
        if (cleanWaId) {
          conv = await conversationRepository.findByCustomerWaId(cleanWaId);
          if (!conv) {
            conv = await conversationRepository.findBySessionId(
              `whatsapp:${cleanWaId}`,
            );
          }
        }
      }

      if (conv?.lastUserMessageAt) {
        const normalized = this.normalizeTimestamp(conv.lastUserMessageAt);
        if (normalized != null) {
          this.recordInboundCustomerMessage(conversationId, normalized);
          return normalized;
        }
      }
    } catch (err) {
      // Database not connected or error during lookup
      console.warn("[WhatsApp Policy] DB lookup warning:", err.message);
    }

    return null;
  }

  /**
   * Clear window state for a conversation (or all conversations).
   * @param {string} [conversationId]
   */
  clear(conversationId = null) {
    if (conversationId) {
      this.conversationWindows.delete(String(conversationId));
    } else {
      this.conversationWindows.clear();
    }
  }

  // =====================================================
  // HELPER & TIMESTAMP NORMALIZATION
  // =====================================================

  normalizeTimestamp(val) {
    if (val == null) {
      return null;
    }

    let parsed = null;

    if (typeof val === "number") {
      if (!Number.isFinite(val) || val <= 0) {
        return null;
      }
      // If unix epoch in seconds (e.g. Meta webhook timestamp: 1725184800), convert to ms
      parsed = val < 10000000000 ? val * 1000 : val;
    } else if (val instanceof Date) {
      const ms = val.getTime();
      if (!Number.isFinite(ms) || ms <= 0) {
        return null;
      }
      parsed = ms;
    } else if (typeof val === "string") {
      const trimmed = val.trim();
      if (!trimmed) {
        return null;
      }
      const num = Number(trimmed);
      if (Number.isFinite(num) && num > 0) {
        parsed = num < 10000000000 ? num * 1000 : num;
      } else {
        const dateMs = Date.parse(trimmed);
        if (Number.isFinite(dateMs) && dateMs > 0) {
          parsed = dateMs;
        }
      }
    }

    return parsed;
  }
}
