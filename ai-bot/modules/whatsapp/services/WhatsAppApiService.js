/**
 * WhatsAppApiService.js
 *
 * WhatsApp Transport Gateway Layer.
 *
 * Delegates all messaging, media, and provider operations to the active WhatsApp provider adapter
 * resolved dynamically by WhatsAppProviderFactory (Whapi vs Meta Cloud API).
 *
 * Backward-compatible with all existing callers.
 */

import WhatsAppProviderFactory from "../providers/WhatsAppProviderFactory.js";

export default class WhatsAppApiService {
  constructor({
    accessToken = process.env.WHATSAPP_ACCESS_TOKEN,
    phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID,
    graphApiVersion = process.env.WHATSAPP_GRAPH_API_VERSION || "v23.0",
    whapiToken = process.env.WHAPI_TOKEN,
    whapiApiUrl = process.env.WHAPI_API_BASE_URL ||
      process.env.WHAPI_API_URL ||
      "https://gate.whapi.cloud",
    provider = null,
  } = {}) {
    this.accessToken = accessToken;
    this.phoneNumberId = phoneNumberId;
    this.graphApiVersion = graphApiVersion;
    this.baseUrl = `https://graph.facebook.com/${this.graphApiVersion}`;
    this.whapiToken = whapiToken;
    this.whapiApiUrl = (whapiApiUrl || "https://gate.whapi.cloud").replace(
      /\/+$/,
      "",
    );
    this.provider = provider || null;
  }

  getProvider() {
    if (this.provider) return this.provider;
    return WhatsAppProviderFactory.getProvider();
  }

  // =====================================================
  // MESSAGING API METHODS
  // =====================================================

  async sendTextMessage(to, body, options = {}) {
    return this.sendMessage(
      to,
      {
        type: "text",
        text: {
          preview_url: false,
          body,
        },
      },
      options,
    );
  }

  async sendImageMessage(to, imageUrl, caption = "", options = {}) {
    return this.sendMessage(
      to,
      {
        type: "image",
        image: {
          link: imageUrl,
          ...(caption ? { caption: String(caption).trim() } : {}),
        },
      },
      options,
    );
  }

  async sendButtonMessage(
    to,
    bodyText,
    buttons = [],
    header = null,
    footer = null,
    options = {},
  ) {
    const payload = {
      type: "interactive",
      interactive: {
        type: "button",
        body: {
          text: bodyText,
        },
        action: {
          buttons: buttons.map((b, index) => ({
            type: "reply",
            reply: {
              id: b.id ?? `btn_${index}`,
              title: String(b.title ?? b.label ?? `Option ${index + 1}`)
                .trim()
                .slice(0, 20),
            },
          })),
        },
        ...(header ? { header } : {}),
        ...(footer ? { footer: { text: footer } } : {}),
      },
    };

    return this.sendMessage(to, payload, options);
  }

  async sendListMessage(
    to,
    bodyText,
    buttonText,
    sections = [],
    header = null,
    footer = null,
    options = {},
  ) {
    const payload = {
      type: "interactive",
      interactive: {
        type: "list",
        body: {
          text: bodyText,
        },
        action: {
          button: String(buttonText || "Choose Option")
            .trim()
            .slice(0, 20),
          sections: sections.map((sec) => ({
            title: String(sec.title || "Options")
              .trim()
              .slice(0, 24),
            rows: (sec.rows || []).map((row, rIdx) => ({
              id: row.id ?? `row_${rIdx}`,
              title: String(row.title ?? row.label ?? `Item ${rIdx + 1}`)
                .trim()
                .slice(0, 24),
              ...(row.description
                ? { description: String(row.description).trim().slice(0, 72) }
                : {}),
            })),
          })),
        },
        ...(header ? { header } : {}),
        ...(footer ? { footer: { text: footer } } : {}),
      },
    };

    return this.sendMessage(to, payload, options);
  }

  async sendFlowMessage(
    to,
    bodyText,
    flowParams = {},
    header = null,
    footer = null,
    options = {},
  ) {
    const payload = {
      type: "interactive",
      interactive: {
        type: "flow",
        body: {
          text: bodyText,
        },
        action: {
          name: "flow",
          parameters: flowParams,
        },
        ...(header ? { header } : {}),
        ...(footer ? { footer: { text: footer } } : {}),
      },
    };

    return this.sendMessage(to, payload, options);
  }

  // =====================================================
  // BASE SEND
  // =====================================================

  async sendMessage(to, message, options = {}) {
    return this.getProvider().sendMessage(to, message, options);
  }

  async sendFlow(to, message, options = {}) {
    return this.getProvider().sendFlow(to, message, options);
  }

  // =====================================================
  // MEDIA API
  // =====================================================

  async getMediaMetadata(mediaId) {
    return this.getProvider().getMediaMetadata(mediaId);
  }

  async getMedia(mediaId) {
    return this.getMediaMetadata(mediaId);
  }

  async downloadMedia(mediaUrl) {
    return this.getProvider().downloadMedia(mediaUrl);
  }
}
