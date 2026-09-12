/**
 * WhatsAppApiService.js
 *
 * Direct Meta WhatsApp Business Cloud API Transport Service (Graph API).
 *
 * Dedicated transport client for Meta Graph API messaging and media.
 * Provider-neutral wrappers and multi-provider dynamic resolution are eliminated.
 */

export default class WhatsAppApiService {
  constructor({
    accessToken = process.env.WHATSAPP_ACCESS_TOKEN,
    phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID,
    graphApiVersion = process.env.WHATSAPP_GRAPH_API_VERSION || "v23.0",
  } = {}) {
    this.accessToken = accessToken || null;
    this.phoneNumberId = phoneNumberId || null;
    this.graphApiVersion = graphApiVersion || "v23.0";
    this.baseUrl = `https://graph.facebook.com/${this.graphApiVersion}`;
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

  // =====================================================
  // BASE SEND (Meta WhatsApp Business Cloud API)
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

  // =====================================================
  // MEDIA API
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

  async getMedia(mediaId) {
    return this.getMediaMetadata(mediaId);
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
