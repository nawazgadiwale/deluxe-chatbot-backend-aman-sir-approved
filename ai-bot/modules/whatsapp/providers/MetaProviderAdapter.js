/**
 * MetaProviderAdapter.js
 *
 * Production Meta WhatsApp Business Cloud API Transport Adapter (Graph API v23.0).
 *
 * Encapsulates Meta Graph API endpoints, HMAC SHA-256 signature validation,
 * hub.challenge GET verification, Meta inbound event normalization,
 * and 24-hour customer service window enforcement.
 */

import crypto from "crypto";
import WhatsappActionCodec from "../WhatsappActionCodec.js";
import WhatsAppCustomerServiceWindowPolicy from "../policies/WhatsAppCustomerServiceWindowPolicy.js";

export default class MetaProviderAdapter {
  constructor(config = {}) {
    this.config = config;
    this.accessToken =
      config.accessToken !== undefined
        ? config.accessToken
        : process.env.WHATSAPP_ACCESS_TOKEN || null;
    this.phoneNumberId =
      config.phoneNumberId !== undefined
        ? config.phoneNumberId
        : process.env.WHATSAPP_PHONE_NUMBER_ID || null;
    this.appSecret =
      config.appSecret !== undefined
        ? config.appSecret
        : process.env.WHATSAPP_APP_SECRET || null;
    this.verifyToken =
      config.verifyToken !== undefined
        ? config.verifyToken
        : process.env.WHATSAPP_VERIFY_TOKEN || null;
    this.graphApiVersion =
      config.graphApiVersion ||
      process.env.WHATSAPP_GRAPH_API_VERSION ||
      "v23.0";
    this.baseUrl = `https://graph.facebook.com/${this.graphApiVersion}`;
    this.windowPolicy =
      config.windowPolicy || new WhatsAppCustomerServiceWindowPolicy();
  }

  get name() {
    return "meta";
  }

  getCapabilities() {
    return {
      interactiveButtons: true,
      interactiveLists: true,
      templates: true,
      media: true,
      customerServiceWindow: true,
      nativeFlows: false,
    };
  }

  // =====================================================
  // WEBHOOK VERIFICATION & AUTHENTICATION
  // =====================================================

  verifyWebhook(req) {
    const mode = req.query?.["hub.mode"] ?? req.query?.mode;
    const token = req.query?.["hub.verify_token"] ?? req.query?.token;
    const challenge = req.query?.["hub.challenge"] ?? req.query?.challenge;

    if (mode !== "subscribe") {
      return {
        verified: false,
        challenge: null,
        status: 403,
        body: "Forbidden",
      };
    }

    const expectedToken = this.verifyToken;
    if (!expectedToken) {
      console.error("[Meta] WHATSAPP_VERIFY_TOKEN is not configured.");
      return {
        verified: false,
        challenge: null,
        status: 403,
        body: "Forbidden",
      };
    }

    if (!token || !challenge || token !== expectedToken) {
      console.warn("[Meta] Webhook verification token mismatch.");
      return {
        verified: false,
        challenge: null,
        status: 403,
        body: "Forbidden",
      };
    }

    return { verified: true, challenge, status: 200, body: challenge };
  }

  authenticateWebhook(req) {
    const appSecret = this.appSecret;
    if (!appSecret) {
      console.error(
        "[Meta] WHATSAPP_APP_SECRET is not configured. Failing closed.",
      );
      return {
        authenticated: false,
        status: 403,
        error: "Missing security configuration",
      };
    }

    const signature =
      req.headers?.["x-hub-signature-256"] ??
      req.headers?.["x-hub-signature"] ??
      null;

    if (!signature) {
      return {
        authenticated: false,
        status: 403,
        error: "Missing signature",
      };
    }

    try {
      const rawBody =
        req.rawBody || Buffer.from(JSON.stringify(req.body || {}));
      const cleanSignature = signature.startsWith("sha256=")
        ? signature.slice(7)
        : signature;

      const expectedHex = crypto
        .createHmac("sha256", appSecret)
        .update(rawBody)
        .digest("hex");

      const expectedBuffer = Buffer.from(expectedHex, "utf8");
      const receivedBuffer = Buffer.from(cleanSignature, "utf8");

      if (expectedBuffer.length !== receivedBuffer.length) {
        return {
          authenticated: false,
          status: 403,
          error: "Invalid signature",
        };
      }

      const isValid = crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
      if (!isValid) {
        return {
          authenticated: false,
          status: 403,
          error: "Invalid signature",
        };
      }

      return { authenticated: true, status: 200, error: null };
    } catch (err) {
      console.error("[Meta] Signature verification exception:", err.message);
      return {
        authenticated: false,
        status: 403,
        error: "Invalid signature",
      };
    }
  }

  // =====================================================
  // INBOUND NORMALIZATION
  // =====================================================

  normalizeInbound(reqBody = {}, authContext = {}, reqHeaders = {}) {
    const events = [];

    if (reqBody.object !== "whatsapp_business_account") {
      return events;
    }

    const entries = Array.isArray(reqBody.entry) ? reqBody.entry : [];

    for (const entry of entries) {
      const changes = Array.isArray(entry?.changes) ? entry.changes : [];
      for (const change of changes) {
        if (change?.field !== "messages") continue;

        const value = change?.value || {};
        const metadata = value.metadata || {};
        const phoneNumberId = metadata.phone_number_id || this.phoneNumberId;

        // Status events
        if (Array.isArray(value.statuses)) {
          for (const st of value.statuses) {
            events.push({
              provider: "meta",
              eventType: "STATUS",
              messageId: st.id,
              status: st.status,
              recipientId: st.recipient_id,
              timestamp: st.timestamp
                ? Number(st.timestamp) * 1000
                : Date.now(),
              rawProviderEvent: st,
            });
          }
        }

        // Customer messages
        const messages = Array.isArray(value.messages) ? value.messages : [];
        const contacts = Array.isArray(value.contacts) ? value.contacts : [];

        for (const msg of messages) {
          if (!msg || typeof msg !== "object") continue;

          const customerWaId = String(msg.from || "").replace(/\D/g, "");
          if (!customerWaId) continue;

          const contact =
            contacts.find((c) => c.wa_id === msg.from) || contacts[0] || {};
          const fromName = contact.profile?.name || null;
          const timestamp = msg.timestamp
            ? Number(msg.timestamp) * 1000
            : Date.now();
          const messageId = msg.id;

          // 1. Interactive Button Reply
          if (
            msg.type === "interactive" &&
            msg.interactive?.type === "button_reply"
          ) {
            const reply = msg.interactive.button_reply || {};
            const buttonId = reply.id;
            const title = reply.title || "";
            const decoded = WhatsappActionCodec.decode(buttonId);
            const actionId = decoded?.id || decoded?.type || buttonId;
            const actionType = decoded?.type || decoded?.id || actionId;
            const actionPayload = decoded?.payload ?? {
              value: buttonId,
              label: title,
            };

            events.push({
              provider: "meta",
              eventType: "ACTION",
              messageId,
              customerWaId,
              phoneNumberId,
              timestamp,
              messageType: "interactive",
              text: title || String(actionId),
              interactive: {
                type: "button_reply",
                id: buttonId,
                title,
                payload: actionPayload,
              },
              action: {
                id: actionId,
                type: actionType,
                payload: {
                  ...actionPayload,
                  label: actionPayload.label ?? title,
                  value: actionPayload.value ?? buttonId,
                },
              },
              attachments: [],
              fromName,
              rawProviderEvent: msg,
            });
            continue;
          }

          // 2. Interactive List Reply
          if (
            msg.type === "interactive" &&
            msg.interactive?.type === "list_reply"
          ) {
            const reply = msg.interactive.list_reply || {};
            const rowId = reply.id;
            const title = reply.title || "";
            const description = reply.description || null;
            const decoded = WhatsappActionCodec.decode(rowId);
            const actionId = decoded?.id || decoded?.type || rowId;
            const actionType = decoded?.type || decoded?.id || actionId;
            const actionPayload = decoded?.payload ?? {
              value: rowId,
              label: title,
              description,
            };

            events.push({
              provider: "meta",
              eventType: "ACTION",
              messageId,
              customerWaId,
              phoneNumberId,
              timestamp,
              messageType: "interactive",
              text: title || String(actionId),
              interactive: {
                type: "list_reply",
                id: rowId,
                title,
                payload: actionPayload,
              },
              action: {
                id: actionId,
                type: actionType,
                payload: {
                  ...actionPayload,
                  label: actionPayload.label ?? title,
                  value: actionPayload.value ?? rowId,
                  description,
                },
              },
              attachments: [],
              fromName,
              rawProviderEvent: msg,
            });
            continue;
          }

          // 3. Media (image, document, audio, video, sticker)
          const mediaTypes = ["image", "document", "audio", "video", "sticker"];
          const matchedMedia = mediaTypes.find((t) => msg[t] && msg[t].id);
          if (matchedMedia) {
            const media = msg[matchedMedia];
            events.push({
              provider: "meta",
              eventType: "MEDIA",
              messageId,
              customerWaId,
              phoneNumberId,
              timestamp,
              messageType: matchedMedia,
              text: media.caption?.trim() || "",
              interactive: null,
              action: null,
              attachments: [
                {
                  mediaId: media.id,
                  mimeType: media.mime_type || null,
                  filename: media.filename || null,
                  sha256: media.sha256 || null,
                  type: matchedMedia,
                  caption: media.caption || null,
                  downloaded: false,
                },
              ],
              fromName,
              rawProviderEvent: msg,
            });
            continue;
          }

          // 4. Location
          if (msg.location) {
            events.push({
              provider: "meta",
              eventType: "LOCATION",
              messageId,
              customerWaId,
              phoneNumberId,
              timestamp,
              messageType: "location",
              text: "",
              interactive: null,
              action: null,
              location: {
                latitude: msg.location.latitude ?? null,
                longitude: msg.location.longitude ?? null,
                name: msg.location.name ?? null,
                address: msg.location.address ?? null,
              },
              attachments: [],
              fromName,
              rawProviderEvent: msg,
            });
            continue;
          }

          // 5. Contacts
          if (msg.contacts) {
            events.push({
              provider: "meta",
              eventType: "CONTACTS",
              messageId,
              customerWaId,
              phoneNumberId,
              timestamp,
              messageType: "contacts",
              text: "",
              interactive: null,
              action: null,
              contacts: Array.isArray(msg.contacts) ? msg.contacts : [],
              attachments: [],
              fromName,
              rawProviderEvent: msg,
            });
            continue;
          }

          // 6. Plain Text
          if (msg.text?.body) {
            events.push({
              provider: "meta",
              eventType: "MESSAGE",
              messageId,
              customerWaId,
              phoneNumberId,
              timestamp,
              messageType: "text",
              text: msg.text.body.trim(),
              interactive: null,
              action: null,
              attachments: [],
              fromName,
              rawProviderEvent: msg,
            });
          }
        }
      }
    }

    return events;
  }

  // =====================================================
  // OUTBOUND MESSAGING DISPATCH
  // =====================================================

  async sendMessage(to, message, options = {}) {
    if (!to) {
      throw new Error("WhatsApp recipient phone number is required.");
    }

    const token = this.accessToken || process.env.WHATSAPP_ACCESS_TOKEN;
    if (!token) {
      throw new Error("WHATSAPP_ACCESS_TOKEN is not configured.");
    }

    const phoneId = this.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;
    if (!phoneId) {
      throw new Error("WHATSAPP_PHONE_NUMBER_ID is not configured.");
    }

    const cleanTo = String(to).replace(/\D/g, "");
    const url = `${this.baseUrl}/${phoneId}/messages`;

    let payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: cleanTo,
    };

    if (message?.type === "interactive") {
      payload = {
        ...payload,
        type: "interactive",
        interactive: message.interactive,
      };
    } else if (message?.type === "image") {
      const imageUrl = message.image?.link || message.image?.url;
      const caption = message.image?.caption || message.caption || "";
      payload = {
        ...payload,
        type: "image",
        image: {
          link: imageUrl,
          ...(caption ? { caption: String(caption).trim() } : {}),
        },
      };
    } else if (message?.type === "text" || message?.text?.body) {
      payload = {
        ...payload,
        type: "text",
        text: {
          preview_url: message.text?.preview_url ?? false,
          body: message.text?.body || message.body || "",
        },
      };
    } else {
      payload = {
        ...payload,
        ...message,
      };
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });

    const responseBody = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error(
        "[Meta Outbound] Error status:",
        response.status,
        responseBody?.error,
      );
      throw new Error(
        responseBody?.error?.message ||
          `Meta Graph API request failed with status ${response.status}`,
      );
    }

    return responseBody;
  }

  async sendTextMessage(to, body, options = {}) {
    return this.sendMessage(
      to,
      {
        type: "text",
        text: { preview_url: false, body },
      },
      options,
    );
  }

  async sendButtonMessage(to, bodyText, buttons = [], header = null, footer = null, options = {}) {
    const payload = {
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: bodyText },
        action: {
          buttons: buttons.map((b, index) => ({
            type: "reply",
            reply: {
              id: b.id ?? `btn_${index}`,
              title: String(b.title ?? b.label ?? `Option ${index + 1}`).trim().slice(0, 20),
            },
          })),
        },
        ...(header ? { header } : {}),
        ...(footer ? { footer: { text: footer } } : {}),
      },
    };
    return this.sendMessage(to, payload, options);
  }

  async sendListMessage(to, bodyText, buttonText, sections = [], header = null, footer = null, options = {}) {
    const payload = {
      type: "interactive",
      interactive: {
        type: "list",
        body: { text: bodyText },
        action: {
          button: String(buttonText || "Choose Option").trim().slice(0, 20),
          sections: sections.map((sec) => ({
            title: String(sec.title || "Options").trim().slice(0, 24),
            rows: (sec.rows || []).map((row, rIdx) => ({
              id: row.id ?? `row_${rIdx}`,
              title: String(row.title ?? row.label ?? `Item ${rIdx + 1}`).trim().slice(0, 24),
              ...(row.description ? { description: String(row.description).trim().slice(0, 72) } : {}),
            })),
          })),
        },
        ...(header ? { header } : {}),
        ...(footer ? { footer: { text: footer } } : {}),
      },
    };
    return this.sendMessage(to, payload, options);
  }

  // =====================================================
  // POLICY ELIGIBILITY (Meta 24-Hour Window)
  // =====================================================

  checkOutboundEligibility({
    to,
    message,
    inboundTriggerContext = {},
    lastUserMessageAt = null,
    now = Date.now(),
  } = {}) {
    const effectiveInboundTimestamp =
      lastUserMessageAt ??
      inboundTriggerContext.inboundReceivedAt ??
      (this.windowPolicy ? this.windowPolicy.getLastUserMessageAt(to) : null);

    if (!effectiveInboundTimestamp) {
      return {
        allowed: false,
        blocked: true,
        reason: "CUSTOMER_SERVICE_WINDOW_EXPIRED",
        windowRemainingMs: 0,
        windowExpiresAt: null,
      };
    }

    if (this.windowPolicy) {
      const check = this.windowPolicy.checkOutboundEligibility({
        lastUserMessageAt: effectiveInboundTimestamp,
        now,
      });
      return {
        allowed: check.allowed,
        blocked: !check.allowed,
        reason: check.allowed ? null : "CUSTOMER_SERVICE_WINDOW_EXPIRED",
        windowRemainingMs: check.remainingMs,
        windowExpiresAt: check.windowExpiresAt,
      };
    }

    const windowDurationMs = 24 * 60 * 60 * 1000;
    const windowExpiresAt =
      Number(effectiveInboundTimestamp) + windowDurationMs;
    if (now >= windowExpiresAt) {
      return {
        allowed: false,
        blocked: true,
        reason: "CUSTOMER_SERVICE_WINDOW_EXPIRED",
        windowRemainingMs: 0,
        windowExpiresAt,
      };
    }

    return {
      allowed: true,
      blocked: false,
      reason: null,
      windowRemainingMs: Math.max(0, windowExpiresAt - now),
      windowExpiresAt,
    };
  }

  // =====================================================
  // MEDIA
  // =====================================================

  async getMediaMetadata(mediaId) {
    if (!mediaId) throw new Error("Media ID required.");
    const token = this.accessToken || process.env.WHATSAPP_ACCESS_TOKEN;
    const response = await fetch(`${this.baseUrl}/${mediaId}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10000),
    });
    return response.json();
  }

  async downloadMedia(mediaUrl) {
    if (!mediaUrl) throw new Error("Media URL required.");
    const token = this.accessToken || process.env.WHATSAPP_ACCESS_TOKEN;
    const response = await fetch(mediaUrl, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10000),
    });
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}
