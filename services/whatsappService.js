/**
 * Legacy WhatsApp Service Compatibility Gateway
 *
 * Delegates all messaging through the canonical WhatsAppService architecture:
 * services/whatsappService.js
 *         ↓
 * ai-bot/modules/whatsapp/WhatsAppService.js
 *         ↓
 * WhatsAppOutboundPolicy
 *         ↓
 * WhatsAppApiService
 *         ↓
 * Meta Graph API
 */

let whatsAppServiceInstance = null;

async function getWhatsAppService() {
  if (!whatsAppServiceInstance) {
    const WhatsAppServiceModule = await import(
      "../ai-bot/modules/whatsapp/WhatsAppService.js"
    );
    const WhatsAppService =
      WhatsAppServiceModule.default || WhatsAppServiceModule;
    whatsAppServiceInstance = new WhatsAppService();
  }
  return whatsAppServiceInstance;
}

const sendWhatsAppMessage = async ({
  phone,
  message,
  inboundTriggerContext = {},
  now = Date.now(),
} = {}) => {
  try {
    const service = await getWhatsAppService();
    return await service.sendTextMessage(phone, message, {
      inboundTriggerContext,
      now,
    });
  } catch (error) {
    console.error(
      "[Legacy WhatsApp Service] Error delegating send:",
      error.message,
    );
    return {
      sent: false,
      blocked: true,
      error: error.message,
    };
  }
};

module.exports = sendWhatsAppMessage;
