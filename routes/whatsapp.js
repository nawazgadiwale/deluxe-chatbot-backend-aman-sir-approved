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
    const handler = await getWebhookHandler();
    return handler.verify(req, res);
  } catch (err) {
    return next(err);
  }
});

router.get("/whatsapp", async (req, res, next) => {
  try {
    const handler = await getWebhookHandler();
    return handler.verify(req, res);
  } catch (err) {
    return next(err);
  }
});

// =====================================================
// POST /webhooks/whatsapp (Inbound Events)
// =====================================================

router.post("/", async (req, res, next) => {
  try {
    const handler = await getWebhookHandler();
    return await handler.handle(req, res);
  } catch (err) {
    return next(err);
  }
});

router.post("/whatsapp", async (req, res, next) => {
  try {
    const handler = await getWebhookHandler();
    return await handler.handle(req, res);
  } catch (err) {
    return next(err);
  }
});

router.setWebhookHandler = setWebhookHandler;
router.getWebhookHandler = getWebhookHandler;

module.exports = router;
