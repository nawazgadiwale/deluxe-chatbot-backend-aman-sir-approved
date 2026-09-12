import crypto from "crypto";
import WhatsAppAllowlistPolicy from "./policies/WhatsAppAllowlistPolicy.js";

const defaultAllowlistPolicy = new WhatsAppAllowlistPolicy();

export default class WhatsAppSessionService {
  constructor(allowlistPolicy = null) {
    this.sessionPrefix = "whatsapp";
    this.channel = "WHATSAPP";
    this.allowlistPolicy = allowlistPolicy || defaultAllowlistPolicy;
  }

  normalizePhoneNumber(phoneNumber) {
    if (!phoneNumber) {
      return null;
    }

    const normalized = String(phoneNumber).replace(/\D/g, "").trim();
    return normalized || null;
  }

  buildVisitorId(phoneNumber, phoneNumberId = null) {
    if (!phoneNumber) {
      throw new Error("WhatsApp phone number is required.");
    }

    const sessionDigits =
      this.allowlistPolicy.normalizeToSessionDigits(phoneNumber) ||
      this.normalizePhoneNumber(phoneNumber);

    if (!sessionDigits) {
      throw new Error("WhatsApp phone number is required.");
    }

    if (phoneNumberId) {
      return `${this.sessionPrefix}:${phoneNumberId}:${sessionDigits}`;
    }

    return `${this.sessionPrefix}:${sessionDigits}`;
  }

  buildSessionId(phoneNumber, phoneNumberId = null) {
    return this.buildVisitorId(phoneNumber, phoneNumberId);
  }

  buildIdentity(phoneNumber, phoneNumberId = null) {
    const normalized = this.normalizePhoneNumber(phoneNumber);

    if (!normalized) {
      throw new Error("WhatsApp phone number is required.");
    }

    return {
      phoneNumber: normalized,

      phoneNumberId: phoneNumberId ? String(phoneNumberId).trim() : null,

      visitorId: this.buildVisitorId(normalized, phoneNumberId),

      sessionId: this.buildSessionId(normalized, phoneNumberId),

      channel: this.channel,
    };
  }

  buildVisitor({
    phoneNumber,
    name = null,
    email = null,
    company = null,
  } = {}) {
    const normalized = this.normalizePhoneNumber(phoneNumber);

    return {
      name: name ? String(name).trim() : null,

      phone: normalized,

      email: email ? String(email).trim() : null,

      company: company ? String(company).trim() : null,
    };
  }

  buildWhatsAppContext({
    phoneNumber,
    messageId = null,
    timestamp = null,
    phoneNumberId = null,
    businessAccountId = null,
    displayPhoneNumber = null,
  } = {}) {
    const identity = this.buildIdentity(phoneNumber, phoneNumberId);

    return {
      channel: this.channel,

      phoneNumber: identity.phoneNumber,

      phoneNumberId: identity.phoneNumberId,

      visitorId: identity.visitorId,

      sessionId: identity.sessionId,

      messageId,

      timestamp,

      businessAccountId,

      displayPhoneNumber,

      initiatedByCustomer: true,
    };
  }

  buildSession({
    phoneNumber,
    name = null,
    email = null,
    company = null,
    messageId = null,
    timestamp = null,
    phoneNumberId = null,
    businessAccountId = null,
    displayPhoneNumber = null,
  } = {}) {
    const identity = this.buildIdentity(phoneNumber, phoneNumberId);

    return {
      sessionId: identity.sessionId,

      visitorId: identity.visitorId,

      channel: this.channel,

      initiatedByCustomer: true,

      visitor: this.buildVisitor({
        phoneNumber,
        name,
        email,
        company,
      }),

      whatsapp: this.buildWhatsAppContext({
        phoneNumber,
        messageId,
        timestamp,
        phoneNumberId,
        businessAccountId,
        displayPhoneNumber,
      }),
    };
  }

  isWhatsAppId(value) {
    return Boolean(value && String(value).startsWith(`${this.sessionPrefix}:`));
  }

  getPhoneNumberFromVisitorId(visitorId) {
    if (!this.isWhatsAppId(visitorId)) {
      return null;
    }

    const parts = String(visitorId).split(":");
    return parts[parts.length - 1]?.trim() || null;
  }

  getPhoneNumberFromSessionId(sessionId) {
    return this.getPhoneNumberFromVisitorId(sessionId);
  }

  buildMessageCorrelationId({
    phoneNumber,
    messageId,
    phoneNumberId = null,
  } = {}) {
    const normalized = this.normalizePhoneNumber(phoneNumber);

    if (!normalized || !messageId) {
      return null;
    }

    const scope = phoneNumberId ? `${phoneNumberId}:${normalized}` : normalized;

    return crypto
      .createHash("sha256")
      .update(`${scope}:${messageId}`)
      .digest("hex");
  }
}
