/**
 * WhatsAppMessageParser.js
 *
 * Normalizes incoming raw WhatsApp messages into canonical internal AI/session inputs.
 */

import WhatsAppSessionService from "./WhatsAppSessionService.js";
import WhatsAppFlowTokenService from "./WhatsappFlowTokenService.js";
import WhatsappActionCodec from "./WhatsappActionCodec.js";

const SUPPORTED_MESSAGE_TYPES = new Set([
  "text",
  "interactive",
  "button_reply",
  "list_reply",
  "button",
  "reply",
  "image",
  "document",
  "audio",
  "video",
  "sticker",
  "location",
  "contacts",
]);

export default class WhatsAppMessageParser {
  constructor() {
    this.sessionService = new WhatsAppSessionService();
    this.flowTokenService = new WhatsAppFlowTokenService();
  }

  isSupported(message = {}) {
    return SUPPORTED_MESSAGE_TYPES.has(message?.type);
  }

  parse({ message = {}, metadata = {}, contacts = [] } = {}) {
    if (!message?.type || !message?.from) return null;

    const contact = contacts?.[0] ?? {};
    const identity = this.sessionService.buildSession({
      phoneNumber: message.from,
      name: contact?.profile?.name ?? null,
      messageId: message.id ?? null,
      timestamp: message.timestamp ?? null,
      phoneNumberId: metadata?.phone_number_id ?? null,
      businessAccountId: metadata?.business_account_id ?? null,
      displayPhoneNumber: metadata?.display_phone_number ?? null,
    });

    const type = message.type;
    if (type === "text") {
      return this.parseText({ message, identity });
    }
    if (type === "interactive") {
      return this.parseInteractive({ message, identity });
    }
    if (type === "button_reply" || type === "button" || type === "list_reply" || type === "reply") {
      return this.parseReply({ message, identity });
    }
    if (["image", "document", "audio", "video", "sticker"].includes(type)) {
      return this.parseMedia({ message, identity, mediaType: type });
    }
    if (type === "location") {
      return this.parseLocation({ message, identity });
    }
    if (type === "contacts") {
      return this.parseContacts({ message, identity });
    }

    return null;
  }

  // =====================================================
  // INTERACTIVE BUTTON / LIST / REPLY
  // =====================================================

  parseInteractive({ message, identity }) {
    const inter = message?.interactive ?? {};
    if (inter.type === "nfm_reply") {
      return this.parseFlowReply({ message, identity });
    }
    return this.parseReply({ message, identity });
  }

  parseReply({ message, identity }) {
    const inter = message?.interactive ?? {};
    const reply =
      inter.button_reply ??
      inter.list_reply ??
      message?.reply?.buttons_reply ??
      message?.reply?.button_reply ??
      message?.reply?.list_reply ??
      message?.reply ??
      message?.button_reply ??
      message?.list_reply ??
      message?.button ??
      message?.action ??
      {};

    const id =
      reply.id ??
      message?.reply?.id ??
      message?.selected_id ??
      null;

    const title = (
      reply.title ??
      reply.label ??
      message?.reply?.title ??
      message?.reply?.text ??
      message?.body ??
      ""
    ).trim();

    if (id) {
      const decoded = WhatsappActionCodec.decode(id);
      const actionId = decoded?.id || decoded?.type || id;
      const actionType = decoded?.type || decoded?.id || actionId;
      const actionPayload = decoded?.payload ?? { value: id, label: title };

      console.log("[WhatsApp Interactive] INBOUND_INTERACTIVE_ACTION:", {
        actionId,
        type: actionType,
        id,
        title,
        payload: actionPayload,
      });

      return {
        ...this.baseAIInput({ identity, message }),
        message: title || String(actionId),
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
        attachments: [],
        eventType: "ACTION",
        isFlowSubmission: false,
      };
    }

    if (title) {
      return {
        ...this.baseAIInput({ identity, message }),
        message: title,
        action: null,
        attachments: [],
        eventType: "MESSAGE",
        isFlowSubmission: false,
      };
    }

    return null;
  }

  parseButtonReply(params) {
    return this.parseReply(params);
  }

  parseListReply(params) {
    return this.parseReply(params);
  }

  // =====================================================
  // TEXT
  // =====================================================

  parseText({ message, identity }) {
    const text = message?.text?.body?.trim() ?? "";
    if (!text) return null;

    return {
      ...this.baseAIInput({ identity, message }),
      message: text,
      action: null,
      attachments: [],
      eventType: "MESSAGE",
      isFlowSubmission: false,
    };
  }

  // =====================================================
  // WHATSAPP FLOW (NFM)
  // =====================================================

  parseFlowReply({ message, identity }) {
    const nfm = message?.interactive?.nfm_reply ?? {};
    let responseJson = null;

    if (nfm?.response_json) {
      try {
        responseJson =
          typeof nfm.response_json === "string"
            ? JSON.parse(nfm.response_json)
            : nfm.response_json;
      } catch (err) {
        console.error("WhatsApp Flow response JSON parse error:", err.message);
        return null;
      }
    }

    if (!responseJson || typeof responseJson !== "object") {
      console.warn("WhatsApp Flow submitted without response data.");
      return null;
    }

    const flowToken = nfm?.body ?? null;
    const tokenPayload = this.flowTokenService.verify(flowToken);

    if (!tokenPayload) {
      console.error("Invalid or expired WhatsApp Flow token.");
      return {
        ...this.baseAIInput({ identity, message }),
        message: "",
        action: { id: "INVALID_FLOW", payload: { responseJson } },
        attachments: [],
        eventType: "FLOW_SUBMISSION",
        isFlowSubmission: true,
        flow: { responseJson, flowToken, tokenPayload: null, valid: false },
      };
    }

    if (
      tokenPayload.phoneNumber &&
      String(tokenPayload.phoneNumber) !==
        String(identity?.whatsapp?.phoneNumber)
    ) {
      console.error("WhatsApp Flow phone mismatch.");
      return null;
    }

    const actionId =
      tokenPayload.type === "ORDER_FORM"
        ? "SUBMIT_ORDER_FORM"
        : tokenPayload.type === "LEAD_FORM"
          ? "SUBMIT_LEAD"
          : null;

    if (!actionId) {
      console.error("Unknown WhatsApp Flow type:", tokenPayload.type);
      return null;
    }

    const formId =
      responseJson?.form_id ??
      responseJson?.formId ??
      tokenPayload?.formId ??
      null;

    const values =
      responseJson?.values ??
      responseJson?.formData ??
      responseJson?.data ??
      responseJson;

    return {
      ...this.baseAIInput({ identity, message }),
      message: "",
      flowType: tokenPayload.type,
      flowToken,
      flowResponse: responseJson,
      flowData: responseJson,
      flowContext: { ...tokenPayload, formId },
      action: {
        id: actionId,
        payload: {
          ...responseJson,
          formId,
          productId: tokenPayload?.productId ?? null,
          workflow: tokenPayload?.workflow ?? "SALES",
          values,
          responseJson,
          flowResponse: responseJson,
          flowToken,
          tokenPayload,
        },
      },
      attachments: [],
      eventType: "FLOW_SUBMISSION",
      isFlowSubmission: true,
      flow: {
        responseJson,
        flowToken,
        flowName: nfm?.name ?? null,
        type: tokenPayload.type,
        tokenPayload,
        valid: true,
      },
    };
  }

  // =====================================================
  // MEDIA, LOCATION, CONTACTS
  // =====================================================

  parseMedia({ message, identity, mediaType }) {
    const media = message?.[mediaType] ?? {};
    if (!media?.id) return null;

    return {
      ...this.baseAIInput({ identity, message }),
      message: media?.caption?.trim() ?? "",
      action: null,
      attachments: [
        {
          mediaId: media.id,
          mimeType: media?.mime_type ?? null,
          filename: media?.filename ?? null,
          sha256: media?.sha256 ?? null,
          type: mediaType,
          caption: media?.caption ?? null,
          downloaded: false,
        },
      ],
      eventType: "MEDIA",
      isFlowSubmission: false,
    };
  }

  parseLocation({ message, identity }) {
    const loc = message?.location ?? {};
    return {
      ...this.baseAIInput({ identity, message }),
      message: "",
      action: null,
      attachments: [],
      location: {
        latitude: loc?.latitude ?? null,
        longitude: loc?.longitude ?? null,
        name: loc?.name ?? null,
        address: loc?.address ?? null,
      },
      eventType: "LOCATION",
      isFlowSubmission: false,
    };
  }

  parseContacts({ message, identity }) {
    return {
      ...this.baseAIInput({ identity, message }),
      message: "",
      action: null,
      attachments: [],
      contacts: Array.isArray(message?.contacts) ? message.contacts : [],
      eventType: "CONTACTS",
      isFlowSubmission: false,
    };
  }

  baseAIInput({ identity, message }) {
    return {
      sessionId: identity?.sessionId,
      visitorId: identity?.visitorId,
      site: "exprintmart",
      visitor: identity?.visitor,
      channel: "WHATSAPP",
      whatsapp: {
        ...identity?.whatsapp,
        messageId: message?.id ?? null,
        timestamp: message?.timestamp ?? null,
      },
      ipAddress: null,
      initiatedByCustomer: true,
      originalMessage: message,
    };
  }
}
