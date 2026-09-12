import LLMService from "../../../ai/llm/LLMService.js";
import { SalesConversationPrompt } from "../prompts/SalesConversationPrompt.js";

export default class SalesConversationService {
  constructor() {
    this.llm = new LLMService();
  }

  async generate(context = {}, decision = {}) {
    const safeContext = this.sanitizeContext(context);
    const safeDecision = this.sanitizeDecision(decision);

    try {
      const hasLLMKey = Boolean(
        process.env.GOOGLE_API_KEY ||
        process.env.OPENAI_API_KEY ||
        process.env.GROQ_API_KEY ||
        process.env.OLLAMA_BASE_URL,
      );

      if (!hasLLMKey) {
        return this.generateDeterministic(safeContext, safeDecision);
      }

      const systemPrompt = SalesConversationPrompt({
        context: {
          channel: "WHATSAPP",

          catalog: safeContext.catalog,

          state: safeContext.state,

          workflow: safeContext.workflow,

          customer: safeContext.customer,

          order: safeContext.order,

          decision: safeDecision,

          rules: {
            catalogDriven: true,

            catalogIsSourceOfTruth: true,

            onlyUseProvidedCatalogData: true,

            neverInventProducts: true,
            neverInventSelections: true,
            neverInventOptions: true,
            neverInventPrices: true,
            neverInventFields: true,
            neverInventRequirements: true,
            neverInventAddons: true,
            neverInventWorkflow: true,

            neverCollectOrderFieldsConversationally: true,

            neverCollectCustomerDetailsConversationally:
              safeDecision.type !== "COLLECT_CUSTOMER",
          },
        },
      });

      const response = await this.llm.invokeStructured({
        systemPrompt,

        userMessage:
          safeContext.message || "Generate the next WhatsApp response.",

        schema: {
          type: "object",

          additionalProperties: false,

          properties: {
            message: {
              type: "string",
            },
          },

          required: ["message"],
        },
      });

      const message =
        typeof response?.message === "string" ? response.message.trim() : "";

      if (!message) {
        return this.generateDeterministic(safeContext, safeDecision);
      }

      return {
        message,

        interaction: this.getInteraction(safeDecision),

        actions: safeDecision.actions,

        sections: safeDecision.sections,
      };
    } catch (error) {
      console.warn(
        "[SalesConversationService] Fallback to deterministic:",
        error.message,
      );
      return this.generateDeterministic(safeContext, safeDecision);
    }
  }

  sanitizeContext(context = {}) {
    const safe = context || {};
    return {
      channel: "WHATSAPP",

      message: typeof safe.message === "string" ? safe.message : "",

      catalog:
        safe.catalog && typeof safe.catalog === "object" ? safe.catalog : {},

      state: safe.state && typeof safe.state === "object" ? safe.state : {},

      workflow:
        safe.workflow && typeof safe.workflow === "object" ? safe.workflow : {},

      customer: safe.customer ?? null,

      order: safe.order ?? null,
    };
  }

  sanitizeDecision(decision = {}) {
    const safe = decision || {};
    return {
      type: safe.type ?? null,

      nextStep: safe.nextStep ?? null,

      actions: this.sanitizeActions(safe.actions),

      sections: this.sanitizeSections(safe.sections),

      context:
        safe.context && typeof safe.context === "object" ? safe.context : {},
    };
  }

  sanitizeActions(actions = []) {
    if (!Array.isArray(actions)) {
      return [];
    }

    return actions
      .slice(0, 10)
      .map((action) => {
        if (!action || typeof action !== "object") {
          return null;
        }

        return {
          id: action.id ?? null,

          label: action.label ?? action.title ?? null,

          payload:
            action.payload && typeof action.payload === "object"
              ? action.payload
              : {},
        };
      })
      .filter((action) => action?.id && action?.label);
  }

  sanitizeSections(sections = []) {
    if (!Array.isArray(sections)) {
      return [];
    }

    return sections
      .slice(0, 10)
      .map((section) => {
        if (!section || typeof section !== "object") {
          return null;
        }

        return {
          id: section.id ?? null,

          title: section.title ?? null,

          type: section.type ?? null,

          description: section.description ?? null,

          rows: Array.isArray(section.rows)
            ? section.rows
              .slice(0, 10)
              .map((row) => ({
                id: row?.id ?? row?.payload?.id ?? null,

                title: row?.title ?? row?.label ?? null,

                description: row?.description ?? null,

                payload: row?.payload ?? {},
              }))
              .filter((row) => row.id && row.title)
            : [],

          form: section.form ?? null,
        };
      })
      .filter(Boolean);
  }

  getInteraction(decision = {}) {
    const safeDecision = decision || {};
    if (safeDecision.type === "COLLECT_CUSTOMER") {
      return "FORM";
    }

    const actions = Array.isArray(safeDecision.actions)
      ? safeDecision.actions
      : [];

    const sections = Array.isArray(safeDecision.sections)
      ? safeDecision.sections
      : [];

    if (actions.length > 0) {
      return actions.length <= 3 ? "BUTTONS" : "LIST";
    }

    if (sections.length > 0) {
      const hasForm = sections.some(
        (section) => section.type === "FORM" || section.form,
      );

      return hasForm ? "FORM" : "LIST";
    }

    return "MESSAGE";
  }

  generateDeterministic(context = {}, decision = {}) {
    return {
      message: this.buildDeterministicMessage(context, decision),

      interaction: this.getInteraction(decision),

      actions: decision?.actions ?? [],

      sections: decision?.sections ?? [],
    };
  }

  buildDeterministicMessage(context = {}, decision = {}) {
    const safeDecision = decision || {};
    const safeContext = context || {};
    const type = safeDecision.type;
    const productName =
      safeDecision.context?.product?.name ||
      safeContext.order?.items?.[0]?.product?.name ||
      "";

    switch (type) {
      case "START_ORDER":
        return "Welcome to Deluxe Printing! How can we assist with your order today?";

      case "SELECT_PRODUCT":
        return "Please choose a product from the available options:";

      case "BROWSE_PRODUCTS":
        return "Browse our catalog categories or select a product below:";

      case "UNKNOWN_PRODUCT":
        return "I couldn't find an exact match for that product. Please choose from our catalog or speak with an expert:";

      case "SELECT_SELECTION":
      case "SHOW_SELECTIONS":
      case "RECOMMEND_SELECTION":
        return productName
          ? `Please select the style/category for ${productName}:`
          : "Please choose from the available options:";

      case "SELECT_NESTED_PRODUCT":
        return productName
          ? `Please choose the specific option for ${productName}:`
          : "Please choose the option that best matches your requirement:";

      case "PRODUCT_DETAILS":
        return productName
          ? `Here are the details for ${productName}:`
          : "Here are the product details:";

      case "COLLECT_PRODUCT_FIELD":
        return (
          decision.context?.field?.question ??
          decision.context?.field?.label ??
          "Please provide the requested information."
        );

      case "COLLECT_REQUIREMENT":
        return (
          decision.context?.requirement?.instruction ??
          decision.context?.requirement?.description ??
          "Please provide the requested requirement."
        );

      case "SELECT_ADDONS":
        return (
          decision.context?.message ||
          decision.context?.addons?.label ||
          "Finishing Options"
        );

      case "SELECT_DELIVERY_METHOD":
        return "Please select your preferred delivery method:";

      case "ORDER_FORM":
      case "COLLECT_QUANTITY":
      case "COLLECT_ARTWORK":
      case "ASK_DELIVERY_ADDRESS":
      case "ASK_DELIVERY_DATE":
        return productName
          ? `Please provide the specifications for your ${productName} order:`
          : "Please provide your order specifications to continue:";

      case "ORDER_REVIEW":
      case "REVIEW_ORDER":
      case "COMPLETE_ORDER":
        return (
          decision.context?.message ||
          decision.context?.summary ||
          "Please review your order summary below:"
        );

      case "CONFIRM_ORDER":
        return "Great! To complete your order, please enter your full name.";

      case "CANCEL_ORDER":
        return "Your order has been cancelled. Please let us know if you need anything else.";

      case "COLLECT_CUSTOMER":
        return (
          decision.context?.message ||
          "Great! To complete your order, please enter your full name."
        );

      case "ORDER_COMPLETED":
        return (
          decision.context?.message ||
          "Thank you! Your order details have been submitted successfully. Our sales team will contact you regarding the quotation."
        );

      default:
        return "Please choose from the available options.";
    }
  }
}
