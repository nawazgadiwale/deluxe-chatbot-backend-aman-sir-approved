/**
 * BaseWhatsAppProvider.js
 *
 * Canonical Base Class for WhatsApp Transport & Channel Providers.
 *
 * All WhatsApp providers (Whapi, Meta Cloud API, etc.) MUST implement this interface.
 * The application core communicates exclusively through this provider-neutral contract.
 */
export default class BaseWhatsAppProvider {
  /**
   * @param {Object} config - Provider configuration
   */
  constructor(config = {}) {
    this.config = config;
  }

  /**
   * Provider identifier ("whapi" | "meta")
   * @returns {string}
   */
  get name() {
    return "base";
  }

  /**
   * Returns supported feature capabilities of this provider.
   * @returns {{ interactiveButtons: boolean, interactiveLists: boolean, templates: boolean, media: boolean, customerServiceWindow: boolean, nativeFlows: boolean }}
   */
  getCapabilities() {
    return {
      interactiveButtons: false,
      interactiveLists: false,
      templates: false,
      media: false,
      customerServiceWindow: false,
      nativeFlows: false,
    };
  }

  /**
   * Verifies incoming webhook setup challenge (HTTP GET /webhooks/whatsapp).
   * @param {Object} req - Express request object
   * @returns {{ verified: boolean, challenge: string|null, status: number, body: any }}
   */
  verifyWebhook(req) {
    throw new Error("verifyWebhook() must be implemented by provider adapter.");
  }

  /**
   * Authenticates incoming webhook event payload (HTTP POST /webhooks/whatsapp).
   * @param {Object} req - Express request object
   * @returns {{ authenticated: boolean, status: number, error: string|null }}
   */
  authenticateWebhook(req) {
    throw new Error("authenticateWebhook() must be implemented by provider adapter.");
  }

  /**
   * Normalizes provider-specific webhook payload into uniform internal message events.
   * @param {Object} reqBody - Webhook request body
   * @param {Object} authContext - Webhook authentication context
   * @param {Object} reqHeaders - Webhook request headers
   * @returns {Array<Object>} Array of normalized inbound message objects
   */
  normalizeInbound(reqBody = {}, authContext = {}, reqHeaders = {}) {
    throw new Error("normalizeInbound() must be implemented by provider adapter.");
  }

  /**
   * Dispatches an outbound message to a recipient.
   * @param {string} to - Recipient phone number (clean digits)
   * @param {Object} message - Normalized message payload ({ type, text, interactive, etc. })
   * @param {Object} [options] - Delivery options
   * @returns {Promise<Object>} Provider send result
   */
  async sendMessage(to, message, options = {}) {
    throw new Error("sendMessage() must be implemented by provider adapter.");
  }

  /**
   * Sends plain text message.
   */
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

  /**
   * Sends interactive button message (<= 3 buttons).
   */
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

  /**
   * Sends interactive list message (4 to 10 options).
   */
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

  /**
   * Sends a native WhatsApp Flow message.
   * @param {string} to - Recipient phone number
   * @param {Object} flowMessage - Interactive flow message payload
   * @param {Object} [options] - Delivery options
   * @returns {Promise<Object>}
   */
  async sendFlow(to, flowMessage, options = {}) {
    return this.sendMessage(to, flowMessage, options);
  }

  /**
   * Evaluates provider-specific outbound policy rules (e.g. 24-hour window for Meta).
   * @param {Object} params
   * @returns {{ allowed: boolean, blocked: boolean, reason: string|null, windowRemainingMs: number, windowExpiresAt: number|null }}
   */
  checkOutboundEligibility(params = {}) {
    return {
      allowed: true,
      blocked: false,
      reason: null,
      windowRemainingMs: 86400000,
      windowExpiresAt: null,
    };
  }

  /**
   * Fetches media metadata.
   */
  async getMediaMetadata(mediaId) {
    throw new Error("getMediaMetadata() not implemented.");
  }

  /**
   * Downloads media binary.
   */
  async downloadMedia(mediaUrl) {
    throw new Error("downloadMedia() not implemented.");
  }
}
