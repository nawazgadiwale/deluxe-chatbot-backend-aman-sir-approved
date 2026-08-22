import ChatApplication from "../../application/ChatApplication.js";

const chatApplication = new ChatApplication();

export default class ChatController {
  /*
   * =====================================================
   * POST /api/chat
   * =====================================================
   */

  chat = async (req, res, next) => {
    try {
      console.log("\n======================================");
      console.log("CHAT REQUEST");
      console.log("======================================");
      console.log("Session :", req.body.sessionId);
      console.log("Message :", req.body.message);
      console.log("Action  :", req.body.action);
      console.log("======================================");

      const response = await chatApplication.process(req.body);

      return res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  /*
   * =====================================================
   * GET Conversation
   * =====================================================
   */

  getConversation = async (req, res, next) => {
    try {
      const { sessionId } = req.params;

      const conversation = await chatApplication.getConversation(sessionId);

      // console.log("Session ID:", sessionId);
      // console.log("Conversation loaded:", conversation);

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
      next(error);
    }
  };

  /*
   * =====================================================
   * Complete Conversation
   * =====================================================
   */

  completeConversation = async (req, res, next) => {
    try {
      const { sessionId } = req.params;

      await chatApplication.completeConversation(sessionId);

      return res.status(200).json({
        success: true,
        message: "Conversation completed successfully.",
      });
    } catch (error) {
      next(error);
    }
  };
}
