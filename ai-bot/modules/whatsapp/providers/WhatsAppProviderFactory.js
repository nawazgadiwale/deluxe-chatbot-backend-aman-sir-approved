/**
 * WhatsAppProviderFactory.js
 *
 * Resolves the Meta WhatsApp Cloud API provider.
 * Core business and AI layers never instantiate providers directly.
 */

import MetaProviderAdapter from "./MetaProviderAdapter.js";

let customProviderInstance = null;

export default class WhatsAppProviderFactory {
  static getProvider(requestedProvider = null, config = {}) {
    if (!requestedProvider && customProviderInstance) {
      return customProviderInstance;
    }

    if (requestedProvider) {
      const providerName = String(requestedProvider).trim().toLowerCase();
      if (providerName !== "meta") {
        throw new Error(
          `Unsupported WHATSAPP_PROVIDER: "${providerName}". Only "meta" is supported.`,
        );
      }
    }

    console.log("[WhatsApp] PROVIDER_SELECTED: meta");

    return new MetaProviderAdapter(config);
  }

  static setProvider(provider) {
    customProviderInstance = provider;
  }

  static resetProvider() {
    customProviderInstance = null;
  }
}