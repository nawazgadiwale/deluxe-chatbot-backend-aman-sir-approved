import crypto from "crypto";

export default class WhatsAppFlowTokenService {
  constructor() {
    this.maxAgeMs =
      Number(process.env.WHATSAPP_FLOW_TOKEN_MAX_AGE_MS) || 30 * 60 * 1000;
  }

  getSecret() {
    return process.env.WHATSAPP_FLOW_TOKEN_SECRET || null;
  }

  create({
    type,
    sessionId,
    phoneNumber,
    formId = null,
    requestType = null,
    productId = null,
    conversationId = null,
    workflow = null,
    purpose = null,
  } = {}) {
    const secret = this.getSecret();
    if (!secret) {
      console.error(
        "[WhatsApp Flow] Cannot create token: No flow secret configured.",
      );
      return null;
    }

    const payload = {
      type,
      sessionId,
      conversationId: conversationId ? String(conversationId) : null,
      phoneNumber: phoneNumber ? String(phoneNumber).replace(/\D/g, "") : null,
      productId: productId ? String(productId) : null,
      workflow: workflow ? String(workflow) : null,
      purpose: purpose ? String(purpose) : null,
      formId,
      requestType,
      createdAt: Date.now(),
    };

    const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");

    const signature = crypto
      .createHmac("sha256", secret)
      .update(encoded)
      .digest("base64url");

    return `${encoded}.${signature}`;
  }

  verify(token) {
    if (!token) {
      return null;
    }

    const secret = this.getSecret();
    if (!secret) {
      console.error(
        "[WhatsApp Flow] Cannot verify token: No flow secret configured.",
      );
      return null;
    }

    const parts = String(token).split(".");

    if (parts.length !== 2) {
      return null;
    }

    const [encoded, receivedSignature] = parts;

    try {
      const expectedSignature = crypto
        .createHmac("sha256", secret)
        .update(encoded)
        .digest("base64url");

      const expected = Buffer.from(expectedSignature);
      const received = Buffer.from(receivedSignature);

      if (
        expected.length !== received.length ||
        !crypto.timingSafeEqual(expected, received)
      ) {
        return null;
      }

      const payload = JSON.parse(
        Buffer.from(encoded, "base64url").toString("utf8"),
      );

      if (!payload?.createdAt) {
        return null;
      }

      if (Date.now() - Number(payload.createdAt) > this.maxAgeMs) {
        return null;
      }

      return payload;
    } catch {
      return null;
    }
  }
}
