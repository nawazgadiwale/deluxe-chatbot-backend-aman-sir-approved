const express = require("express");
const router = express.Router();

let webhookHandlerInstance = null;

async function getWebhookHandler() {
  if (!webhookHandlerInstance) {
    const HandlerModule = await import(
      "../ai-bot/modules/whatsapp/WhatsAppWebhookHandler.js"
    );
    const WhatsAppWebhookHandler =
      HandlerModule.default || HandlerModule;
    webhookHandlerInstance = new WhatsAppWebhookHandler();
  }
  return webhookHandlerInstance;
}

function setWebhookHandler(handler) {
  webhookHandlerInstance = handler;
}

// =====================================================
// GET /webhooks/whatsapp (Verification Challenge)
// =====================================================
router.get("/", async (req, res, next) => {
  try {
    return (await getWebhookHandler()).verify(req, res);
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    return await (await getWebhookHandler()).handle(req, res);
  } catch (error) {
    next(error);
  }
});

router.setWebhookHandler = setWebhookHandler;
router.getWebhookHandler = getWebhookHandler;

module.exports = router;
