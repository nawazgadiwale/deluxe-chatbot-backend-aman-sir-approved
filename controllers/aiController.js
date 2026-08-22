const AIServiceModule = require("../services/AIService");

const AIService = AIServiceModule.default || AIServiceModule;

const aiService = new AIService();

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
      // AI SERVICE
      // ---------------------------------------------------

      const result = await aiService.chat({
        sessionId: sessionId.trim(),
        site,
        message: message.trim(),
        visitor,
        action,
        attachments,
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
}

module.exports = AIController;
