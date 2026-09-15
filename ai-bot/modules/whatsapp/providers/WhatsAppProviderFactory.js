/**
 * WhatsAppProviderFactory.js
 *
 * Resolves the active WhatsApp Transport Provider adapter from environment configuration.
 *
 * Switching between Whapi and Meta requires ONLY setting:
 * WHATSAPP_PROVIDER=whapi
 * or
 * WHATSAPP_PROVIDER=meta
 *
 * Core business and AI workflow layers NEVER instantiate provider adapters directly.
 */

import WhapiProviderAdapter from "./WhapiProviderAdapter.js";
import MetaProviderAdapter from "./MetaProviderAdapter.js";

let customProviderInstance = null;

export default class WhatsAppProviderFactory {
  /**
   * Resolves the active WhatsApp provider instance based on environment or configuration.
   *
   * @param {string} [requestedProvider] - Optional explicit provider name ('whapi' | 'meta')
   * @param {Object} [config] - Optional configuration overrides
   * @returns {BaseWhatsAppProvider} Active provider adapter
   */
  static getProvider(requestedProvider = null, config = {}) {
    if (customProviderInstance && !requestedProvider) {
      return customProviderInstance;
    }

    const providerName = String(
      requestedProvider ||
        process.env.WHATSAPP_PROVIDER ||
        (process.env.WHAPI_TOKEN ? "whapi" : "") ||
        (process.env.WHATSAPP_ACCESS_TOKEN ? "meta" : "") ||
        "whapi",
    )
      .trim()
      .toLowerCase();

    console.log(`[WhatsApp] PROVIDER_SELECTED: ${providerName}`);

    switch (providerName) {
      case "meta":
        return new MetaProviderAdapter(config);

      case "whapi":
        return new WhapiProviderAdapter(config);

      default:
        throw new Error(
          `Unsupported WHATSAPP_PROVIDER: "${providerName}". Supported providers are "whapi" and "meta".`,
        );
    }
  }

  /**
   * Injects a custom provider instance (used for testing and mocking).
   * @param {BaseWhatsAppProvider|null} provider
   */
  static setProvider(provider) {
    customProviderInstance = provider;
  }

  /**
   * Resets injected provider instance.
   */
  static resetProvider() {
    customProviderInstance = null;
  }
}
