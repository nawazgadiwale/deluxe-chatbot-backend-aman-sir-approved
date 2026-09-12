import WhatsAppSessionService from "./WhatsAppSessionService.js";
import WhatsappActionCodec from "./WhatsappActionCodec.js";

export default class WhatsAppMessageParser {
  constructor() {
    this.sessionService = new WhatsAppSessionService();
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
    if (!message?.type || !message?.from) return null;

    const identity = this.sessionService.buildSession({
      phoneNumber: message.from,
      name: contacts?.[0]?.profile?.name ?? null,
      messageId: message?.id ?? null,
      timestamp: message?.timestamp ?? null,
      phoneNumberId: metadata?.phone_number_id ?? null,
      businessAccountId: metadata?.business_account_id ?? null,
      displayPhoneNumber: metadata?.display_phone_number ?? null,
    });

    const args = { message, identity };

    switch (message.type) {
      case "text":
        return this.parseText(args);

      case "interactive":
        return this.parseInteractive(args);

      case "button_reply":
      case "button":
        return this.parseButtonReply(args);

      case "list_reply":
        return this.parseListReply(args);

      case "reply":
        return this.parseReply(args);

      case "image":
      case "document":
      case "audio":
      case "video":
      case "sticker":
        return this.parseMedia({
          ...args,
          mediaType: message.type,
        });

      case "location":
        return this.parseLocation(args);

      case "contacts":
        return this.parseContacts(args);

      default:
        return null;
    }
  }

  parseReply({ message, identity }) {
    const reply = message?.reply || {};
    const button = reply.buttons_reply || reply.button_reply || {};
    const list = reply.list_reply || {};

    const id =
      reply.id ??
      button.id ??
      list.id ??
      message?.button_reply?.id ??
      message?.action?.id ??
      message?.selected_id;

    const title =
      reply.title ??
      button.title ??
      list.title ??
      message?.button_reply?.title ??
      message?.action?.title ??
      reply.text ??
      message?.body ??
      "";

    if (id) {
      return this.parseAction({
        message,
        identity,
        id,
        title,
        description: list.description,
      });
    }

    const text = title.trim();
    return text ? this.messageResult(identity, message, text) : null;
  }

  parseText({ message, identity }) {
    const text = message?.text?.body?.trim() ?? "";
    return text ? this.messageResult(identity, message, text) : null;
  }

  parseInteractive({ message, identity }) {
    const type = message?.interactive?.type;

    if (type === "button_reply") {
      return this.parseButtonReply({ message, identity });
    }

    if (type === "list_reply") {
      return this.parseListReply({ message, identity });
    }

    return null;
  }

  parseButtonReply({ message, identity }) {
    const reply =
      message?.interactive?.button_reply ??
      message?.button_reply ??
      message?.button ??
      {};

    const id = reply?.id ?? message?.action?.id;
    const title =
      reply?.title?.trim() ??
      reply?.label?.trim() ??
      "";

    return id
      ? this.parseAction({
          message,
          identity,
          id,
          title,
        })
      : null;
  }

  parseListReply({ message, identity }) {
    const reply =
      message?.interactive?.list_reply ??
      message?.list_reply ??
      message?.action ??
      {};

    const id = reply?.id;
    const title =
      reply?.title?.trim() ??
      reply?.label?.trim() ??
      "";

    return id
      ? this.parseAction({
          message,
          identity,
          id,
          title,
          description: reply?.description,
        })
      : null;
  }

  parseAction({
    message,
    identity,
    id,
    title = "",
    description = null,
  }) {
    const decoded = WhatsappActionCodec.decode(id);

    const actionId =
      decoded?.id ||
      decoded?.type ||
      id;

    const actionType =
      decoded?.type ||
      decoded?.id ||
      actionId;

    const payload =
      decoded?.payload ?? {
        value: id,
        label: title,
      };

    return {
      ...this.baseAIInput({ identity, message }),

      message: title || String(actionId),

      action: {
        id: actionId,
        type: actionType,
        payload: {
          ...payload,
          label: payload.label ?? title,
          value: payload.value ?? id,
          ...(description != null && {
            description:
              payload.description ?? description,
          }),
        },
      },

      attachments: [],
      eventType: "ACTION",
    };
  }

  parseMedia({ message, identity, mediaType }) {
    const media =
      message?.[mediaType] ?? {};

    if (!media?.id) return null;

    return {
      ...this.baseAIInput({
        identity,
        message,
      }),

      message:
        media?.caption?.trim() ?? "",

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
    };
  }

  parseLocation({ message, identity }) {
    const location =
      message?.location ?? {};

    return {
      ...this.baseAIInput({
        identity,
        message,
      }),

      message: "",
      action: null,
      attachments: [],

      location: {
        latitude:
          location?.latitude ?? null,
        longitude:
          location?.longitude ?? null,
        name:
          location?.name ?? null,
        address:
          location?.address ?? null,
      },

      eventType: "LOCATION",
    };
  }

  parseContacts({ message, identity }) {
    return {
      ...this.baseAIInput({
        identity,
        message,
      }),

      message: "",
      action: null,
      attachments: [],

      contacts: Array.isArray(message?.contacts)
        ? message.contacts
        : [],

      eventType: "CONTACTS",
    };
  }

  messageResult(identity, message, text) {
    return {
      ...this.baseAIInput({
        identity,
        message,
      }),

      message: text,
      action: null,
      attachments: [],
      eventType: "MESSAGE",
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