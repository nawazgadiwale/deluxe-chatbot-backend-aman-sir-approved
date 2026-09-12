import AIService from "../../../services/AIService.js";
import SalesCatalogService from "../../modules/sales/services/SalesCatalogService.js";

const salesCatalogService = new SalesCatalogService();
const aiService = new AIService();

export default class ChatController {
  // =====================================================
  // GET CLIENT IP
  // =====================================================

  getClientIp(req) {
    return (
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.socket?.remoteAddress ||
      req.ip ||
      null
    );
  }

  // =====================================================
  // POST CHAT
  // =====================================================

  chat = async (req, res, next) => {
    try {
      const {
        sessionId,
        visitorId,
        site = "exprintmart",
        message = "",
        visitor = {},
        action = null,
        attachments = [],
      } = req.body || {};

      const ipAddress = this.getClientIp(req);

      console.log("\n======================================");

      console.log("CHAT REQUEST");

      console.log("======================================");

      console.log("Session   :", sessionId);

      console.log("Visitor   :", visitorId);

      console.log("Site      :", site);

      console.log("Message   :", message);

      console.log("Action    :", action);

      console.log("IP        :", ipAddress);

      console.log("======================================");

      // =================================================
      // VALIDATION
      // =================================================

      if (!sessionId || !sessionId.trim()) {
        return res.status(400).json({
          success: false,
          message: "sessionId is required.",
        });
      }

      if (!visitorId || !visitorId.trim()) {
        return res.status(400).json({
          success: false,
          message: "visitorId is required.",
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

      // =================================================
      // AI SERVICE
      // =================================================

      const response = await aiService.chat({
        sessionId: sessionId.trim(),

        visitorId: visitorId.trim(),

        site,

        message: message.trim(),

        visitor,

        action,

        attachments,

        ipAddress,
      });

      return res.status(200).json(response);
    } catch (error) {
      console.error("========== CHAT ERROR ==========");

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

      if (!sessionId || !sessionId.trim()) {
        return res.status(400).json({
          success: false,
          message: "sessionId is required.",
        });
      }

      const conversation = await aiService.getConversation({
        sessionId: sessionId.trim(),
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

      if (!sessionId || !sessionId.trim()) {
        return res.status(400).json({
          success: false,
          message: "sessionId is required.",
        });
      }

      const conversation = await aiService.completeConversation({
        sessionId: sessionId.trim(),
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

  // GET SALES CATALOG
  getCatalog = async (req, res, next) => {
    try {
      const products = salesCatalogService.getProducts();

      return res.status(200).json({
        success: true,
        type: "sales-catalog",
        count: products.length,
        products,
      });
    } catch (error) {
      console.error("Sales Catalog Error");
      console.error(error);
      return next(error);
    }
  };

  //GET SALES CATALOG PRODUCT
  // =====================================================
  // GET SALES CATALOG PRODUCT
  // =====================================================

  getCatalogProduct = async (req, res, next) => {
    try {
      const { productId } = req.params;

      if (!productId || !String(productId).trim()) {
        return res.status(400).json({
          success: false,
          message: "productId is required.",
        });
      }

      const product = salesCatalogService.getProduct(productId);

      if (!product) {
        return res.status(404).json({
          success: false,
          message: "Product not found.",
        });
      }

      return res.status(200).json({
        success: true,
        type: "sales-catalog-product",
        product,
      });
    } catch (error) {
      console.error("========== SALES CATALOG PRODUCT ERROR ==========");
      console.error(error);

      return next(error);
    }
  };
}
