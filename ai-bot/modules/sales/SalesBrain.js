import SalesExtractor from "./extractors/SalesExtractor.js";

import ReviewBuilder from "./builders/ReviewBuilder.js";
import SalesResponseBuilder from "./builders/SalesResponseBuilder.js";
import SalesConversationService from "./services/SalesConversationService.js";

import ConversationDecisionService from "./services/ConversationDecisionService.js";
import DeliveryService from "./services/DeliveryService.js";
import OrderManager from "./services/OrderManager.js";
import PricingService from "./services/PricingService.js";
import SalesCatalogService from "./services/SalesCatalogService.js";

import DecisionTypes from "./helpers/DecisionTypes.js";
import ConversationContextBuilder from "./services/ConversationcontextBuilder.js";

const conversationService = new SalesConversationService();

const contextBuilder = new ConversationContextBuilder();

const extractor = new SalesExtractor();

const catalogService = new SalesCatalogService();

const orderManager = new OrderManager();

const conversationDecisionService = new ConversationDecisionService();

const pricingService = new PricingService();

const deliveryService = new DeliveryService();

const reviewBuilder = new ReviewBuilder();

const responseBuilder = new SalesResponseBuilder();

export default class SalesBrain {
  async execute(state = {}) {
    let requirement = orderManager.createRequirement(
      state.liveRequirement ?? null,
    );

    this.userMessage = state.userMessage ?? "";

    try {
      // console.log("===== INCOMING STATE =====");
      // console.dir(state, { depth: null });

      // console.log("LIVE REQUIREMENT");
      // console.dir(state.liveRequirement, { depth: null });

      /*
       * =====================================================
       * Apply Customer Input
       * =====================================================
       */

      if (state.action?.id) {
        console.log("\n>>> APPLY ACTION");

        requirement = this.applyAction(requirement, state.action);

        // console.log("===== AFTER APPLY ACTION =====");

        // console.dir(orderManager.getCurrentItem(requirement), {
        //   depth: null,
        // });

        // console.dir(orderManager.getCurrentItem(requirement)?.selection, {
        //   depth: null,
        // });

        // console.log("\nWorkflow After Action:");
        // console.dir(orderManager.getCurrentItem(requirement)?.workflow, {
        //   depth: null,
        // });
      } else {
        // console.log("\n>>> EXTRACT INPUT");

        // console.log("STEP 1 - Before Extract");

        const extracted = extractor.extract(
          requirement,
          this.userMessage,
          state.currentStep,
        );

        // console.log("STEP 2 - Extract Complete");
        // console.dir(extracted, { depth: null });

        // console.log("\nExtracted:");
        // console.dir(extracted, { depth: null });

        requirement = this.applyExtraction(requirement, extracted);

        // console.log("STEP 3 - applyExtraction Complete");
        // console.dir(requirement, { depth: null });
      }

      /*
       * =====================================================
       * Requirement Snapshot
       * =====================================================
       */

      // console.log("\nCurrent Item:");
      // console.dir(orderManager.getCurrentItem(requirement), {
      //   depth: null,
      // });

      // console.log("\nLive Requirement:");
      // console.dir(requirement, {
      //   depth: null,
      // });

      /*
       * =====================================================
       * Decide Next Step
       * =====================================================
       */

      const decision = conversationDecisionService.decide(requirement);

      console.log("DECISION");
      console.dir(decision, { depth: null });

      // console.log("STEP 5 - Decision");
      // console.dir(decision, { depth: null });
      /*
       * =====================================================
       * Generate Response
       * =====================================================
       */

      // console.log("\n>>> HANDLE DECISION");

      const response = await this.handleDecision(requirement, decision);

      // console.log("STEP 7 - handleDecision Complete");

      // console.log("\nFinal Response:");
      // console.dir(response, {
      //   depth: null,
      // });

      // console.log("\n=================================================\n");

      const workflow = response.workflow ?? "SALES";

      return {
        ...response,

        liveRequirement: requirement,

        workflow,

        completed: response.completed ?? false,

        currentStep: decision.type,

        nextStep: decision.nextStep,
      };
    } catch (error) {
      console.error("\n========================================");
      console.error("SALES BRAIN ERROR");
      console.error("========================================");

      console.error("Message:");
      console.error(error.message);

      console.error("\nStack:");
      console.error(error.stack);

      console.error("\nRequirement At Crash:");
      console.dir(requirement, { depth: null });

      console.error("\nIncoming Action:");
      console.dir(state.action, { depth: null });

      console.error("\nIncoming Message:");
      console.log(this.userMessage);

      console.error("========================================\n");

      return responseBuilder.build({
        workflow: "SALES",
        completed: false,
        liveRequirement: requirement,
        message:
          "I apologize, but I encountered a temporary issue while processing your request. Your order information has been saved, so we can continue from where we left off.",
        metadata: {
          error: true,
        },
      });
    }
  }

  /*
   * =====================================================
   * Apply UI Actions
   * =====================================================
   */

  applyAction(requirement = {}, action = {}) {
    if (!action?.id) {
      return requirement;
    }

    /*
     * =====================================================
     * Edit Menu Selection
     * =====================================================
     * User clicked a field from the Edit Order menu.
     * Don't update anything yet.
     * Just remember which step they want to edit.
     */

    console.log("=================================");
    console.log("APPLY ACTION");
    console.log(action);

    if (action.payload?.edit) {
      console.log("EDIT ACTION");

      requirement.editing = {
        active: true,
        step: action.id,
      };

      console.log(requirement.editing);

      return requirement;
    }

    switch (action.id) {
      /*
       *Start Order from product details or discovery
       */
      case DecisionTypes.START_ORDER:
        return this.applyStartOrderAction(requirement, action);
      /*
       * =====================================================
       * Product
       * =====================================================
       */

      case DecisionTypes.SELECT_PRODUCT:
        return this.applyProductAction(requirement, action);

      /*
       * =====================================================
       * Selection
       * =====================================================
       */

      case DecisionTypes.SELECT_SELECTION:
        return this.applySelectionAction(requirement, action);

      case DecisionTypes.SHOW_SELECTIONS:
        requirement.showAllSelections = true;
        return requirement;

      /*
       * =====================================================
       * Product Field
       * =====================================================
       */

      case DecisionTypes.COLLECT_PRODUCT_FIELD:
        return this.applyFieldAction(requirement, action);

      /*
       * =====================================================
       * Requirement
       * =====================================================
       */

      case DecisionTypes.COLLECT_REQUIREMENT:
        return this.applyRequirementAction(requirement, action);

      /*
       * =====================================================
       * Addons
       * =====================================================
       */

      case DecisionTypes.SELECT_ADDONS:
        return this.applyAddonAction(requirement, action);

      case DecisionTypes.SKIP_ADDONS:
        return this.skipAddonAction(requirement, action);

      /*
       * =====================================================
       * Quantity
       * =====================================================
       */

      case DecisionTypes.COLLECT_QUANTITY:
        return this.applyQuantityAction(requirement, action);

      /*
       * =====================================================
       * Artwork
       * =====================================================
       */

      case DecisionTypes.COLLECT_ARTWORK:
        return this.applyArtworkAction(requirement, action);

      /*
       * =====================================================
       * Delivery
       * =====================================================
       */

      case DecisionTypes.SELECT_DELIVERY_METHOD:
      case DecisionTypes.ASK_DELIVERY_ADDRESS:
      case DecisionTypes.ASK_DELIVERY_DATE:
        return this.applyDeliveryAction(requirement, action);

      /*
       * =====================================================
       * Review
       * =====================================================
       */

      case DecisionTypes.REVIEW_ORDER:
        return orderManager.markReviewed(requirement);

      /*
       * =====================================================
       * Edit Order
       * =====================================================
       * User clicked "Edit Order" from Review.
       * Open the edit menu.
       */

      case DecisionTypes.EDIT_ORDER:
        requirement.editing = {
          active: true,
          step: null,
        };

        return requirement;

      /*
       * =====================================================
       * Confirmation
       * =====================================================
       */

      case DecisionTypes.CONFIRM_ORDER:
        return orderManager.confirm(requirement);

      case DecisionTypes.CANCEL_ORDER:
        return orderManager.unconfirm(requirement);

      default:
        return requirement;
    }
  }

  applyStartOrderAction(requirement = {}, action = {}) {
    const productId = action.payload?.productId;

    if (!productId) {
      return requirement;
    }

    return orderManager.addItem(requirement, {
      id: productId,
    });
  }

  applyProductAction(requirement = {}, action = {}) {
    const productId = action.payload?.productId;

    if (!productId) {
      return requirement;
    }

    /*
     * First Product
     */

    if (!orderManager.getCurrentItem(requirement)) {
      return orderManager.addItem(requirement, {
        id: productId,
      });
    }

    /*
     * Change Existing Product
     */

    const product = catalogService.getProduct(productId);

    return orderManager.updateCurrentItem(requirement, {
      product,

      selection: {
        id: null,
        name: null,
      },

      productData: {},

      requirements: [],

      addons: {
        completed: false,
        items: [],
        notes: null,
      },

      workflow: {
        quantity: null,

        artwork: {
          status: null,
          reference: null,
        },
      },
    });
  }

  applySelectionAction(requirement = {}, action = {}) {
    const currentItem = orderManager.getCurrentItem(requirement);

    if (!currentItem?.product?.id) {
      return requirement;
    }

    const selectionId = action.payload?.selectionId;

    if (!selectionId) {
      return requirement;
    }

    const product = catalogService.getProduct(currentItem.product.id);

    const selection = catalogService.getSelectionOption(product, selectionId);

    if (!selection) {
      return requirement;
    }

    const updated = orderManager.updateCurrentItem(requirement, {
      selection,
    });

    return this.exitEditMode(updated);
  }

  applyFieldAction(requirement = {}, action = {}) {
    const { fieldId, value } = action.payload ?? {};

    if (!fieldId || value === undefined) {
      return requirement;
    }

    const currentItem = orderManager.getCurrentItem(requirement);

    const updated = orderManager.updateCurrentItem(requirement, {
      productData: {
        ...(currentItem?.productData ?? {}),
        [fieldId]: value,
      },
    });

    return this.exitEditMode(updated);
  }

  applyRequirementAction(requirement = {}, action = {}) {
    const { requirementId, value } = action.payload ?? {};

    if (!requirementId || value === undefined) {
      return requirement;
    }

    const currentItem = orderManager.getCurrentItem(requirement);

    const requirements = [...(currentItem?.requirements ?? [])];

    const index = requirements.findIndex((item) => item.id === requirementId);

    const requirementValue = {
      id: requirementId,
      value,
      status: "RECEIVED",
    };

    if (index >= 0) {
      requirements[index] = {
        ...requirements[index],
        ...requirementValue,
      };
    } else {
      requirements.push(requirementValue);
    }

    const updated = orderManager.updateCurrentItem(requirement, {
      requirements,
    });

    return this.exitEditMode(updated);
  }

  applyAddonAction(requirement = {}, action = {}) {
    const addonId = action.payload?.addonId;

    if (!addonId) {
      return requirement;
    }

    const currentItem = orderManager.getCurrentItem(requirement);

    if (!currentItem) {
      return requirement;
    }

    const product = catalogService.getProduct(currentItem.product.id);

    if (!product) {
      return requirement;
    }

    const addon = catalogService.getAddon(product, addonId);

    if (!addon) {
      return requirement;
    }

    const addons = [...(currentItem.addons.items ?? [])];

    if (!addons.some((item) => item.id === addon.id)) {
      addons.push(addon);
    }

    const updated = orderManager.updateCurrentItem(requirement, {
      addons: {
        ...currentItem.addons,
        completed: true,
        items: addons,
      },
    });

    return this.exitEditMode(updated);
  }

  skipAddonAction(requirement = {}) {
    const currentItem = orderManager.getCurrentItem(requirement);

    if (!currentItem) {
      return requirement;
    }

    const updated = orderManager.updateCurrentItem(requirement, {
      addons: {
        ...currentItem.addons,
        completed: true,
        items: [],
        skipped: true,
      },
    });

    return this.exitEditMode(updated);
  }

  applyQuantityAction(requirement = {}, action = {}) {
    const quantity = action.payload?.quantity;

    if (quantity == null) {
      return requirement;
    }

    const updated = orderManager.updateWorkflow(requirement, {
      quantity,
    });

    return this.exitEditMode(updated);
  }

  applyArtworkAction(requirement = {}, action = {}) {
    const artwork = action.payload;

    if (!artwork?.status) {
      return requirement;
    }

    const updated = orderManager.updateWorkflow(requirement, {
      artwork: {
        status: artwork.status,
        reference: artwork.reference ?? null,
      },
    });

    return this.exitEditMode(updated);
  }

  applyDeliveryAction(requirement = {}, action = {}) {
    const value = action.payload?.value;

    if (!value) {
      return requirement;
    }

    let updated;

    switch (action.id) {
      case DecisionTypes.SELECT_DELIVERY_METHOD:
        updated = orderManager.updateDelivery(requirement, {
          method: value,
        });
        break;

      case DecisionTypes.ASK_DELIVERY_ADDRESS:
        updated = orderManager.updateDelivery(requirement, {
          address: value,
        });
        break;

      case DecisionTypes.ASK_DELIVERY_DATE:
        updated = orderManager.updateDelivery(requirement, {
          requiredDate: value,
        });
        break;

      default:
        return requirement;
    }

    return this.exitEditMode(updated);
  }

  /*
   * =====================================================
   * Apply Extraction
   * =====================================================
   */

  applyExtraction(requirement = {}, extracted = {}) {
    if (!extracted) {
      return requirement;
    }

    /*
     * =====================================================
     * Customer
     * =====================================================
     */

    if (extracted.customer) {
      requirement.customer = {
        ...(requirement.customer ?? {}),
        ...(extracted.customer ?? {}),
      };
    }

    /*
     * =====================================================
     * Create First Item
     * =====================================================
     */

    if (!orderManager.getCurrentItem(requirement) && extracted.product) {
      requirement = orderManager.addItem(requirement, extracted.product);
    }

    const currentItem = orderManager.getCurrentItem(requirement);

    if (!currentItem) {
      return requirement;
    }

    // EVERYTHING BELOW THIS REMAINS EXACTLY AS IT IS

    let updates = {};

    /*
     * =====================================================
     * Merge Item Data
     * =====================================================
     */

    updates = this.mergeProduct(updates, extracted);

    updates = this.mergeSelection(updates, extracted);

    updates = this.mergeProductData(updates, currentItem, extracted);

    updates = this.mergeAddons(updates, currentItem, extracted);

    updates = this.mergeRequirements(updates, currentItem, extracted);

    updates = this.mergeWorkflow(updates, currentItem, extracted);

    /*
     * =====================================================
     * Persist Item
     * =====================================================
     */

    if (Object.keys(updates).length) {
      requirement = orderManager.updateCurrentItem(requirement, updates);
    }

    /*
     * =====================================================
     * Delivery
     * =====================================================
     */

    requirement = this.mergeDelivery(requirement, extracted);

    /*
     * =====================================================
     * Conversation Flags
     * =====================================================
     */

    requirement = this.mergeConversationFlags(requirement, extracted);

    return requirement;
  }

  mergeProduct(updates = {}, extracted = {}) {
    if (extracted.product != null) {
      updates.product = extracted.product;
    }

    return updates;
  }

  mergeSelection(updates = {}, extracted = {}) {
    if (extracted.selection != null) {
      updates.selection = extracted.selection;
    }

    return updates;
  }

  mergeProductData(updates = {}, currentItem = {}, extracted = {}) {
    if (extracted.productData != null) {
      updates.productData = {
        ...(currentItem.productData ?? {}),
        ...extracted.productData,
      };
    }

    return updates;
  }

  mergeAddons(updates = {}, currentItem = {}, extracted = {}) {
    if (!Array.isArray(extracted.addons)) {
      return updates;
    }

    const merged = [...(currentItem.addons.items ?? [])];

    for (const addon of extracted.addons) {
      if (!merged.some((item) => item.id === addon.id)) {
        merged.push(addon);
      }
    }

    updates.addons = {
      ...(currentItem.addons ?? {}),
      completed: true,
      items: merged,
    };

    return updates;
  }

  mergeRequirements(updates = {}, currentItem = {}, extracted = {}) {
    if (
      !Array.isArray(extracted.requirements) ||
      !extracted.requirements.length
    ) {
      return updates;
    }

    const requirements = [...(currentItem.requirements ?? [])];

    for (const extractedRequirement of extracted.requirements) {
      const index = requirements.findIndex(
        (requirement) => requirement.id === extractedRequirement.id,
      );

      if (index >= 0) {
        requirements[index] = {
          ...requirements[index],
          ...extractedRequirement,
        };
      } else {
        requirements.push(extractedRequirement);
      }
    }

    updates.requirements = requirements;

    return updates;
  }

  mergeWorkflow(updates = {}, currentItem = {}, extracted = {}) {
    let workflow = {
      ...(updates.workflow ?? currentItem.workflow ?? {}),
    };

    let changed = false;

    /*
     * =====================================================
     * Quantity
     * =====================================================
     */

    if (extracted.quantity != null) {
      workflow.quantity = extracted.quantity;
      changed = true;
    }

    /*
     * =====================================================
     * Artwork
     * =====================================================
     */

    if (extracted.artwork != null) {
      workflow.artwork = {
        ...(currentItem.workflow?.artwork ?? {}),
        ...extracted.artwork,
      };

      changed = true;
    }

    if (changed) {
      updates.workflow = workflow;
    }

    /*
     * =====================================================
     * Future Fields
     * =====================================================
     */

    if (extracted.businessPurpose != null) {
      updates.businessPurpose = extracted.businessPurpose;
    }

    if (extracted.budget != null) {
      updates.budget = extracted.budget;
    }

    if (extracted.urgency != null) {
      updates.urgency = extracted.urgency;
    }

    return updates;
  }

  mergeDelivery(requirement = {}, extracted = {}) {
    const delivery = {};

    if (extracted.deliveryMethod != null) {
      delivery.method = extracted.deliveryMethod;
    }

    if (extracted.address != null) {
      delivery.address = extracted.address;
    }

    if (extracted.requiredDate != null) {
      delivery.requiredDate = extracted.requiredDate;
    }

    if (!Object.keys(delivery).length) {
      return requirement;
    }

    return orderManager.updateDelivery(requirement, delivery);
  }

  mergeConversationFlags(requirement = {}, extracted = {}) {
    /*
     * =====================================================
     * Review
     * =====================================================
     */

    if (extracted.reviewCompleted) {
      requirement = orderManager.markReviewed(requirement);
    }

    /*
     * =====================================================
     * Confirmation
     * =====================================================
     */

    if (extracted.confirmed === true) {
      requirement = orderManager.confirm(requirement);
    }

    /*
     * =====================================================
     * Add Another Product
     * =====================================================
     */

    if (extracted.addAnotherProduct === true) {
      requirement = orderManager.addEmptyItem(requirement);
    }

    return requirement;
  }

  /*
   * =====================================================
   * Conversation Decisions
   * =====================================================
   */

  isConversationDecision(type) {
    switch (type) {
      case DecisionTypes.SELECT_PRODUCT:

      case DecisionTypes.RECOMMEND_SELECTION:

      case DecisionTypes.SELECT_SELECTION:

      case DecisionTypes.COLLECT_PRODUCT_FIELD:

      case DecisionTypes.COLLECT_REQUIREMENT:

      case DecisionTypes.COLLECT_QUANTITY:

      case DecisionTypes.COLLECT_ARTWORK:

      case DecisionTypes.SELECT_DELIVERY_METHOD:

      case DecisionTypes.ASK_DELIVERY_ADDRESS:

      case DecisionTypes.ASK_DELIVERY_DATE:

      case DecisionTypes.SELECT_ADDONS:

      case DecisionTypes.EDIT_ORDER:
        return true;

      case DecisionTypes.COLLECT_CUSTOMER:
        return true;

      case DecisionTypes.COMPLETE_ORDER:
        return true;

      default:
        return false;
    }
  }

  /*
   * =====================================================
   * Decision Handler
   * =====================================================
   */

  async handleDecision(requirement = {}, decision = {}) {
    if (this.isConversationDecision(decision.type)) {
      return this.buildConversationResponse(requirement, decision);
    }

    switch (decision.type) {
      /*
       * =====================================================
       * Review & Edit
       * =====================================================
       */

      case DecisionTypes.REVIEW_ORDER:
        return this.buildReviewResponse(requirement, decision);

      case DecisionTypes.EDIT_ORDER:
        return this.buildConversationResponse(requirement, decision);

      /*
       * =====================================================
       * Order Completed
       * =====================================================
       */

      case DecisionTypes.ORDER_COMPLETED:
        return responseBuilder.build({
          workflow: "LEAD",

          completed: true,

          liveRequirement: requirement,

          metadata: {
            leadType: "ORDER_REQUEST",
          },
        });

      default:
        return responseBuilder.error(`Unknown decision type: ${decision.type}`);
    }
  }

  /*
   * =====================================================
   * Review Response
   * =====================================================
   */

  async buildReviewResponse(requirement = {}, decision = {}) {
    /*
     * =====================================================
     * Calculate Pricing
     * =====================================================
     */

    const pricing = pricingService.calculate(requirement);

    /*
     * =====================================================
     * Calculate Delivery
     * =====================================================
     */

    const delivery = deliveryService.calculate(requirement);

    /*
     * =====================================================
     * Persist Calculated Items
     * =====================================================
     */

    requirement.items = pricing.items ?? requirement.items;

    /*
     * =====================================================
     * Persist Order-Level Pricing
     * =====================================================
     */

    requirement = orderManager.updatePricing(requirement, {
      currency: pricing.currency,
      subtotal: pricing.subtotal,
      delivery: pricing.deliveryCharge,
      tax: 0,
      total: pricing.total,
    });

    /*
     * =====================================================
     * Persist Delivery
     * =====================================================
     */

    requirement = orderManager.updateDelivery(requirement, delivery);

    /*
     * =====================================================
     * Build Review
     * =====================================================
     */

    const review = reviewBuilder.build(requirement, pricing, delivery);

    /*
     * =====================================================
     * Mark Review Completed
     * =====================================================
     *
     * The customer has now been shown the complete
     * order review.
     *
     * IMPORTANT:
     * This does NOT confirm the order.
     *
     * It only allows the next decision cycle to move
     * from REVIEW_ORDER → COMPLETE_ORDER.
     */

    requirement.reviewCompleted = true;

    /*
     * =====================================================
     * Return Review
     * =====================================================
     */

    return this.buildResponse(
      {
        message:
          "Please review your order below. If everything looks correct, click Confirm Order to continue.",

        interaction: "BUTTONS",

        actions: [
          {
            id: DecisionTypes.CONFIRM_ORDER,
            label: "Confirm Order",
          },
          {
            id: DecisionTypes.EDIT_ORDER,
            label: "Edit Order",
          },
        ],

        sections: review.sections,
      },

      requirement,
    );
  }

  /*
   * =====================================================
   * API Response
   * =====================================================
   */

  buildResponse(
    advisorResponse = {},
    liveRequirement = {},
    { completed = false, workflow = "SALES", metadata = {} } = {},
  ) {
    const fallback = this.conversationFallback();

    const response = {
      ...fallback,
      ...advisorResponse,
    };

    return responseBuilder.build({
      workflow,

      completed,

      liveRequirement,

      metadata,

      message: response.message,

      interaction: response.interaction === "BUTTONS" ? "BUTTONS" : "MESSAGE",

      actions: Array.isArray(response.actions) ? response.actions : [],

      sections: Array.isArray(response.sections) ? response.sections : [],

      // =====================================================
      // IMPORTANT
      // Preserve conversation decision context
      // =====================================================
      context: response.context ?? null,
    });
  }

  /*
   * =====================================================
   * LLM Decision
   * =====================================================
   */

  shouldUseLLM(type) {
    switch (type) {
      /*
       * AI Sales Conversation
       */

      case DecisionTypes.SELECT_PRODUCT:

      case DecisionTypes.RECOMMEND_SELECTION:

      case DecisionTypes.SELECT_SELECTION:
        return true;

      /*
       * Workflow
       */

      case DecisionTypes.COLLECT_PRODUCT_FIELD:

      case DecisionTypes.COLLECT_REQUIREMENT:

      case DecisionTypes.COLLECT_QUANTITY:

      case DecisionTypes.COLLECT_ARTWORK:

      case DecisionTypes.SELECT_DELIVERY_METHOD:

      case DecisionTypes.ASK_DELIVERY_ADDRESS:

      case DecisionTypes.ASK_DELIVERY_DATE:

      case DecisionTypes.REVIEW_ORDER:

      case DecisionTypes.COMPLETE_ORDER:

      case DecisionTypes.ORDER_COMPLETED:

      case DecisionTypes.COLLECT_CUSTOMER:

      default:
        return false;
    }
  }

  /*
   * =====================================================
   * Normalize Conversation Response
   * =====================================================
   */

  normalizeConversationResponse(response = {}) {
    return {
      message: response.message?.trim() ?? "",

      interaction: response.interaction === "BUTTONS" ? "BUTTONS" : "MESSAGE",

      actions: Array.isArray(response.actions) ? response.actions : [],

      sections: Array.isArray(response.sections) ? response.sections : [],

      // =====================================================
      // Conversation Context
      // =====================================================
      context: response.context ?? null,
    };
  }

  /*
   * =====================================================
   * Generate Conversation
   * =====================================================
   */

  async generateConversation(requirement = {}, decision = {}, extra = {}) {
    /*
     * =====================================================
     * Build Context
     * =====================================================
     */

    const context = contextBuilder.build(
      requirement,
      decision,
      this.userMessage,
    );

    /*
     * =====================================================
     * Generate Response
     * =====================================================
     */

    let response;

    try {
      if (this.shouldUseLLM(decision.type)) {
        response = await conversationService.generate(context, decision);
      } else {
        response = conversationService.generateDeterministic(context, decision);
      }
    } catch (error) {
      console.error("Conversation Generation Failed:", error);

      response = conversationService.generateDeterministic(context, decision);
    }

    /*
     * =====================================================
     * Safety
     * =====================================================
     */

    if (!response) {
      return this.conversationFallback();
    }

    return this.normalizeConversationResponse(response);
  }

  /*
   * =====================================================
   * Conversation Response
   * =====================================================
   */

  async buildConversationResponse(
    requirement = {},
    decision = {},
    { completed = false, workflow = "SALES", metadata = {}, ...extra } = {},
  ) {
    const response = await this.generateConversation(
      requirement,
      decision,
      extra,
    );

    const currentItem = orderManager.getCurrentItem(requirement);

    let product = null;
    let selection = null;
    let recommendation = null;
    let addons = null;
    let options = [];

    if (currentItem?.product?.id) {
      product = catalogService.getProduct(currentItem.product.id);

      if (product) {
        if (currentItem.selection?.id) {
          selection = catalogService.getSelectionOption(
            product,
            currentItem.selection.id,
          );
        }

        recommendation = catalogService.getRecommendedSelection(product);

        addons = catalogService.getAddons(product);

        options = catalogService.getSelectionOptions(product);
      }
    }

    const relatedProducts = product
      ? catalogService.getRelatedProducts(product)
      : [];

    const frequentlyBoughtTogether = product
      ? catalogService.getFrequentlyBoughtTogether(product)
      : [];

    const similarProducts = product
      ? catalogService.getSimilarProducts(product)
      : [];

    /*
     * =====================================================
     * Preserve Decision Context
     * =====================================================
     *
     * IMPORTANT:
     * decision.context contains information such as:
     *
     * COLLECT_CUSTOMER
     * {
     *   action: "COLLECT_CUSTOMER",
     *   field: {
     *     id: "name",
     *     label: "Name",
     *     question: "What's your name?",
     *     required: true
     *   }
     * }
     *
     * Do not lose this before sending the response
     * to the frontend.
     */

    const responseWithContext = {
      ...response,

      context: decision.context ?? null,
    };

    return this.buildResponse(responseWithContext, requirement, {
      completed,
      workflow,

      metadata: {
        ...metadata,

        // =====================================================
        // Conversation stage
        // =====================================================
        stage: decision.type,

        // =====================================================
        // Product data
        // =====================================================
        product,
        recommendation,
        selection,

        // =====================================================
        // Current workflow
        // =====================================================
        field: decision.context?.field ?? null,
        requirement: decision.context?.requirement ?? null,

        // =====================================================
        // Catalog
        // =====================================================
        addons,
        options,

        // =====================================================
        // Order
        // =====================================================
        order: requirement,

        // =====================================================
        // Suggestions
        // =====================================================
        recommendations: {
          relatedProducts,
          frequentlyBoughtTogether,
          similarProducts,
        },
      },
    });
  }

  /*
   * =====================================================
   * Conversation Fallback
   * =====================================================
   */

  conversationFallback() {
    return {
      message:
        "I'd be happy to help with your printing requirements. Tell me what you'd like to print, and I'll recommend the best option for you.",

      interaction: "MESSAGE",

      actions: [],

      sections: [],
    };
  }

  exitEditMode(requirement = {}) {
    requirement.editing = {
      active: false,
      step: null,
    };

    return requirement;
  }
}
