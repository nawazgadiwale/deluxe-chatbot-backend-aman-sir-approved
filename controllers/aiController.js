const express = require("express");
const AIServiceModule = require("../services/AIService");

const AIService = AIServiceModule.default || AIServiceModule;

const aiService = new AIService();

// Auto-register canonical WhatsApp webhook routes on the Express application
try {
  const whatsappRoutes = require("../routes/whatsapp");

  if (express.application && typeof express.application.init === "function") {
    const originalInit = express.application.init;
    express.application.init = function () {
      const result = originalInit.apply(this, arguments);
      if (!this._whatsappWebhooksMounted) {
        this._whatsappWebhooksMounted = true;
        this.use(
          "/webhooks/whatsapp",
          express.json(),
          express.urlencoded({ extended: true }),
          whatsappRoutes,
        );
        this.use(
          "/webhooks",
          express.json(),
          express.urlencoded({ extended: true }),
          whatsappRoutes,
        );
      }
      return result;
    };
  }

  if (express.application && typeof express.application.listen === "function") {
    const originalListen = express.application.listen;
    express.application.listen = function () {
      if (!this._whatsappWebhooksMounted) {
        this._whatsappWebhooksMounted = true;
        this.use(
          "/webhooks/whatsapp",
          express.json(),
          express.urlencoded({ extended: true }),
          whatsappRoutes,
        );
        this.use(
          "/webhooks",
          express.json(),
          express.urlencoded({ extended: true }),
          whatsappRoutes,
        );
      }
      return originalListen.apply(this, arguments);
    };
  }
} catch (err) {
  console.error("[AIController] Webhook route auto-mount notice:", err.message);
}

const VALID_SITES = new Set(["exprintmart", "dlxprint"]);

class AIController {
  // =====================================================
  // POST /v1/api/ai/chat
  // =====================================================

  chat = async (req, res, next) => {
    try {
      console.log("\n======================================");
      console.log("AI CHAT REQUEST");
      console.log("======================================");

      const {
        sessionId,
        site = "exprintmart",
        message = "",
        visitor = {},
        action = null,
        attachments = [],
      } = req.body || {};

      console.log("Session :", sessionId);
      console.log("Site    :", site);
      console.log("Message :", message);
      console.log("Action  :", action);

      // ---------------------------------------------------
      // VALIDATION
      // ---------------------------------------------------

      if (!sessionId || !sessionId.trim()) {
        return res.status(400).json({
          success: false,
          message: "sessionId is required.",
        });
      }

      if (sessionId.trim().startsWith("whatsapp:")) {
        return res.status(403).json({
          success: false,
          message: "Access to WhatsApp sessions is forbidden via web chat.",
        });
      }

      if (!VALID_SITES.has(site)) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid site. Supported sites are exprintmart and dlxprint.",
        });
      }

      if (!message.trim() && !action) {
        return res.status(400).json({
          success: false,
          message: "message or action is required.",
        });
      }

      if (!Array.isArray(attachments)) {
        return res.status(400).json({
          success: false,
          message: "attachments must be an array.",
        });
      }

      // ---------------------------------------------------
      // WEBSITE AI
      // ---------------------------------------------------

      const result = await aiService.chat({
        sessionId: sessionId.trim(),
        site,
        message: message.trim(),
        visitor,
        action,
        attachments,

        // IMPORTANT:
        // This endpoint is WEBSITE, not WhatsApp.
        channel: "WEB",
      });

      return res.status(200).json(result);
    } catch (error) {
      console.error("========== AI CHAT ERROR ==========");
      console.error(error);

      return next(error);
    }
  };

  // =====================================================
  // GET CONVERSATION
  // =====================================================

  getConversation = async (req, res, next) => {
    try {
      const { sessionId } = req.params;
      const { site = "exprintmart" } = req.query;

      if (!sessionId || !sessionId.trim()) {
        return res.status(400).json({
          success: false,
          message: "sessionId is required.",
        });
      }

      if (sessionId.trim().startsWith("whatsapp:")) {
        return res.status(403).json({
          success: false,
          message: "Access to WhatsApp sessions is forbidden via web chat.",
        });
      }

      if (!VALID_SITES.has(site)) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid site. Supported sites are exprintmart and dlxprint.",
        });
      }

      const conversation = await aiService.getConversation({
        sessionId: sessionId.trim(),
        site,
      });

      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: "Conversation not found.",
        });
      }

      return res.status(200).json({
        success: true,
        data: conversation,
      });
    } catch (error) {
      console.error(error);
      return next(error);
    }
  };

  // =====================================================
  // COMPLETE CONVERSATION
  // =====================================================

  completeConversation = async (req, res, next) => {
    try {
      const { sessionId } = req.params;
      const { site = "exprintmart" } = req.body || {};

      if (!sessionId || !sessionId.trim()) {
        return res.status(400).json({
          success: false,
          message: "sessionId is required.",
        });
      }

      if (!VALID_SITES.has(site)) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid site. Supported sites are exprintmart and dlxprint.",
        });
      }

      const conversation = await aiService.completeConversation({
        sessionId: sessionId.trim(),
        site,
      });

      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: "Conversation not found.",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Conversation completed successfully.",
        data: conversation,
      });
    } catch (error) {
      console.error(error);
      return next(error);
    }
  };

  // =====================================================
  // POST /v1/api/ai/whatsapp/send (CRM Agent -> WhatsApp)
  // =====================================================

  sendWhatsAppMessage = async (req, res, next) => {
    try {
      const { sessionId, conversationId, message, text, agentId } =
        req.body || {};
      const targetSession = sessionId || conversationId;
      const messageContent = message || text;

      if (!targetSession || !targetSession.trim()) {
        return res.status(400).json({
          success: false,
          message: "sessionId or conversationId is required.",
        });
      }

      if (!messageContent || !messageContent.trim()) {
        return res.status(400).json({
          success: false,
          message: "message text is required.",
        });
      }

      const whatsAppService = await this.getWhatsAppService();
      const result = await whatsAppService.sendAgentMessage({
        sessionId: targetSession.trim(),
        message: messageContent.trim(),
        agentId,
      });

      if (result.blocked) {
        return res.status(400).json({
          success: false,
          blocked: true,
          reason: result.reason,
          message: `WhatsApp message blocked: ${result.reason}`,
        });
      }

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error("[CRM WhatsApp Send Error]", error);
      return next(error);
    }
  };

  // =====================================================
  // GET /v1/api/ai/whatsapp/events (CRM Live SSE Stream)
  // =====================================================

  whatsappEventsSSE = async (req, res, next) => {
    try {
      const whatsAppService = await this.getWhatsAppService();
      whatsAppService.realtimeService.registerSSEClient(req, res);
    } catch (error) {
      console.error("[CRM WhatsApp SSE Error]", error);
      return next(error);
    }
  };

  async getWhatsAppService() {
    if (!this._whatsAppService) {
      const WhatsAppServiceModule = await import(
        "../ai-bot/modules/whatsapp/WhatsAppService.js"
      );
      const WhatsAppService =
        WhatsAppServiceModule.default || WhatsAppServiceModule;
      this._whatsAppService = new WhatsAppService();
    }
    return this._whatsAppService;
  }
}

module.exports = AIController;
