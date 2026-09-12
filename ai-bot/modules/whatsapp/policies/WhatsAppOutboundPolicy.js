export const OutboundBlockReasons = Object.freeze({
  WHATSAPP_INBOUND_TRIGGER_REQUIRED: "WHATSAPP_INBOUND_TRIGGER_REQUIRED",
  CUSTOMER_SERVICE_WINDOW_EXPIRED: "CUSTOMER_SERVICE_WINDOW_EXPIRED",
  INVALID_CUSTOMER_IDENTITY: "INVALID_CUSTOMER_IDENTITY",
  OUTBOUND_RECIPIENT_MISMATCH: "OUTBOUND_RECIPIENT_MISMATCH",
  INVALID_INBOUND_MESSAGE: "INVALID_INBOUND_MESSAGE",
  DUPLICATE_INBOUND_MESSAGE: "DUPLICATE_INBOUND_MESSAGE",
  INVALID_WEBHOOK_SIGNATURE: "INVALID_WEBHOOK_SIGNATURE",
  INVALID_ACTION: "INVALID_ACTION",
  INVALID_PAYLOAD: "INVALID_PAYLOAD",
  WHATSAPP_CONFIGURATION_MISSING: "WHATSAPP_CONFIGURATION_MISSING",
});

/**
 * WhatsAppOutboundPolicy
 *
 * Deterministic Outbound Authorization Policy for Meta WhatsApp Business Cloud API.
 * Enforces strict inbound-only response rules, recipient identity binding,
 * 24-hour customer service window, payload validity, and Meta API credentials.
 *
 * The LLM is NEVER the source of truth for outbound send authorization.
 */
export default class WhatsAppOutboundPolicy {
  constructor({ windowPolicy = null } = {}) {
    this.windowPolicy = windowPolicy;
  }

  normalizePhoneNumber(phone) {
    if (!phone) {
      return null;
    }
    const digits = String(phone).replace(/\D/g, "").trim();
    return digits || null;
  }

  /**
   * Evaluates all authorization criteria before calling Meta Graph API.
   *
   * @param {Object} params
   * @param {string} params.to - Intended recipient phone number
   * @param {Object} params.message - WhatsApp payload to send
   * @param {Object} [params.inboundTriggerContext] - Trigger context from verified inbound customer message
   * @param {number} [params.lastUserMessageAt] - Timestamp of verified inbound customer message
   * @param {number} [params.now] - Current server timestamp immediately before Meta API execution
   * @param {Object} [params.credentials] - WhatsApp credentials ({ accessToken, phoneNumberId })
   * @param {boolean} [params.isDuplicate] - Whether message ID is already processed
   * @returns {{ allowed: boolean, blocked: boolean, reason: string|null, windowRemainingMs: number, windowExpiresAt: number|null }}
   */
  authorizeOutbound({
    to,
    message,
    inboundTriggerContext = {},
    lastUserMessageAt = null,
    now = Date.now(),
    credentials = {},
    isDuplicate = false,
  } = {}) {
    // 1. Mandatory Inbound Trigger Context
    if (inboundTriggerContext?.triggeredByInboundMessage !== true) {
      return this.block(OutboundBlockReasons.WHATSAPP_INBOUND_TRIGGER_REQUIRED);
    }

    // 2. Inbound Message ID required
    const inboundMessageId = inboundTriggerContext.inboundMessageId;
    if (!inboundMessageId || typeof inboundMessageId !== "string" || !inboundMessageId.trim()) {
      return this.block(OutboundBlockReasons.INVALID_INBOUND_MESSAGE);
    }

    // 3. Inbound Customer Identity required
    const inboundCustomerWaId = this.normalizePhoneNumber(inboundTriggerContext.customerWaId);
    if (!inboundCustomerWaId) {
      return this.block(OutboundBlockReasons.INVALID_CUSTOMER_IDENTITY);
    }

    // 4. Recipient Identity Binding (Outbound recipient MUST match inbound customer)
    const outboundRecipient = this.normalizePhoneNumber(to);
    if (!outboundRecipient) {
      return this.block(OutboundBlockReasons.INVALID_CUSTOMER_IDENTITY);
    }

    if (outboundRecipient !== inboundCustomerWaId) {
      return this.block(OutboundBlockReasons.OUTBOUND_RECIPIENT_MISMATCH);
    }

    // 5. Inbound Webhook Authentication
    if (inboundTriggerContext.authenticated === false) {
      return this.block(OutboundBlockReasons.INVALID_WEBHOOK_SIGNATURE);
    }

    // 6. Duplicate message protection
    if (isDuplicate || inboundTriggerContext.isDuplicate === true) {
      return this.block(OutboundBlockReasons.DUPLICATE_INBOUND_MESSAGE);
    }

    // 7. Outbound Payload Validity
    if (!message || typeof message !== "object" || !message.type) {
      return this.block(OutboundBlockReasons.INVALID_PAYLOAD);
    }

    // 8. 24-Hour Customer Service Window Guard (Meta Cloud API Policy)
    const effectiveInboundTimestamp =
      lastUserMessageAt ??
      inboundTriggerContext.inboundReceivedAt ??
      (this.windowPolicy ? this.windowPolicy.getLastUserMessageAt(inboundCustomerWaId) : null);

    if (!effectiveInboundTimestamp) {
      return this.block(OutboundBlockReasons.CUSTOMER_SERVICE_WINDOW_EXPIRED);
    }

    let windowExpiresAt = null;
    let remainingMs = 86400000;

    if (this.windowPolicy) {
      const windowCheck = this.windowPolicy.checkOutboundEligibility({
        lastUserMessageAt: effectiveInboundTimestamp,
        now,
      });

      if (!windowCheck.allowed) {
        return this.block(
          OutboundBlockReasons.CUSTOMER_SERVICE_WINDOW_EXPIRED,
          windowCheck.remainingMs,
          windowCheck.windowExpiresAt,
        );
      }
      remainingMs = windowCheck.remainingMs;
      windowExpiresAt = windowCheck.windowExpiresAt;
    } else {
      const windowDurationMs = 24 * 60 * 60 * 1000;
      windowExpiresAt = Number(effectiveInboundTimestamp) + windowDurationMs;
      if (now >= windowExpiresAt) {
        return this.block(OutboundBlockReasons.CUSTOMER_SERVICE_WINDOW_EXPIRED, 0, windowExpiresAt);
      }
      remainingMs = Math.max(0, windowExpiresAt - now);
    }

    // 9. Meta API Credentials Configuration
    const token =
      credentials.accessToken || process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneId =
      credentials.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;
    if (!token || !phoneId) {
      return this.block(OutboundBlockReasons.WHATSAPP_CONFIGURATION_MISSING);
    }

    return {
      allowed: true,
      blocked: false,
      reason: null,
      windowRemainingMs: remainingMs,
      windowExpiresAt,
    };
  }

  block(reason, remainingMs = 0, windowExpiresAt = null) {
    return {
      allowed: false,
      blocked: true,
      reason,
      windowRemainingMs: remainingMs,
      windowExpiresAt,
    };
  }
}
