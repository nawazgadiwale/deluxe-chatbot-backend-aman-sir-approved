/**
 * MetaProviderAdapter.js
 *
 * Meta WhatsApp Business Cloud API Adapter.
 * Handles webhook verification, inbound normalization,
 * outbound messaging, media upload/preflight, and authentication diagnostics.
 */

import crypto from "crypto";
import BaseWhatsAppProvider from "./BaseWhatsAppProvider.js";
import WhatsappActionCodec from "../WhatsappActionCodec.js";
import WhatsAppCustomerServiceWindowPolicy from "../policies/WhatsAppCustomerServiceWindowPolicy.js";
import { validateMediaUrl } from "../../sales/helpers/CatalogHelper.js";

export default class MetaProviderAdapter extends BaseWhatsAppProvider {
  constructor(config = {}) {
    super(config);

    const clean = (val) =>
      val !== undefined && val !== null
        ? String(val).trim().replace(/^["']|["']$/g, "")
        : null;

    this.accessToken = config.accessToken !== undefined ? clean(config.accessToken) : clean(process.env.WHATSAPP_ACCESS_TOKEN);
    this.phoneNumberId = config.phoneNumberId !== undefined ? clean(config.phoneNumberId) : clean(process.env.WHATSAPP_PHONE_NUMBER_ID);
    this.verifyToken = config.verifyToken !== undefined ? clean(config.verifyToken) : clean(process.env.WHATSAPP_VERIFY_TOKEN);
    this.appSecret = config.appSecret !== undefined ? clean(config.appSecret) : clean(process.env.WHATSAPP_APP_SECRET);
    this.graphApiVersion = clean(config.graphApiVersion || process.env.WHATSAPP_GRAPH_API_VERSION) || "v23.0";
    this.baseUrl = `https://graph.facebook.com/${this.graphApiVersion}`;
    this.windowPolicy = config.windowPolicy || new WhatsAppCustomerServiceWindowPolicy();
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
      nativeFlows: true,
    };
  }

  // =====================================================
  // WEBHOOK VERIFICATION & AUTHENTICATION
  // =====================================================

  verifyWebhook(req) {
    const mode = req.query?.["hub.mode"] ?? req.query?.mode;
    const token = req.query?.["hub.verify_token"] ?? req.query?.token;
    const challenge = req.query?.["hub.challenge"] ?? req.query?.challenge;

    if (mode !== "subscribe" || !this.verifyToken || token !== this.verifyToken || !challenge) {
      if (token && token !== this.verifyToken) {
        console.warn("[Meta] Webhook verification token mismatch.");
      }
      return { verified: false, challenge: null, status: 403, body: "Forbidden" };
    }

    return { verified: true, challenge, status: 200, body: challenge };
  }

  authenticateWebhook(req) {
    if (!req?.body || typeof req.body !== "object") {
      return { authenticated: false, status: 400, error: "Invalid webhook payload" };
    }

    if (req.headers?.["whapi-secret"]) {
      return { authenticated: false, status: 403, error: "Invalid Whapi authentication" };
    }

    const appSecret = this.appSecret !== undefined ? this.appSecret : process.env.WHATSAPP_APP_SECRET;
    if (!appSecret) {
      console.error("[Meta] WHATSAPP_APP_SECRET is not configured. Failing closed.");
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

    const rawBody =
      req.rawBody ||
      (typeof req.body === "string"
        ? Buffer.from(req.body)
        : Buffer.from(JSON.stringify(req.body)));

    try {
      const cleanSig = signature.startsWith("sha256=") ? signature.slice(7) : signature;
      const expectedHex = crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");
      const expBuf = Buffer.from(expectedHex, "utf8");
      const recBuf = Buffer.from(cleanSig, "utf8");

      if (expBuf.length !== recBuf.length || !crypto.timingSafeEqual(expBuf, recBuf)) {
        return { authenticated: false, status: 403, error: "Invalid signature" };
      }
    } catch {
      return { authenticated: false, status: 403, error: "Invalid signature" };
    }

    return { authenticated: true, status: 200, error: null };
  }

  // =====================================================
  // INBOUND NORMALIZATION
  // =====================================================

  normalizeInbound(reqBody = {}) {
    const events = [];
    if (!reqBody || typeof reqBody !== "object") return events;

    // Direct messages array support for tests/mocks
    if (Array.isArray(reqBody.messages)) {
      for (const msg of reqBody.messages) {
        if (!msg || typeof msg !== "object") continue;
        const customerWaId = String(msg.from || "")
          .replace(/@s\.whatsapp\.net$/i, "")
          .replace(/\D/g, "");
        if (!customerWaId) continue;
        const text =
          msg.text?.body ||
          (typeof msg.text === "string" ? msg.text : msg.body || "");
        events.push({
          provider: "meta",
          eventType: "MESSAGE",
          messageId: msg.id || `msg_${Date.now()}`,
          customerWaId,
          phoneNumberId: reqBody.channel_id || this.phoneNumberId,
          timestamp: msg.timestamp ? Number(msg.timestamp) * 1000 : Date.now(),
          messageType: "text",
          text: String(text).trim(),
          interactive: null,
          action: null,
          attachments: [],
          fromName: null,
          rawProviderEvent: msg,
        });
      }
      return events;
    }

    if (reqBody.object !== "whatsapp_business_account") return events;

    const entries = Array.isArray(reqBody.entry) ? reqBody.entry : [];
    for (const entry of entries) {
      for (const change of Array.isArray(entry?.changes) ? entry.changes : []) {
        if (change?.field !== "messages") continue;

        const val = change?.value || {};
        const phoneNumberId = val.metadata?.phone_number_id || this.phoneNumberId;

        // 1. Status events
        if (Array.isArray(val.statuses)) {
          for (const st of val.statuses) {
            events.push({
              provider: "meta",
              eventType: "STATUS",
              messageId: st.id,
              status: st.status,
              recipientId: st.recipient_id,
              timestamp: st.timestamp ? Number(st.timestamp) * 1000 : Date.now(),
              rawProviderEvent: st,
            });
          }
        }

        // 2. Incoming messages
        const messages = Array.isArray(val.messages) ? val.messages : [];
        const contacts = Array.isArray(val.contacts) ? val.contacts : [];

        for (const msg of messages) {
          if (!msg || typeof msg !== "object") continue;
          const customerWaId = String(msg.from || "").replace(/\D/g, "");
          if (!customerWaId) continue;

          const contact = contacts.find((c) => c.wa_id === msg.from) || contacts[0] || {};
          const fromName = contact.profile?.name || null;
          const rawTs = Number(msg.timestamp);
          const timestamp = !isNaN(rawTs) && rawTs > 0 ? (rawTs < 1e11 ? rawTs * 1000 : rawTs) : Date.now();
          const messageId = msg.id;

          const base = {
            provider: "meta",
            messageId,
            customerWaId,
            phoneNumberId,
            timestamp,
            fromName,
            rawProviderEvent: msg,
            interactive: null,
            action: null,
            attachments: [],
          };

          // Interactive Reply (Button / List)
          if (msg.type === "interactive" && (msg.interactive?.button_reply || msg.interactive?.list_reply)) {
            const reply = msg.interactive.button_reply || msg.interactive.list_reply;
            const id = reply.id;
            const title = reply.title || "";
            const decoded = WhatsappActionCodec.decode(id);
            const actionId = decoded?.id || decoded?.type || id;
            const actionType = decoded?.type || decoded?.id || actionId;
            const actionPayload = decoded?.payload ?? { value: id, label: title };

            events.push({
              ...base,
              eventType: "ACTION",
              messageType: "interactive",
              text: title || String(actionId),
              interactive: {
                type: msg.interactive.button_reply ? "button_reply" : "list_reply",
                id,
                title,
                payload: actionPayload,
              },
              action: {
                id: actionId,
                type: actionType,
                payload: {
                  ...actionPayload,
                  label: actionPayload.label ?? title,
                  value: actionPayload.value ?? id,
                  ...(reply.description ? { description: reply.description } : {}),
                },
              },
            });
            continue;
          }

          // Flow submission
          if (msg.type === "interactive" && msg.interactive?.type === "nfm_reply") {
            const nfm = msg.interactive.nfm_reply || {};
            let responseJson = null;
            try {
              responseJson = typeof nfm.response_json === "string" ? JSON.parse(nfm.response_json) : nfm.response_json;
            } catch {
              responseJson = null;
            }

            events.push({
              ...base,
              eventType: "FLOW_SUBMISSION",
              messageType: "interactive",
              text: "",
              isFlowSubmission: true,
              flow: {
                responseJson,
                flowToken: nfm.body || null,
                flowName: nfm.name || null,
              },
              interactive: {
                type: "nfm_reply",
                id: nfm.name || "flow",
                title: nfm.name || "",
                payload: responseJson,
              },
            });
            continue;
          }

          // Media attachment
          const mediaType = ["image", "document", "audio", "video", "sticker"].find((t) => msg[t]?.id);
          if (mediaType) {
            const media = msg[mediaType];
            events.push({
              ...base,
              eventType: "MEDIA",
              messageType: mediaType,
              text: media.caption?.trim() || "",
              attachments: [
                {
                  mediaId: media.id,
                  mimeType: media.mime_type || null,
                  filename: media.filename || null,
                  sha256: media.sha256 || null,
                  type: mediaType,
                  caption: media.caption || null,
                  downloaded: false,
                },
              ],
            });
            continue;
          }

          // Location
          if (msg.location) {
            events.push({
              ...base,
              eventType: "LOCATION",
              messageType: "location",
              text: "",
              location: {
                latitude: msg.location.latitude ?? null,
                longitude: msg.location.longitude ?? null,
                name: msg.location.name ?? null,
                address: msg.location.address ?? null,
              },
            });
            continue;
          }

          // Contacts
          if (msg.contacts) {
            events.push({
              ...base,
              eventType: "CONTACTS",
              messageType: "contacts",
              text: "",
              contacts: Array.isArray(msg.contacts) ? msg.contacts : [],
            });
            continue;
          }

          // Plain text
          if (msg.text?.body) {
            events.push({
              ...base,
              eventType: "MESSAGE",
              messageType: "text",
              text: msg.text.body.trim(),
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
    if (!to) throw new Error("WhatsApp recipient phone number is required.");
    const token = this.accessToken || process.env.WHATSAPP_ACCESS_TOKEN;
    if (!token) throw new Error("WHATSAPP_ACCESS_TOKEN is not configured.");
    const phoneId = this.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;
    if (!phoneId) throw new Error("WHATSAPP_PHONE_NUMBER_ID is not configured.");

    const cleanTo = String(to).replace(/\D/g, "");
    const url = `${this.baseUrl}/${phoneId}/messages`;

    // 1. Media Pre-Validation & Upload
    let outgoing = message;
    if (outgoing?.type === "interactive" && outgoing.interactive?.header?.type === "image") {
      const imgLink = outgoing.interactive.header.image?.link || outgoing.interactive.header.image?.url;
      let mediaId = null;
      if (imgLink && (await validateMediaUrl(imgLink))) {
        try {
          mediaId = await this.uploadMediaFromUrl(imgLink);
        } catch (err) {
          console.log(`[Meta Media] Pre-upload failed: ${err.message}`);
        }
      }

      if (mediaId) {
        console.log(`[Meta Media] Sending message with mediaId: ${mediaId}`);
        outgoing = {
          ...outgoing,
          interactive: {
            ...outgoing.interactive,
            header: { type: "image", image: { id: mediaId } },
          },
        };
      } else {
        console.log("[Meta Media] Falling back to media-free message");
        const { header, ...interactiveWithoutHeader } = outgoing.interactive;
        outgoing = { ...outgoing, interactive: interactiveWithoutHeader };
      }
    } else if (outgoing?.type === "image") {
      const imgLink = outgoing.image?.link || outgoing.image?.url;
      let mediaId = null;
      if (imgLink && (await validateMediaUrl(imgLink))) {
        try {
          mediaId = await this.uploadMediaFromUrl(imgLink);
        } catch (err) {
          console.log(`[Meta Media] Pre-upload failed: ${err.message}`);
        }
      }
      const caption = outgoing.image?.caption || outgoing.caption || "";
      if (mediaId) {
        console.log(`[Meta Media] Sending message with mediaId: ${mediaId}`);
        outgoing = {
          type: "image",
          image: { id: mediaId, ...(caption ? { caption: String(caption).trim() } : {}) },
        };
      } else {
        console.log("[Meta Media] Falling back to media-free message");
        outgoing = {
          type: "text",
          text: { preview_url: false, body: caption || "Here are the details for your request." },
        };
      }
    }

    const buildPayload = (msg) => {
      let p = { messaging_product: "whatsapp", recipient_type: "individual", to: cleanTo };
      if (msg?.type === "interactive") {
        p = { ...p, type: "interactive", interactive: msg.interactive };
      } else if (msg?.type === "image") {
        const caption = msg.image?.caption || msg.caption || "";
        p = {
          ...p,
          type: "image",
          image: {
            ...(msg.image?.id ? { id: msg.image.id } : { link: msg.image?.link || msg.image?.url }),
            ...(caption ? { caption: String(caption).trim() } : {}),
          },
        };
      } else if (msg?.type === "text" || msg?.text?.body) {
        p = {
          ...p,
          type: "text",
          text: {
            preview_url: msg.text?.preview_url ?? false,
            body: msg.text?.body || msg.body || "",
          },
        };
      } else {
        p = { ...p, ...msg };
      }
      return p;
    };

    let payload = buildPayload(outgoing);
    console.log(`[Meta Outbound] Sending to recipient: ${cleanTo} type: ${payload.type}`);

    let response = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });
    let responseBody = await response.json().catch(() => ({}));

    // 2. Synchronous fallback on Meta 131053 error
    if (!response.ok) {
      const errCode = responseBody?.error?.code;
      const errMsg = responseBody?.error?.message || "";
      const isMediaError =
        errCode === 131053 ||
        errMsg.toLowerCase().includes("media") ||
        responseBody?.error?.error_subcode === 131053;

      if (isMediaError) {
        console.log(`[Meta Media] Media delivery failed: ${errCode || 131053}`);
        if (outgoing?.type === "interactive" && outgoing.interactive?.header) {
          console.log("[Meta Media] Sending media-free fallback");
          const { header, ...interactiveWithoutHeader } = outgoing.interactive;
          payload = buildPayload({ ...outgoing, interactive: interactiveWithoutHeader });
        } else if (outgoing?.type === "image") {
          console.log("[Meta Media] Sending media-free fallback");
          const caption = outgoing.image?.caption || outgoing.caption || "";
          payload = buildPayload({
            type: "text",
            text: { preview_url: false, body: caption || "Here are the details for your request." },
          });
        }

        response = await fetch(url, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(10000),
        });
        responseBody = await response.json().catch(() => ({}));
      }
    }

    if (!response.ok) {
      const errCode = responseBody?.error?.code;
      const errMsg = responseBody?.error?.message || "";
      if (response.status === 401 || errCode === 190) {
        console.error(
          `[Meta Outbound] Send failed status=401 code=${errCode || 190} message=${errMsg || "Authentication Error"}`,
        );
      } else {
        console.error(`[Meta Outbound] Error status: ${response.status} code: ${errCode || "unknown"} message: ${errMsg}`);
      }
      throw new Error(responseBody?.error?.message || `Meta Graph API request failed with status ${response.status}`);
    }

    console.log(`[Meta Outbound] Sent successfully to ${cleanTo} messageId=${responseBody?.messages?.[0]?.id || "unknown"}`);
    return responseBody;
  }

  async sendFlow(to, flowMessage, options = {}) {
    const cid = options.correlationId || `flow_send_${Date.now().toString(36)}`;
    const cleanTo = String(to).replace(/\D/g, "");
    console.log(`[WhatsApp][Flow] SEND provider=meta recipient=${cleanTo} correlationId=${cid}`);
    return this.sendMessage(cleanTo, flowMessage, options);
  }

  // =====================================================
  // POLICY ELIGIBILITY
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
      return { allowed: false, blocked: true, reason: "CUSTOMER_SERVICE_WINDOW_EXPIRED", windowRemainingMs: 0, windowExpiresAt: null };
    }

    if (this.windowPolicy) {
      const check = this.windowPolicy.checkOutboundEligibility({ lastUserMessageAt: effectiveInboundTimestamp, now });
      return {
        allowed: check.allowed,
        blocked: !check.allowed,
        reason: check.allowed ? null : "CUSTOMER_SERVICE_WINDOW_EXPIRED",
        windowRemainingMs: check.remainingMs,
        windowExpiresAt: check.windowExpiresAt,
      };
    }

    const windowDurationMs = 24 * 60 * 60 * 1000;
    const windowExpiresAt = Number(effectiveInboundTimestamp) + windowDurationMs;
    const allowed = now < windowExpiresAt;
    return {
      allowed,
      blocked: !allowed,
      reason: allowed ? null : "CUSTOMER_SERVICE_WINDOW_EXPIRED",
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
    const res = await fetch(`${this.baseUrl}/${mediaId}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10000),
    });
    return res.json();
  }

  async uploadMedia({ buffer, mimeType = "image/webp", filename = "image.webp" }) {
    const token = this.accessToken || process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneId = this.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;
    if (!token || !phoneId) throw new Error("Meta credentials missing for media upload.");

    const blob = new Blob([buffer], { type: mimeType });
    const formData = new FormData();
    formData.append("file", blob, filename);
    formData.append("type", mimeType);
    formData.append("messaging_product", "whatsapp");

    const res = await fetch(`${this.baseUrl}/${phoneId}/media`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
      signal: AbortSignal.timeout(10000),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.id) {
      throw new Error(data?.error?.message || `Meta media upload failed with status ${res.status}`);
    }
    return data.id;
  }

  async uploadMediaFromUrl(imageUrl) {
    if (!imageUrl) return null;
    console.log(`[Meta Media] Resolving catalog image: ${imageUrl}`);
    const res = await fetch(imageUrl, { signal: AbortSignal.timeout(4000) }).catch((e) => {
      console.log(`[Meta Media] Failed to fetch image: ${e.message}`);
      return null;
    });

    if (!res || !res.ok) {
      console.log(`[Meta Media] Image fetch failed HTTP ${res?.status}`);
      return null;
    }

    const mimeType = res.headers.get("content-type") || "image/webp";
    if (!mimeType.startsWith("image/") || mimeType.includes("svg")) {
      console.log(`[Meta Media] Unsupported mime type ${mimeType}`);
      return null;
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    console.log(`[Meta Media] Uploading media (${buffer.length} bytes)...`);
    const mediaId = await this.uploadMedia({ buffer, mimeType, filename: "catalog_image.webp" });
    console.log(`[Meta Media] Media uploaded: ${mediaId}`);
    return mediaId;
  }

  async downloadMedia(mediaUrl) {
    if (!mediaUrl) throw new Error("Media URL required.");
    const token = this.accessToken || process.env.WHATSAPP_ACCESS_TOKEN;
    const res = await fetch(mediaUrl, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10000),
    });
    return Buffer.from(await res.arrayBuffer());
  }

  // =====================================================
  // SAFE AUTHENTICATION DIAGNOSTIC
  // =====================================================

  async checkAuthDiagnostic() {
    const hasToken = Boolean(this.accessToken);
    const hasPhoneId = Boolean(this.phoneNumberId);
    console.log(`[Meta Auth] Access token configured: ${hasToken}`);
    console.log(`[Meta Auth] Phone Number ID configured: ${hasPhoneId}`);
    console.log(`[Meta Auth] Graph API version: ${this.graphApiVersion}`);

    if (!hasToken || !hasPhoneId) {
      console.log("[Meta Auth] Credential check: FAILED");
      console.log("[Meta Auth] Message: Missing required credentials");
      return { success: false, error: "Missing credentials" };
    }

    try {
      const res = await fetch(`${this.baseUrl}/${this.phoneNumberId}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${this.accessToken}` },
        signal: AbortSignal.timeout(6000),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data?.id) {
        console.log("[Meta Auth] Credential check: SUCCESS");
        return { success: true, phoneId: data.id, displayPhoneNumber: data.display_phone_number || null };
      }

      const err = data?.error || {};
      const status = res.status;
      const code = err.code || status;
      const message = err.message || "Authentication Error";

      console.log("[Meta Auth] Credential check: FAILED");
      console.log(`[Meta Auth] HTTP: ${status}`);
      console.log(`[Meta Auth] Code: ${code}`);
      console.log(`[Meta Auth] Message: ${message}`);

      return { success: false, status, code, message };
    } catch (fetchErr) {
      console.log("[Meta Auth] Credential check: FAILED");
      console.log(`[Meta Auth] Message: Network error ${fetchErr.message}`);
      return { success: false, error: fetchErr.message };
    }
  }
}
