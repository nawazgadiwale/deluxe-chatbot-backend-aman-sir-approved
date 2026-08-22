import LLMService from "../../../ai/llm/LLMService.js";
import { SalesConversationPrompt } from "../prompts/SalesConversationPrompt.js";

import DecisionTypes from "../helpers/DecisionTypes.js";

export default class SalesConversationService {
  constructor() {
    this.llm = new LLMService();
  }

  /*
   * =====================================================
   * LLM Conversation
   * =====================================================
   */

  async generate(context = {}, decision = {}) {
    try {
      /*
       * =====================================================
       * Prompt Context
       * =====================================================
       */

      const promptContext = {
        ...context,
        decision,
      };

      const systemPrompt = SalesConversationPrompt({
        context: promptContext,
      });
      console.log("Conversation Context");
      console.dir(context, { depth: null });

      console.log("Decision");
      console.dir(decision, { depth: null });
      const response = await this.llm.invokeStructured({
        systemPrompt,

        userMessage:
          "Generate the next response as Deluxe Printing's AI Sales Consultant.",

        schema: {
          type: "object",

          properties: {
            message: {
              type: "string",
            },
          },

          required: ["message"],
        },
      });

      return {
        message: response?.message?.trim() ?? "",

        interaction: decision.actions?.length > 0 ? "BUTTONS" : "MESSAGE",

        actions: decision.actions ?? [],

        sections: decision.sections ?? [],
      };
    } catch (error) {
      console.error("SalesConversationService:", error);

      return this.generateDeterministic(context, decision);
    }
  }

  /*
   * =====================================================
   * Deterministic Conversation
   * =====================================================
   */

  generateDeterministic(context = {}, decision = {}) {
    let message =
      "Hello! 👋 Welcome to Deluxe Printing. What would you like to print today?";

    switch (decision.type) {
      /*
       * ===============================================
       * Product
       * ===============================================
       */

      case DecisionTypes.SELECT_PRODUCT:
        message =
          "I'd be happy to help. Which printing product are you looking for today?";
        break;

      /*
       * ===============================================
       * Recommend Selection
       * ===============================================
       */

      case DecisionTypes.RECOMMEND_SELECTION: {
        const recommendation = context.recommendation;

        if (!recommendation) {
          message =
            "Based on your requirements, I have a recommendation for you.";
          break;
        }

        message = `Based on your requirements, I recommend "${recommendation.name}". Would you like to continue with this option?`;

        break;
      }

      /*
       * ===============================================
       * Select Selection
       * ===============================================
       */

      case DecisionTypes.SELECT_SELECTION: {
        const options = context.options ?? [];

        if (!options.length) {
          message = "Let's continue with your selected product.";
          break;
        }

        if (options.length === 1) {
          message = `The available option is "${options[0].name}". Would you like to continue?`;
          break;
        }

        const label = context.selection?.label ?? "option";

        message = `Please choose a ${label.toLowerCase()}.`;

        break;
      }

      /*
       * ===============================================
       * Product Field
       * ===============================================
       */

      case DecisionTypes.COLLECT_PRODUCT_FIELD: {
        const field = context.field;

        message =
          field?.question ??
          `Please provide ${field?.label ?? "the required information"}.`;

        break;
      }

      /*
       * ===============================================
       * Requirement
       * ===============================================
       */

      case DecisionTypes.COLLECT_REQUIREMENT: {
        const requirement = context.requirement;

        message =
          requirement?.description ??
          `Please provide ${requirement?.name ?? "the required information"}.`;

        break;
      }

      /*
       * ===============================================
       * Quantity
       * ===============================================
       */

      case DecisionTypes.COLLECT_QUANTITY: {
        const product =
          context.selection?.name ?? context.product?.name ?? "this product";

        message = `How many units of ${product} would you like to order?`;

        break;
      }

      /*
       * ===============================================
       * Artwork
       * ===============================================
       */

      case DecisionTypes.COLLECT_ARTWORK: {
        const product = context.product?.name ?? "your product";

        message = `Do you already have artwork for your ${product}, or would you like our design team to create it for you?`;

        break;
      }

      /*
       * ===============================================
       * Delivery Method
       * ===============================================
       */

      case DecisionTypes.SELECT_DELIVERY_METHOD:
        message =
          "Would you like your order to be delivered, or would you prefer to collect it from our store?";
        break;

      /*
       * ===============================================
       * Delivery Address
       * ===============================================
       */

      case DecisionTypes.ASK_DELIVERY_ADDRESS:
        message = "Please share your complete delivery address.";
        break;

      /*
       * ===============================================
       * Delivery Date
       * ===============================================
       */

      case DecisionTypes.ASK_DELIVERY_DATE:
        message = "When do you need your order?";
        break;

      /*
       * ===============================================
       * Addons
       * ===============================================
       */

      case DecisionTypes.SELECT_ADDONS:
        message = "Would you like to add any addons, finishing options??";
        break;

      /*
       * ===============================================
       * Review
       * ===============================================
       */

      case DecisionTypes.REVIEW_ORDER: {
        const product =
          context.order?.items?.[0]?.product?.name ??
          context.order?.items?.[0]?.product ??
          "order";

        message = `Please review your ${product} before we continue.`;

        break;
      }

      /*
       * ===============================================
       * Complete
       * ===============================================
       */

      case DecisionTypes.COMPLETE_ORDER:
        message =
          "Everything looks good. Once you confirm, our sales team will prepare your quotation and contact you shortly.";
        break;

      /*
       * ===============================================
       * Completed
       * ===============================================
       */

      case DecisionTypes.ORDER_COMPLETED:
        message =
          "Thank you for choosing Deluxe Printing. We've received your request successfully. Our sales team will contact you shortly with your quotation.";
        break;
    }

    return {
      message,

      interaction: decision.actions?.length ? "BUTTONS" : "MESSAGE",

      actions: decision.actions ?? [],

      sections: decision.sections ?? [],
    };
  }
}
