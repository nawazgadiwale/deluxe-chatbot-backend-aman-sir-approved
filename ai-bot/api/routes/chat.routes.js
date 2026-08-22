import { Router } from "express";

import ChatController from "../controllers/ChatController.js";
import validateRequest from "../validators/validateRequest.js";
import { ChatSchema } from "../validators/ChatValidator.js";

const router = Router();

const chatController = new ChatController();

/**
 * POST /api/chat
 */
router.post("/", validateRequest(ChatSchema), chatController.chat);

/**
 * GET /api/chat/:sessionId
 */
router.get("/:sessionId", chatController.getConversation);

/**
 * PATCH /api/chat/:sessionId/complete
 */
router.patch("/:sessionId/complete", chatController.completeConversation);

export default router;
