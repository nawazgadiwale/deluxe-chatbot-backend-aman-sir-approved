const express = require("express");
const AIControllerModule = require("../controllers/aiController");

const AIController = AIControllerModule.default || AIControllerModule;

const router = express.Router();

const aiController = new AIController();

// =====================================================
// POST /v1/api/ai/chat
// =====================================================

router.post("/chat", aiController.chat);

// =====================================================
// GET /v1/api/ai/conversation/:sessionId
// =====================================================

router.get("/conversation/:sessionId", aiController.getConversation);

// =====================================================
// POST /v1/api/ai/conversation/:sessionId/complete
// =====================================================

router.post(
  "/conversation/:sessionId/complete",
  aiController.completeConversation,
);

module.exports = router;
