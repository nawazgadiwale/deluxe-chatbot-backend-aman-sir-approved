import WhatsAppSessionService from "./WhatsAppSessionService.js";
import WhatsAppFlowTokenService from "./WhatsappFlowTokenService.js";
import WhatsappActionCodec from "./WhatsappActionCodec.js";

export default class WhatsAppMessageParser {
  constructor() {
    this.sessionService = new WhatsAppSessionService();
    this.flowTokenService = new WhatsAppFlowTokenService();
  }

  isSupported(message = {}) {
    return [
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
    ].includes(message?.type);
  }

  parse({ message = {}, metadata = {}, contacts = [] } = {}) {
    if (!message?.type) {
      return null;
    }

    const phoneNumber = message?.from ?? null;

    if (!phoneNumber) {
      return null;
    }

    const contact = contacts?.[0] ?? {};

    const identity = this.sessionService.buildSession({
      phoneNumber,

      name: contact?.profile?.name ?? null,

      messageId: message?.id ?? null,

      timestamp: message?.timestamp ?? null,

      phoneNumberId: metadata?.phone_number_id ?? null,

      businessAccountId: metadata?.business_account_id ?? null,

      displayPhoneNumber: metadata?.display_phone_number ?? null,
    });

    switch (message.type) {
      case "text":
        return this.parseText({
          message,
          identity,
        });

      case "interactive":
        return this.parseInteractive({
          message,
          identity,
        });

      case "button_reply":
      case "button":
        return this.parseButtonReply({
          message,
          identity,
        });

      case "list_reply":
        return this.parseListReply({
          message,
          identity,
        });

      case "reply":
        return this.parseReply({
          message,
          identity,
        });

      case "image":
      case "document":
      case "audio":
      case "video":
      case "sticker":
        return this.parseMedia({
          message,
          identity,
          mediaType: message.type,
        });

      case "location":
        return this.parseLocation({
          message,
          identity,
        });

      case "contacts":
        return this.parseContacts({
          message,
          identity,
        });

      default:
        return null;
    }
  }

  // =====================================================
  // REPLY (WHAPI BUTTON / LIST / QUOTED REPLY)
  // =====================================================

  parseReply({ message, identity }) {
    const replyObj = message?.reply || {};
    const replyButtonObj =
      replyObj.buttons_reply || replyObj.button_reply || {};
    const replyListObj = replyObj.list_reply || {};

    const id =
      replyObj.id ??
      replyButtonObj.id ??
      replyListObj.id ??
      message?.button_reply?.id ??
      message?.action?.id ??
      message?.selected_id ??
      null;

    const title =
      replyObj.title ??
      replyButtonObj.title ??
      replyListObj.title ??
      message?.button_reply?.title ??
      message?.action?.title ??
      replyObj.text ??
      message?.body ??
      "";

    if (id) {
      const decoded = WhatsappActionCodec.decode(id);
      const actionId = decoded?.id || decoded?.type || id;
      const actionType = decoded?.type || decoded?.id || actionId;
      const actionPayload = decoded?.payload ?? { value: id, label: title };

      console.log("[Whapi Interactive] INBOUND_REPLY_RECEIVED:", {
        actionId,
        type: actionType,
        id,
        title,
        payload: actionPayload,
      });

      return {
        ...this.baseAIInput({
          identity,
          message,
        }),

        message: title || String(actionId),

        action: {
          id: actionId,
          type: actionType,
          payload: {
            ...actionPayload,
            label: actionPayload.label ?? title,
            value: actionPayload.value ?? id,
          },
        },

        attachments: [],

        eventType: "ACTION",

        isFlowSubmission: false,
      };
    }

    const text = (title || message?.body || "").trim();
    if (text) {
      return {
        ...this.baseAIInput({
          identity,
          message,
        }),

        message: text,

        action: null,

        attachments: [],

        eventType: "MESSAGE",

        isFlowSubmission: false,
      };
    }

    return null;
  }

  // =====================================================
  // TEXT
  // =====================================================

  parseText({ message, identity }) {
    const text = message?.text?.body?.trim() ?? "";

    if (!text) {
      return null;
    }

    return {
      ...this.baseAIInput({
        identity,
        message,
      }),

      message: text,

      action: null,

      attachments: [],

      eventType: "MESSAGE",

      isFlowSubmission: false,
    };
  }

  // =====================================================
  // INTERACTIVE
  // =====================================================

  parseInteractive({ message, identity }) {
    const interactive = message?.interactive ?? {};

    switch (interactive?.type) {
      case "button_reply":
        return this.parseButtonReply({
          message,
          identity,
        });

      case "list_reply":
        return this.parseListReply({
          message,
          identity,
        });

      case "nfm_reply":
        return this.parseFlowReply({
          message,
          identity,
        });

      default:
        return null;
    }
  }

  // =====================================================
  // BUTTON
  // =====================================================

  parseButtonReply({ message, identity }) {
    const reply =
      message?.interactive?.button_reply ??
      message?.button_reply ??
      message?.button ??
      {};

    const id = reply?.id ?? message?.action?.id ?? null;
    const title = reply?.title?.trim() ?? reply?.label?.trim() ?? "";

    if (!id) {
      return null;
    }

    const decoded = WhatsappActionCodec.decode(id);
    const actionId = decoded?.id || decoded?.type || id;
    const actionType = decoded?.type || decoded?.id || actionId;
    const actionPayload = decoded?.payload ?? { value: id, label: title };

    console.log("[Whapi Interactive] INBOUND_INTERACTIVE_ACTION:", {
      actionId,
      type: actionType,
      id,
      title,
      payload: actionPayload,
    });

    return {
      ...this.baseAIInput({
        identity,
        message,
      }),

      message: title || String(actionId),

      action: {
        id: actionId,
        type: actionType,
        payload: {
          ...actionPayload,
          label: actionPayload.label ?? title,
          value: actionPayload.value ?? id,
        },
      },

      attachments: [],

      eventType: "ACTION",

      isFlowSubmission: false,
    };
  }

  // =====================================================
  // LIST
  // =====================================================

  parseListReply({ message, identity }) {
    const reply =
      message?.interactive?.list_reply ??
      message?.list_reply ??
      message?.action ??
      {};

    const id = reply?.id ?? null;
    const title = reply?.title?.trim() ?? reply?.label?.trim() ?? "";

    if (!id) {
      return null;
    }

    const decoded = WhatsappActionCodec.decode(id);
    const actionId = decoded?.id || decoded?.type || id;
    const actionType = decoded?.type || decoded?.id || actionId;
    const actionPayload = decoded?.payload ?? { value: id, label: title };

    console.log("[Whapi Interactive] INBOUND_INTERACTIVE_ACTION:", {
      actionId,
      type: actionType,
      id,
      title,
      payload: actionPayload,
    });

    return {
      ...this.baseAIInput({
        identity,
        message,
      }),

      message: title || String(actionId),

      action: {
        id: actionId,
        type: actionType,
        payload: {
          ...actionPayload,
          value: actionPayload.value ?? id,
          label: actionPayload.label ?? title,
          description: actionPayload.description ?? reply?.description ?? null,
        },
      },

      attachments: [],

      eventType: "ACTION",

      isFlowSubmission: false,
    };
  }

  // =====================================================
  // WHATSAPP FLOW
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
      } catch (error) {
        console.error("WhatsApp Flow response JSON parse error:", error);

        return null;
      }
    }

    if (!responseJson || typeof responseJson !== "object") {
      console.warn("WhatsApp Flow submitted without response data.");

      return null;
    }

    /*
     * Meta's nfm_reply.body is used as the Flow token.
     */
    const flowToken = nfm?.body ?? null;

    const tokenPayload = this.flowTokenService.verify(flowToken);

    /*
     * Never trust a client supplied flow type.
     */
    if (!tokenPayload) {
      console.error("Invalid or expired WhatsApp Flow token.");

      return {
        ...this.baseAIInput({
          identity,
          message,
        }),

        message: "",

        action: {
          id: "INVALID_FLOW",

          payload: {
            responseJson,
          },
        },

        attachments: [],

        eventType: "FLOW_SUBMISSION",

        isFlowSubmission: true,

        flow: {
          responseJson,
          flowToken,
          tokenPayload: null,
          valid: false,
        },
      };
    }

    /*
     * Make sure the Flow belongs to the same
     * WhatsApp user that submitted it.
     */
    if (
      tokenPayload.phoneNumber &&
      String(tokenPayload.phoneNumber) !==
        String(identity?.whatsapp?.phoneNumber)
    ) {
      console.error("WhatsApp Flow phone mismatch.");

      return null;
    }

    let actionId;

    switch (tokenPayload.type) {
      case "ORDER_FORM":
        actionId = "SUBMIT_ORDER_FORM";
        break;

      case "LEAD_FORM":
        actionId = "SUBMIT_LEAD";
        break;

      default:
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
      ...this.baseAIInput({
        identity,
        message,
      }),

      message: "",

      flowType: tokenPayload.type,

      flowToken,

      flowResponse: responseJson,

      flowData: responseJson,

      flowContext: {
        ...tokenPayload,
        formId,
      },

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
  // MEDIA
  // =====================================================

  parseMedia({ message, identity, mediaType }) {
    const media = message?.[mediaType] ?? {};

    if (!media?.id) {
      return null;
    }

    return {
      ...this.baseAIInput({
        identity,
        message,
      }),

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

  // =====================================================
  // LOCATION
  // =====================================================

  parseLocation({ message, identity }) {
    const location = message?.location ?? {};

    return {
      ...this.baseAIInput({
        identity,
        message,
      }),

      message: "",

      action: null,

      attachments: [],

      location: {
        latitude: location?.latitude ?? null,

        longitude: location?.longitude ?? null,

        name: location?.name ?? null,

        address: location?.address ?? null,
      },

      eventType: "LOCATION",

      isFlowSubmission: false,
    };
  }

  // =====================================================
  // CONTACTS
  // =====================================================

  parseContacts({ message, identity }) {
    return {
      ...this.baseAIInput({
        identity,
        message,
      }),

      message: "",

      action: null,

      attachments: [],

      contacts: Array.isArray(message?.contacts) ? message.contacts : [],

      eventType: "CONTACTS",

      isFlowSubmission: false,
    };
  }

  // =====================================================
  // BASE INPUT
  // =====================================================

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
