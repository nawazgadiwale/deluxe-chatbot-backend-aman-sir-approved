/**
 * WhapiProviderAdapter.js
 *
 * Production Whapi.Cloud WhatsApp Provider Adapter.
 *
 * Implements the BaseWhatsAppProvider interface for Whapi.Cloud transport.
 * Fully isolates Whapi HTTP payloads, webhook structures, and inbound "reply" schemas
 * from the application core and AI workflow.
 */

import BaseWhatsAppProvider from "./BaseWhatsAppProvider.js";
import WhatsappActionCodec from "../WhatsappActionCodec.js";

export default class WhapiProviderAdapter extends BaseWhatsAppProvider {
  constructor(config = {}) {
    super(config);
    this.apiUrl = (
      config.apiUrl ||
      process.env.WHAPI_API_BASE_URL ||
      process.env.WHAPI_API_URL ||
      "https://gate.whapi.cloud"
    ).replace(/\/+$/, "");
    this.token =
      config.token !== undefined
        ? config.token
        : process.env.WHAPI_TOKEN || null;
    this.webhookSecret =
      config.webhookSecret !== undefined
        ? config.webhookSecret
        : process.env.WHAPI_WEBHOOK_SECRET || null;
    this.botNumber = String(
      config.botNumber ||
        process.env.WHATSAPP_BOT_NUMBER ||
        "9513166750",
    ).replace(/\D/g, "");
  }

  get name() {
    return "whapi";
  }

  getCapabilities() {
    return {
      interactiveButtons: true,
      interactiveLists: true,
      templates: false,
      media: true,
      customerServiceWindow: false,
      nativeFlows: false,
    };
  }

  // =====================================================
  // WEBHOOK VERIFICATION & AUTHENTICATION
  // =====================================================

  verifyWebhook(req) {
    const token = req.query?.secret || req.query?.token || req.query?.["hub.verify_token"];
    const challenge = req.query?.challenge || req.query?.["hub.challenge"] || "OK";

    if (this.webhookSecret && token && token.trim() !== this.webhookSecret.trim()) {
      return { verified: false, challenge: null, status: 403, body: "Forbidden" };
    }

    return { verified: true, challenge, status: 200, body: challenge };
  }

  authenticateWebhook(req) {
    if (!this.webhookSecret) {
      return { authenticated: true, status: 200, error: null };
    }

    const authHeader =
      req.headers?.["whapi-secret"] ??
      req.headers?.["x-whapi-secret"] ??
      req.headers?.["authorization"] ??
      req.query?.secret ??
      null;

    const cleanAuth = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : authHeader?.trim();

    if (!cleanAuth || cleanAuth !== this.webhookSecret.trim()) {
      return {
        authenticated: false,
        status: 403,
        error: "Invalid Whapi authentication",
      };
    }

    return { authenticated: true, status: 200, error: null };
  }

  // =====================================================
  // INBOUND NORMALIZATION
  // =====================================================

  normalizeInbound(reqBody = {}, authContext = {}, reqHeaders = {}) {
    const events = [];

    // Status events
    const statuses = Array.isArray(reqBody.statuses)
      ? reqBody.statuses
      : Array.isArray(reqBody.data?.statuses)
        ? reqBody.data.statuses
        : [];

    if (statuses.length > 0) {
      for (const st of statuses) {
        events.push({
          provider: "whapi",
          eventType: "STATUS",
          messageId: st.id,
          status: st.status,
          recipientId: st.recipient_id,
          timestamp: st.timestamp ? Number(st.timestamp) * 1000 : Date.now(),
          rawProviderEvent: st,
        });
      }
    }

    let rawMessages = [];
    if (Array.isArray(reqBody.messages) && reqBody.messages.length > 0) {
      rawMessages = reqBody.messages;
    } else if (Array.isArray(reqBody.chats_updates) && reqBody.chats_updates.length > 0) {
      for (const update of reqBody.chats_updates) {
        const lastMsg =
          update?.after_update?.last_message ||
          update?.afterUpdate?.lastMessage ||
          update?.after_update?.lastMessage;
        if (lastMsg && typeof lastMsg === "object") {
          rawMessages.push(lastMsg);
        }
      }
    } else if (reqBody.chat_update || reqBody.chats_update) {
      const update = reqBody.chat_update || reqBody.chats_update;
      const lastMsg =
        update?.after_update?.last_message ||
        update?.afterUpdate?.lastMessage ||
        update?.after_update?.lastMessage;
      if (lastMsg && typeof lastMsg === "object") {
        rawMessages.push(lastMsg);
      }
    } else if (reqBody.message && typeof reqBody.message === "object") {
      rawMessages = [reqBody.message];
    } else if (Array.isArray(reqBody.data)) {
      rawMessages = reqBody.data;
    } else if (reqBody.data?.messages && Array.isArray(reqBody.data.messages)) {
      rawMessages = reqBody.data.messages;
    } else if (reqBody.event?.data && Array.isArray(reqBody.event.data)) {
      rawMessages = reqBody.event.data;
    } else if (reqBody.event?.messages && Array.isArray(reqBody.event.messages)) {
      rawMessages = reqBody.event.messages;
    } else if (Array.isArray(reqBody)) {
      rawMessages = reqBody;
    } else if (reqBody.entry?.[0]?.changes?.[0]?.value?.messages) {
      rawMessages = reqBody.entry[0].changes[0].value.messages;
    }

    for (const raw of rawMessages) {
      if (!raw || typeof raw !== "object") continue;

      // Ignore self messages
      const isFromMe =
        raw.from_me === true ||
        raw.fromMe === true ||
        raw.key?.fromMe === true ||
        raw.is_from_me === true;

      if (isFromMe) {
        continue;
      }

      // Ignore status/ack messages
      if (raw.type === "action" || raw.subtype === "status") {
        continue;
      }

      const rawFrom =
        raw.from ||
        raw.chat_id ||
        raw.author ||
        raw.sender ||
        raw.sender_id ||
        raw.from_user ||
        raw.key?.remoteJid ||
        "";
      const cleanSender = String(rawFrom)
        .replace(/@.*$/, "")
        .replace(/\D/g, "");

      if (!cleanSender) continue;

      // Ignore bot's own number
      if (
        cleanSender === this.botNumber ||
        (this.botNumber.length >= 10 && cleanSender.endsWith(this.botNumber))
      ) {
        continue;
      }

      const timestamp = raw.timestamp ? Number(raw.timestamp) * 1000 : Date.now();
      const messageId =
        raw.id ||
        raw.message_id ||
        raw.msgId ||
        raw.key?.id ||
        raw.wamid ||
        null;
      if (!messageId) continue;
      const fromName =
        raw.from_name || raw.sender_name || raw.push_name || null;

      // =====================================================
      // 1. WHAPI "reply" TYPE RESOLUTION (BUTTON / QUICK REPLY / QUOTED)
      // =====================================================
      if (raw.type === "reply" || raw.reply) {
        const replyObj = raw.reply || {};
        const replyButtonObj = replyObj.buttons_reply || replyObj.button_reply || {};
        const replyListObj = replyObj.list_reply || {};

        const buttonId =
          replyObj.id ??
          replyButtonObj.id ??
          replyListObj.id ??
          raw.button_reply?.id ??
          raw.action?.id ??
          raw.selected_id ??
          null;

        const buttonTitle =
          replyObj.title ??
          replyButtonObj.title ??
          replyListObj.title ??
          raw.button_reply?.title ??
          raw.action?.title ??
          replyObj.text ??
          raw.body ??
          "";

        if (buttonId) {
          const decoded = WhatsappActionCodec.decode(buttonId);
          const actionId = decoded?.id || decoded?.type || buttonId;
          const actionType = decoded?.type || decoded?.id || actionId;
          const actionPayload = decoded?.payload ?? {
            value: buttonId,
            label: buttonTitle,
          };

          events.push({
            provider: "whapi",
            eventType: "ACTION",
            messageId,
            customerWaId: cleanSender,
            phoneNumberId: reqBody.channel_id || null,
            timestamp,
            messageType: "interactive",
            text: buttonTitle || String(actionId),
            interactive: {
              type: "button_reply",
              id: buttonId,
              title: buttonTitle,
              payload: actionPayload,
            },
            action: {
              id: actionId,
              type: actionType,
              payload: {
                ...actionPayload,
                label: actionPayload.label ?? buttonTitle,
                value: actionPayload.value ?? buttonId,
              },
            },
            attachments: [],
            fromName,
            rawProviderEvent: raw,
          });
          continue;
        }

        // Quoted text reply without button ID
        const textContent = (buttonTitle || raw.body || "").trim();
        if (textContent) {
          events.push({
            provider: "whapi",
            eventType: "MESSAGE",
            messageId,
            customerWaId: cleanSender,
            phoneNumberId: reqBody.channel_id || null,
            timestamp,
            messageType: "text",
            text: textContent,
            interactive: null,
            action: null,
            attachments: [],
            fromName,
            rawProviderEvent: raw,
          });
          continue;
        }
      }

      // =====================================================
      // 2. EXPLICIT BUTTON REPLY / LIST REPLY
      // =====================================================
      if (raw.button_reply || raw.button) {
        const reply = raw.button_reply || raw.button;
        const buttonId = reply.id ?? reply.payload ?? reply.value;
        const buttonTitle = reply.title ?? reply.label ?? reply.text ?? "";

        const decoded = WhatsappActionCodec.decode(buttonId);
        const actionId = decoded?.id || decoded?.type || buttonId;
        const actionType = decoded?.type || decoded?.id || actionId;
        const actionPayload = decoded?.payload ?? {
          value: buttonId,
          label: buttonTitle,
        };

        events.push({
          provider: "whapi",
          eventType: "ACTION",
          messageId,
          customerWaId: cleanSender,
          phoneNumberId: reqBody.channel_id || null,
          timestamp,
          messageType: "interactive",
          text: buttonTitle || String(actionId),
          interactive: {
            type: "button_reply",
            id: buttonId,
            title: buttonTitle,
            payload: actionPayload,
          },
          action: {
            id: actionId,
            type: actionType,
            payload: {
              ...actionPayload,
              label: actionPayload.label ?? buttonTitle,
              value: actionPayload.value ?? buttonId,
            },
          },
          attachments: [],
          fromName,
          rawProviderEvent: raw,
        });
        continue;
      }

      if (raw.list_reply) {
        const reply = raw.list_reply;
        const rowId = reply.id ?? reply.value;
        const rowTitle = reply.title ?? reply.label ?? "";
        const rowDesc = reply.description ?? "";

        const decoded = WhatsappActionCodec.decode(rowId);
        const actionId = decoded?.id || decoded?.type || rowId;
        const actionType = decoded?.type || decoded?.id || actionId;
        const actionPayload = decoded?.payload ?? {
          value: rowId,
          label: rowTitle,
          description: rowDesc,
        };

        events.push({
          provider: "whapi",
          eventType: "ACTION",
          messageId,
          customerWaId: cleanSender,
          phoneNumberId: reqBody.channel_id || null,
          timestamp,
          messageType: "interactive",
          text: rowTitle || String(actionId),
          interactive: {
            type: "list_reply",
            id: rowId,
            title: rowTitle,
            payload: actionPayload,
          },
          action: {
            id: actionId,
            type: actionType,
            payload: {
              ...actionPayload,
              label: actionPayload.label ?? rowTitle,
              value: actionPayload.value ?? rowId,
              description: rowDesc,
            },
          },
          attachments: [],
          fromName,
          rawProviderEvent: raw,
        });
        continue;
      }

      // =====================================================
      // 2b. WHATSAPP FLOW REPLY (nfm_reply)
      // =====================================================
      if (
        raw.nfm_reply ||
        raw.interactive?.nfm_reply ||
        (raw.type === "interactive" && (raw.interactive?.type === "nfm_reply" || raw.nfm_reply))
      ) {
        const nfm = raw.interactive?.nfm_reply || raw.nfm_reply || {};
        let responseJson = null;
        try {
          responseJson =
            typeof nfm.response_json === "string"
              ? JSON.parse(nfm.response_json)
              : nfm.response_json || {};
        } catch {
          responseJson = {};
        }

        events.push({
          provider: "whapi",
          eventType: "FLOW_SUBMISSION",
          messageId,
          customerWaId: cleanSender,
          phoneNumberId: reqBody.channel_id || null,
          timestamp,
          messageType: "interactive",
          text: "",
          isFlowSubmission: true,
          flow: {
            responseJson,
            flowToken: nfm.body || null,
            flowName: nfm.name || "flow",
          },
          interactive: {
            type: "nfm_reply",
            id: nfm.name || "flow",
            title: nfm.name || "",
            payload: responseJson,
          },
          action: null,
          attachments: [],
          fromName,
          rawProviderEvent: raw,
        });
        continue;
      }

      // =====================================================
      // 3. MEDIA (IMAGE, DOCUMENT, AUDIO, VIDEO, STICKER)
      // =====================================================
      const mediaTypes = ["image", "document", "audio", "video", "sticker"];
      const matchedMediaType = mediaTypes.find((t) => raw[t] && raw[t].id);
      if (matchedMediaType) {
        const media = raw[matchedMediaType];
        events.push({
          provider: "whapi",
          eventType: "MEDIA",
          messageId,
          customerWaId: cleanSender,
          phoneNumberId: reqBody.channel_id || null,
          timestamp,
          messageType: matchedMediaType,
          text: media.caption?.trim() || "",
          interactive: null,
          action: null,
          attachments: [
            {
              mediaId: media.id,
              mimeType: media.mime_type || null,
              filename: media.filename || null,
              sha256: media.sha256 || null,
              type: matchedMediaType,
              caption: media.caption || null,
              downloaded: false,
              link: media.link || null,
            },
          ],
          fromName,
          rawProviderEvent: raw,
        });
        continue;
      }

      // =====================================================
      // 4. LOCATION
      // =====================================================
      if (raw.location) {
        events.push({
          provider: "whapi",
          eventType: "LOCATION",
          messageId,
          customerWaId: cleanSender,
          phoneNumberId: reqBody.channel_id || null,
          timestamp,
          messageType: "location",
          text: "",
          interactive: null,
          action: null,
          location: {
            latitude: raw.location.latitude ?? null,
            longitude: raw.location.longitude ?? null,
            name: raw.location.name ?? null,
            address: raw.location.address ?? null,
          },
          attachments: [],
          fromName,
          rawProviderEvent: raw,
        });
        continue;
      }

      // =====================================================
      // 5. CONTACTS
      // =====================================================
      if (raw.contacts) {
        events.push({
          provider: "whapi",
          eventType: "CONTACTS",
          messageId,
          customerWaId: cleanSender,
          phoneNumberId: reqBody.channel_id || null,
          timestamp,
          messageType: "contacts",
          text: "",
          interactive: null,
          action: null,
          contacts: Array.isArray(raw.contacts) ? raw.contacts : [],
          attachments: [],
          fromName,
          rawProviderEvent: raw,
        });
        continue;
      }

      // =====================================================
      // 6. PLAIN TEXT (DEFAULT)
      // =====================================================
      let textContent = "";
      if (typeof raw.text === "string") {
        textContent = raw.text;
      } else if (raw.text?.body) {
        textContent = raw.text.body;
      } else if (typeof raw.body === "string") {
        textContent = raw.body;
      } else if (typeof raw.content === "string") {
        textContent = raw.content;
      } else if (typeof raw.caption === "string") {
        textContent = raw.caption;
      } else if (typeof raw.message === "string") {
        textContent = raw.message;
      }

      if (textContent.trim()) {
        events.push({
          provider: "whapi",
          eventType: "MESSAGE",
          messageId,
          customerWaId: cleanSender,
          phoneNumberId: reqBody.channel_id || null,
          timestamp,
          messageType: "text",
          text: textContent.trim(),
          interactive: null,
          action: null,
          attachments: [],
          fromName,
          rawProviderEvent: raw,
        });
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

    const cleanTo = String(to).replace(/\D/g, "");

    // Native WhatsApp Flow check: Whapi transport does not support native Flows
    if (message?.type === "interactive" && message.interactive?.type === "flow") {
      console.error(
        `[WhatsApp][Flow] Provider limitation: Whapi does not support native WhatsApp Flows (to=${cleanTo}). Switch to WHATSAPP_PROVIDER=meta.`,
      );
      throw new Error(
        "Whapi transport provider does not support native WhatsApp Flows. Please configure WHATSAPP_PROVIDER=meta with Meta Cloud API credentials.",
      );
    }

    const token = this.token || process.env.WHAPI_TOKEN;
    if (!token) {
      throw new Error("WHAPI_TOKEN is not configured.");
    }

    console.log(`[WhatsApp][Outbound] START provider=whapi recipient=${cleanTo} type=${message?.type || "text"}`);

    // 1. Whapi Standalone Image Message
    if (message?.type === "image") {
      const imageUrl =
        message.image?.link ||
        message.image?.url ||
        message.media ||
        message.link ||
        null;

      const caption =
        message.image?.caption ||
        message.caption ||
        message.text?.body ||
        "";

      if (!imageUrl) {
        throw new Error("Whapi image message requires a valid image URL/link.");
      }

      const imageUrlEndpoint = `${this.apiUrl}/messages/image`;
      const imagePayload = {
        to: cleanTo,
        media: imageUrl,
        ...(caption ? { caption: String(caption).trim() } : {}),
      };

      console.log("[Whapi Outbound] Dispatching image message:", {
        to: cleanTo,
        media: imageUrl,
        hasCaption: Boolean(caption),
      });

      const response = await fetch(imageUrlEndpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(imagePayload),
        signal: AbortSignal.timeout(10000),
      });

      const responseBody = await response.json().catch(() => ({}));
      console.log(`[WhatsApp][Outbound] HTTP status=${response.status}`);

      if (response.ok) {
        const msgId = responseBody?.message?.id || responseBody?.id || `whapi_${Date.now()}`;
        console.log(`[WhatsApp][Outbound] SUCCESS messageId=${msgId} to=${cleanTo}`);
        console.log("[Whapi Outbound] Image message sent successfully:", {
          to: cleanTo,
          messageId: msgId,
        });
        return {
          messages: [{ id: msgId }],
          whapiResult: responseBody,
        };
      }

      console.warn(
        "[Whapi Outbound] Image message failed, falling back to text:",
        response.status,
        responseBody?.message || responseBody?.error,
      );

      // Fallback to text if caption is available
      if (caption) {
        return this.sendMessage(cleanTo, { type: "text", text: { body: caption } }, options);
      }
    }

    // 2. Whapi Interactive Buttons
    if (
      message?.type === "interactive" &&
      message.interactive?.type === "button" &&
      Array.isArray(message.interactive.action?.buttons) &&
      message.interactive.action.buttons.length > 0
    ) {
      const interactiveUrl = `${this.apiUrl}/messages/interactive`;
      const bodyText = message.interactive.body?.text || "Please choose an option:";
      const header = message.interactive.header;

      const headerObj = {};
      if (header?.type === "image" && (header.image?.link || header.image?.url)) {
        headerObj.media = header.image.link || header.image.url;
      } else if (header?.type === "text" && header.text) {
        headerObj.text = header.text;
      }

      const interactivePayload = {
        to: cleanTo,
        type: "button",
        ...(Object.keys(headerObj).length > 0 ? { header: headerObj } : {}),
        body: { text: bodyText },
        action: {
          buttons: message.interactive.action.buttons.map((b) => ({
            type: "quick_reply",
            title: String(b.reply?.title || b.title || b.label || "").trim().slice(0, 25),
            id: String(b.reply?.id || b.id || "").slice(0, 256),
          })),
        },
      };

      console.log("[Whapi Outbound] Dispatching interactive button message:", {
        to: cleanTo,
        buttonCount: interactivePayload.action.buttons.length,
        hasHeader: Boolean(interactivePayload.header),
      });

      const response = await fetch(interactiveUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(interactivePayload),
        signal: AbortSignal.timeout(10000),
      });

      const responseBody = await response.json().catch(() => ({}));
      console.log(`[WhatsApp][Outbound] HTTP status=${response.status}`);

      if (response.ok) {
        const msgId = responseBody?.message?.id || responseBody?.id || `whapi_${Date.now()}`;
        console.log(`[WhatsApp][Outbound] SUCCESS messageId=${msgId} to=${cleanTo}`);
        console.log("[Whapi Outbound] Interactive button message sent successfully:", {
          to: cleanTo,
          messageId: msgId,
        });
        return {
          messages: [{ id: msgId }],
          whapiResult: responseBody,
        };
      }

      console.warn(
        "[Whapi Outbound] Interactive button message failed, falling back to text:",
        response.status,
        responseBody?.message || responseBody?.error,
      );
    }

    // 3. Whapi Interactive List
    if (
      message?.type === "interactive" &&
      message.interactive?.type === "list" &&
      Array.isArray(message.interactive.action?.sections) &&
      message.interactive.action.sections.length > 0
    ) {
      const interactiveUrl = `${this.apiUrl}/messages/interactive`;
      const bodyText = message.interactive.body?.text || "Please choose an option:";
      const listLabel = String(message.interactive.action.button || "View options").trim().slice(0, 20);
      const listTitle = String(message.interactive.action.sections?.[0]?.title || "Options").trim().slice(0, 24);
      const interactivePayload = {
        to: cleanTo,
        type: "list",
        body: { text: bodyText },
        action: {
          list: {
            label: listLabel,
            title: listTitle,
            sections: message.interactive.action.sections.map((sec) => ({
              title: String(sec.title || "Options").trim().slice(0, 24),
              rows: (sec.rows || []).map((row) => ({
                id: String(row.id || "").slice(0, 256),
                title: String(row.title || row.label || "").trim().slice(0, 24),
                ...(row.description ? { description: String(row.description).trim().slice(0, 72) } : {}),
              })),
            })),
          },
        },
      };

      console.log("[Whapi Outbound] Dispatching interactive list message:", {
        to: cleanTo,
        sectionCount: interactivePayload.action.list.sections.length,
      });

      const response = await fetch(interactiveUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(interactivePayload),
        signal: AbortSignal.timeout(10000),
      });

      const responseBody = await response.json().catch(() => ({}));
      console.log(`[WhatsApp][Outbound] HTTP status=${response.status}`);

      if (response.ok) {
        const msgId = responseBody?.message?.id || responseBody?.id || `whapi_${Date.now()}`;
        console.log(`[WhatsApp][Outbound] SUCCESS messageId=${msgId} to=${cleanTo}`);
        console.log("[Whapi Outbound] Interactive list message sent successfully:", {
          to: cleanTo,
          messageId: msgId,
        });
        return {
          messages: [{ id: msgId }],
          whapiResult: responseBody,
        };
      }

      console.warn(
        "[Whapi Outbound] Interactive list message failed, falling back to text:",
        response.status,
        responseBody?.message || responseBody?.error,
      );
    }

    // 3. Fallback / Plain Text Dispatch
    let bodyText = "";
    if (message?.text?.body) {
      bodyText = message.text.body;
    } else if (message?.interactive?.body?.text) {
      bodyText = message.interactive.body.text;
      if (Array.isArray(message.interactive.action?.buttons) && message.interactive.action.buttons.length > 0) {
        const buttonList = message.interactive.action.buttons
          .map((b, index) => `${index + 1}. ${b.reply?.title || b.title || b.label}`)
          .join("\n");
        if (buttonList) bodyText += `\n\n${buttonList}`;
      } else if (Array.isArray(message.interactive.action?.sections)) {
        const rows = message.interactive.action.sections.flatMap((s) => s.rows || []);
        const rowList = rows
          .map((r, index) => `${index + 1}. ${r.title || r.label}${r.description ? ` (${r.description})` : ""}`)
          .join("\n");
        if (rowList) bodyText += `\n\n${rowList}`;
      }
    } else if (typeof message?.content === "string") {
      bodyText = message.content;
    } else if (typeof message === "string") {
      bodyText = message;
    } else {
      bodyText = "Hello! I'd be happy to help with your printing requirements.";
    }

    const url = `${this.apiUrl}/messages/text`;
    const payload = {
      to: cleanTo,
      body: bodyText,
    };

    console.log("[Whapi Outbound] Dispatching text message:", {
      to: cleanTo,
      bodyLength: bodyText.length,
    });

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
    console.log(`[WhatsApp][Outbound] HTTP status=${response.status}`);

    if (!response.ok) {
      console.error(
        "[Whapi Outbound] API Error status:",
        response.status,
        responseBody?.message || responseBody?.error,
      );
      throw new Error(
        responseBody?.message ||
          responseBody?.error ||
          `Whapi API request failed with status ${response.status}`,
      );
    }

    const msgId = responseBody?.message?.id || responseBody?.id || `whapi_${Date.now()}`;
    console.log(`[WhatsApp][Outbound] SUCCESS messageId=${msgId} to=${cleanTo}`);
    console.log("[Whapi Outbound] Message sent successfully:", {
      to: cleanTo,
      messageId: msgId,
    });

    return {
      messages: [{ id: msgId }],
      whapiResult: responseBody,
    };
  }

  /**
   * Dispatches a native WhatsApp Flow message.
   * Whapi transport provider does not support native WhatsApp Flows.
   * @param {string} to
   * @param {Object} flowMessage
   * @param {Object} [options]
   */
  async sendFlow(to, flowMessage, options = {}) {
    const cleanTo = String(to).replace(/\D/g, "");
    console.error(
      `[WhatsApp][Flow] Whapi transport provider does not support native WhatsApp Flows (recipient=${cleanTo}). Configure WHATSAPP_PROVIDER=meta.`,
    );
    throw new Error(
      "Whapi transport provider does not support native WhatsApp Flows. Please configure WHATSAPP_PROVIDER=meta with Meta Cloud API credentials.",
    );
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
    // Whapi test mode does not impose Meta's 24h expiration
    return {
      allowed: true,
      blocked: false,
      reason: null,
      windowRemainingMs: 86400000,
      windowExpiresAt: null,
    };
  }

  // =====================================================
  // MEDIA
  // =====================================================

  async getMediaMetadata(mediaId) {
    if (!mediaId) throw new Error("Media ID required.");
    const token = this.token || process.env.WHAPI_TOKEN;
    const response = await fetch(`${this.apiUrl}/media/${mediaId}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10000),
    });
    return response.json();
  }

  async downloadMedia(mediaUrl) {
    if (!mediaUrl) throw new Error("Media URL required.");
    const token = this.token || process.env.WHAPI_TOKEN;
    const response = await fetch(mediaUrl, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10000),
    });
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}
