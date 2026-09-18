/**
 * WhatsAppApiService.js
 *
 * WhatsApp Transport Gateway Layer for Meta WhatsApp Cloud API.
 * Delegates all messaging, media, and provider operations to the active provider adapter.
 */

import WhatsAppProviderFactory from "../providers/WhatsAppProviderFactory.js";

export default class WhatsAppApiService {
  constructor({
    accessToken = process.env.WHATSAPP_ACCESS_TOKEN,
    phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID,
    graphApiVersion = process.env.WHATSAPP_GRAPH_API_VERSION || "v23.0",
    provider = null,
  } = {}) {
    this.accessToken = accessToken;
    this.phoneNumberId = phoneNumberId;
    this.graphApiVersion = graphApiVersion;
    this.baseUrl = `https://graph.facebook.com/${this.graphApiVersion}`;
    this.provider = provider || null;
  }

  getProvider() {
    return this.provider || WhatsAppProviderFactory.getProvider();
  }

  async sendMessage(to, message, options = {}) {
    return this.getProvider().sendMessage(to, message, options);
  }

  async sendTextMessage(to, body, options = {}) {
    return this.sendMessage(to, { type: "text", text: { preview_url: false, body } }, options);
  }

  async sendImageMessage(to, imageUrl, caption = "", options = {}) {
    return this.sendMessage(
      to,
      { type: "image", image: { link: imageUrl, ...(caption ? { caption: String(caption).trim() } : {}) } },
      options,
    );
  }

  async sendButtonMessage(to, bodyText, buttons = [], header = null, footer = null, options = {}) {
    return this.sendMessage(
      to,
      {
        type: "interactive",
        interactive: {
          type: "button",
          body: { text: bodyText },
          action: {
            buttons: buttons.map((b, i) => ({
              type: "reply",
              reply: {
                id: b.id ?? `btn_${i}`,
                title: String(b.title ?? b.label ?? `Option ${i + 1}`).trim().slice(0, 20),
              },
            })),
          },
          ...(header ? { header } : {}),
          ...(footer ? { footer: { text: footer } } : {}),
        },
      },
      options,
    );
  }

  async sendListMessage(to, bodyText, buttonText = "Select", sections = [], header = null, footer = null, options = {}) {
    return this.sendMessage(
      to,
      {
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
      },
      options,
    );
  }

  async sendFlowMessage(
    to,
    bodyText,
    flowParams = {},
    header = null,
    footer = null,
    options = {},
  ) {
    return this.getProvider().sendFlowMessage(
      to,
      bodyText,
      flowParams,
      header,
      footer,
      options,
    );
  }

  async sendFlow(to, message, options = {}) {
    return this.getProvider().sendFlow(to, message, options);
  }

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
