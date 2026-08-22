import DecisionTypes from "../helpers/DecisionTypes.js";
import SalesCatalogService from "./SalesCatalogService.js";
import DeliveryService from "./DeliveryService.js";

const catalogService = new SalesCatalogService();
const deliveryService = new DeliveryService();

export default class ConversationDecisionService {
  /*
   * =====================================================
   * Product Selection
   * =====================================================
   */

  buildProductSelection() {
    const products = catalogService.getProducts();

    return this.createDecision({
      type: DecisionTypes.SELECT_PRODUCT,

      context: {
        action: DecisionTypes.SELECT_PRODUCT,

        products: products.map((product) => ({
          id: product.id,
          name: product.name,
        })),
      },

      actions: products.map((product) => ({
        id: DecisionTypes.SELECT_PRODUCT,

        label: product.name,

        payload: {
          productId: product.id,
        },
      })),
    });
  }

  /*
   * =====================================================
   * Selection Recommendation
   * =====================================================
   */

  buildSelectionRecommendation(requirement = {}, product = {}) {
    /*
     * Product doesn't have variants.
     */

    if (!catalogService.hasSelection(product)) {
      return null;
    }

    /*
     * Customer requested all options.
     */

    if (requirement.showAllSelections) {
      const options = catalogService.getSelectionOptions(product);

      return this.createDecision({
        type: DecisionTypes.SELECT_SELECTION,

        context: {
          action: DecisionTypes.SELECT_SELECTION,

          product: {
            id: product.id,
            name: product.name,
          },

          selection: {
            label: product.selection?.label ?? "Option",
          },

          options: options.map((option) => ({
            name: option.name,
            badge: option.badge ?? null,
            startingPrice: option.startingPrice ?? null,
          })),
        },

        actions: options.map((option) => ({
          id: DecisionTypes.SELECT_SELECTION,

          label: option.name,

          payload: {
            productId: product.id,
            selectionId: option.id,

            selection: {
              id: option.id,
              name: option.name,
              badge: option.badge ?? null,
              description: option.description ?? null,
              image: option.image ?? null,
              images: option.images ?? [],
              startingPrice: option.startingPrice ?? null,
              features: (option.features ?? []).slice(0, 4),
            },
          },
        })),
      });
    }

    const recommendation = catalogService.getRecommendedSelection(product);

    /*
     * No recommendation available.
     */

    if (!recommendation) {
      return this.buildSelectionOptions(product);
    }

    const alternatives = catalogService.getAlternativeSelections(
      product,
      recommendation.id,
    );

    return this.createDecision({
      type: DecisionTypes.RECOMMEND_SELECTION,

      context: {
        action: DecisionTypes.RECOMMEND_SELECTION,

        product: {
          id: product.id,
          name: product.name,
        },

        recommendation: {
          id: recommendation.id,
          name: recommendation.name,
          badge: recommendation.badge ?? null,
          description: recommendation.description ?? null,
          startingPrice: recommendation.startingPrice ?? null,
          recommendationReason:
            recommendation.recommendationReason ??
            catalogService.getRecommendationReason(product, recommendation),
          features: (recommendation.features ?? []).slice(0, 3),
        },
      },

      actions: [
        {
          id: DecisionTypes.SELECT_SELECTION,

          label: recommendation.name,

          payload: {
            productId: product.id,
            selectionId: recommendation.id,
          },
        },

        ...(alternatives.length
          ? [
              {
                id: DecisionTypes.SHOW_SELECTIONS,

                label: "Show Other Options",

                payload: {
                  productId: product.id,
                },
              },
            ]
          : []),
      ],
    });
  }

  /*
   * =====================================================
   * Selection Options
   * =====================================================
   */

  buildSelectionOptions(product = {}) {
    const options = catalogService.getSelectionOptions(product);

    return this.createDecision({
      type: DecisionTypes.SELECT_SELECTION,

      context: {
        action: DecisionTypes.SELECT_SELECTION,

        product: {
          id: product.id,
          name: product.name,
        },

        selection: {
          label: product.selection?.label ?? "Option",
        },

        options: options.map((option) => ({
          id: option.id,
          name: option.name,
          badge: option.badge ?? null,
          startingPrice: option.startingPrice ?? null,
        })),
      },

      actions: options.map((option) => ({
        id: DecisionTypes.SELECT_SELECTION,

        label: option.name,

        payload: {
          productId: product.id,
          selectionId: option.id,

          selection: {
            id: option.id,
            name: option.name,
            badge: option.badge ?? null,
            description: option.description ?? null,
            image: option.image ?? null,
            images: option.images ?? [],
            startingPrice: option.startingPrice ?? null,
            features: (option.features ?? []).slice(0, 4),
          },
        },
      })),
    });
  }

  /*
   * =====================================================
   * Decision Builder
   * =====================================================
   */

  createDecision({ type, context = {}, actions = [], sections = [] }) {
    return {
      type,

      stage: "SALES",

      context,

      actions,

      sections,
    };
  }
  /*
   * =====================================================
   * Decide
   * =====================================================
   */

  decide(requirement = {}) {
    const item = requirement.items?.[requirement.currentItem] ?? null;

    /*
     * =====================================================
     * Product
     * =====================================================
     */

    if (!item?.product?.id) {
      return this.buildProductSelection();
    }

    const product = catalogService.getProduct(item.product.id);

    if (!product) {
      return this.buildProductSelection();
    }

    /*
     * =====================================================
     * CONFIRMED
     * =====================================================
     *
     * IMPORTANT:
     * Once the customer has clicked Confirm Order,
     * NEVER return REVIEW_ORDER again.
     *
     * The next stage is customer information collection.
     */

    if (requirement.confirmed === true) {
      return this.buildCompletedDecision(requirement);
    }

    /*
     * =====================================================
     * Product Workflow
     * =====================================================
     */

    const workflowStep = catalogService.getCurrentWorkflowStep(product, item);

    if (workflowStep) {
      return this.buildWorkflowDecision(
        workflowStep,
        product,
        item,
        requirement,
      );
    }

    /*
     * =====================================================
     * Edit Mode
     * =====================================================
     */

    if (requirement.editing?.active) {
      switch (requirement.editing.step) {
        case DecisionTypes.SELECT_SELECTION:
          return this.buildSelectionRecommendation(requirement, product);

        case DecisionTypes.COLLECT_PRODUCT_FIELD:
          return this.buildFieldDecision(product, item);

        case DecisionTypes.COLLECT_REQUIREMENT:
          return this.buildRequirementDecision(product, item);

        case DecisionTypes.COLLECT_QUANTITY:
          return this.buildQuantityDecision(product, item);

        case DecisionTypes.COLLECT_ARTWORK:
          return this.buildArtworkDecision(product);

        case DecisionTypes.SELECT_DELIVERY_METHOD:
          return this.buildDeliveryMethodDecision();

        case DecisionTypes.ASK_DELIVERY_ADDRESS:
          return this.buildDeliveryAddressDecision();

        case DecisionTypes.ASK_DELIVERY_DATE:
          return this.buildDeliveryDateDecision();

        default:
          return this.buildEditDecision(requirement);
      }
    }

    /*
     * =====================================================
     * Quantity
     * =====================================================
     */

    if (!catalogService.getWorkflowValue(item, "quantity")) {
      return this.buildQuantityDecision(product, item);
    }

    /*
     * =====================================================
     * Artwork
     * =====================================================
     */

    const artwork = catalogService.getWorkflowValue(item, "artwork");

    if (!artwork?.status) {
      return this.buildArtworkDecision(product);
    }

    /*
     * =====================================================
     * Delivery Method
     * =====================================================
     */

    if (!deliveryService.isMethodSelected(requirement)) {
      return this.buildDeliveryMethodDecision();
    }

    /*
     * =====================================================
     * Delivery Address
     * =====================================================
     */

    if (
      deliveryService.isDelivery(requirement) &&
      !deliveryService.hasAddress(requirement)
    ) {
      return this.buildDeliveryAddressDecision();
    }

    /*
     * =====================================================
     * Delivery Date
     * =====================================================
     */

    if (!deliveryService.hasRequiredDate(requirement)) {
      return this.buildDeliveryDateDecision();
    }

    /*
     * =====================================================
     * Review
     * =====================================================
     */

    if (!requirement.confirmed) {
      return this.buildReviewDecision(requirement);
    }

    /*
     * =====================================================
     * Completed
     * =====================================================
     */

    return this.buildCompletedDecision(requirement);
  }

  /*
   * =====================================================
   * Workflow Decision
   * =====================================================
   */

  buildWorkflowDecision(step = {}, product = {}, item = {}, requirement = {}) {
    switch (catalogService.getWorkflowStepType(step)) {
      case "selection":
        return this.buildSelectionRecommendation(requirement, product);

      case "fields":
        return this.buildFieldDecision(product, item);

      case "requirements":
        return this.buildRequirementDecision(product, item);

      case "addons":
        return this.buildAddonDecision(product, item);

      default:
        throw new Error(
          `Unsupported workflow step: ${catalogService.getWorkflowStepType(step)}`,
        );
    }
  }

  /*
   * =====================================================
   * Product Field
   * =====================================================
   */

  buildFieldDecision(product = {}, item = {}) {
    const field = catalogService.getCurrentField(product, item);

    if (!field) {
      return null;
    }

    return this.createDecision({
      type: DecisionTypes.COLLECT_PRODUCT_FIELD,

      context: {
        action: DecisionTypes.COLLECT_PRODUCT_FIELD,

        ...this.buildProductContext(product, item),

        field: {
          id: field.id,

          label: field.label ?? field.name,

          question: field.question,

          description: field.description ?? null,

          type: field.type,

          options: field.options ?? [],
        },
      },

      actions: (field.options ?? []).map((option) => ({
        id: DecisionTypes.COLLECT_PRODUCT_FIELD,

        label: option.label ?? option.name,

        payload: {
          fieldId: field.id,
          value: option.id ?? option.value ?? option.name ?? option.label,
        },
      })),
    });
  }

  /*
   * =====================================================
   * Requirement
   * =====================================================
   */

  buildRequirementDecision(product = {}, item = {}) {
    const requirement = catalogService.getCurrentRequirement(product, item);

    if (!requirement) {
      return null;
    }

    return this.createDecision({
      type: DecisionTypes.COLLECT_REQUIREMENT,

      context: {
        action: DecisionTypes.COLLECT_REQUIREMENT,

        ...this.buildProductContext(product, item),

        requirement: {
          id: requirement.id,

          name: requirement.name,

          description: requirement.description,

          instruction: requirement.instruction,

          required: requirement.required,
        },
      },

      actions: (requirement.options ?? []).map((option) => ({
        id: DecisionTypes.COLLECT_REQUIREMENT,

        label: option.label ?? option.name,

        payload: {
          requirementId: requirement.id,

          value: option.value ?? option.name,
        },
      })),
    });
  }

  /*
   * =====================================================
   * Addons
   * =====================================================
   */

  buildAddonDecision(product = {}, item = {}) {
    const addons = catalogService.getAddons(product);

    return this.createDecision({
      type: DecisionTypes.SELECT_ADDONS,

      context: {
        action: DecisionTypes.SELECT_ADDONS,

        ...this.buildProductContext(product, item),

        addons,
      },

      actions: (addons.options ?? []).map((addon) => ({
        id: DecisionTypes.SELECT_ADDONS,

        label: addon.name,

        payload: {
          addonId: addon.id,
        },
      })),
    });
  }

  /*
   * =====================================================
   * Quantity
   * =====================================================
   */

  buildQuantityDecision(product = {}, item = {}) {
    return this.createDecision({
      type: DecisionTypes.COLLECT_QUANTITY,

      context: {
        action: DecisionTypes.COLLECT_QUANTITY,

        ...this.buildProductContext(product, item),
      },
    });
  }

  /*
   * =====================================================
   * Artwork
   * =====================================================
   */

  buildArtworkDecision(product = {}) {
    return this.createDecision({
      type: DecisionTypes.COLLECT_ARTWORK,

      context: {
        action: DecisionTypes.COLLECT_ARTWORK,

        ...this.buildProductContext(product),
      },

      actions: [
        {
          id: DecisionTypes.COLLECT_ARTWORK,

          label: "I Have Artwork",

          payload: {
            status: "CUSTOMER_ARTWORK",
          },
        },

        {
          id: DecisionTypes.COLLECT_ARTWORK,

          label: "Need Design",

          payload: {
            status: "NEED_DESIGN",
          },
        },
      ],
    });
  }

  /*
   * =====================================================
   * Delivery Method
   * =====================================================
   */

  buildDeliveryMethodDecision() {
    return this.createDecision({
      type: DecisionTypes.SELECT_DELIVERY_METHOD,

      context: {
        action: DecisionTypes.SELECT_DELIVERY_METHOD,
      },

      actions: [
        {
          id: DecisionTypes.SELECT_DELIVERY_METHOD,

          label: "Delivery",

          payload: {
            value: "delivery",
          },
        },

        {
          id: DecisionTypes.SELECT_DELIVERY_METHOD,

          label: "Pickup",

          payload: {
            value: "pickup",
          },
        },
      ],
    });
  }

  /*
   * =====================================================
   * Delivery Address
   * =====================================================
   */

  buildDeliveryAddressDecision() {
    return this.createDecision({
      type: DecisionTypes.ASK_DELIVERY_ADDRESS,

      context: {
        action: DecisionTypes.ASK_DELIVERY_ADDRESS,
      },
    });
  }
  /*
   * =====================================================
   * Delivery Date
   * =====================================================
   */

  buildDeliveryDateDecision() {
    return this.createDecision({
      type: DecisionTypes.ASK_DELIVERY_DATE,

      context: {
        action: DecisionTypes.ASK_DELIVERY_DATE,
      },
    });
  }

  /*
   * =====================================================
   * Review
   * =====================================================
   */
  buildReviewDecision(requirement = {}) {
    return this.createDecision({
      type: DecisionTypes.REVIEW_ORDER,

      context: {
        action: DecisionTypes.REVIEW_ORDER,
        order: requirement,
      },
    });
  }

  /*
   * =====================================================
   * Confirmation
   * =====================================================
   */

  buildConfirmationDecision() {
    return this.createDecision({
      type: DecisionTypes.COMPLETE_ORDER,

      context: {
        action: DecisionTypes.COMPLETE_ORDER,
      },

      actions: [
        {
          id: DecisionTypes.CONFIRM_ORDER,

          label: "Submit Request",

          payload: {
            confirmed: true,
          },
        },

        {
          id: DecisionTypes.CANCEL_ORDER,

          label: "Cancel",

          payload: {
            confirmed: false,
          },
        },
      ],
    });
  }

  /*
   *======================================================
   *Edit Order
   *======================================================
   */

  buildEditDecision(requirement = {}) {
    const item = requirement.items?.[requirement.currentItem] ?? {};

    return this.createDecision({
      type: DecisionTypes.EDIT_ORDER,

      context: {
        action: DecisionTypes.EDIT_ORDER,
        item,
      },

      actions: [
        {
          id: DecisionTypes.SELECT_SELECTION,
          label: "Business Card Type",
          payload: {
            edit: true,
          },
        },
        {
          id: DecisionTypes.COLLECT_PRODUCT_FIELD,
          label: "Product Details",
          payload: {
            edit: true,
          },
        },
        {
          id: DecisionTypes.COLLECT_REQUIREMENT,
          label: "Requirements",
          payload: {
            edit: true,
          },
        },
        {
          id: DecisionTypes.COLLECT_QUANTITY,
          label: "Quantity",
          payload: {
            edit: true,
          },
        },
        {
          id: DecisionTypes.COLLECT_ARTWORK,
          label: "Artwork",
          payload: {
            edit: true,
          },
        },
        {
          id: DecisionTypes.SELECT_DELIVERY_METHOD,
          label: "Delivery Method",
          payload: {
            edit: true,
          },
        },
        {
          id: DecisionTypes.ASK_DELIVERY_ADDRESS,
          label: "Delivery Address",
          payload: {
            edit: true,
          },
        },
        {
          id: DecisionTypes.ASK_DELIVERY_DATE,
          label: "Delivery Date",
          payload: {
            edit: true,
          },
        },
      ],
    });
  }

  /*
   * =====================================================
   * Completed
   * =====================================================
   */

  buildCompletedDecision(requirement = {}) {
    return {
      type: DecisionTypes.ORDER_COMPLETED,

      stage: "SALES",

      context: {
        action: DecisionTypes.ORDER_COMPLETED,
        order: requirement,
      },

      actions: [],

      sections: [],
    };
  }

  buildProductContext(product = {}, item = {}) {
    const selection = item.selection?.id
      ? catalogService.getSelectionOption(product, item.selection.id)
      : null;

    return {
      product: {
        id: product.id,
        name: product.name,
        image: selection?.image ?? product.image ?? null,
        images: selection?.images ?? product.images ?? [],
      },

      selection,
    };
  }

  hasCustomerInformation(requirement = {}) {
    const customer = requirement.customer ?? {};

    return Boolean(customer.name && customer.phone && customer.email);
  }

  buildCustomerDecision(requirement = {}) {
    const customer = requirement.customer ?? {};

    if (!customer.name) {
      return this.createDecision({
        type: DecisionTypes.COLLECT_CUSTOMER,
        context: {
          action: DecisionTypes.COLLECT_CUSTOMER,
          field: {
            id: "name",
            label: "Name",
            question: "What's your name?",
            required: true,
          },
        },
      });
    }

    if (!customer.phone) {
      return this.createDecision({
        type: DecisionTypes.COLLECT_CUSTOMER,
        context: {
          action: DecisionTypes.COLLECT_CUSTOMER,
          field: {
            id: "phone",
            label: "Phone Number",
            question: "What's the best phone number to reach you on?",
            required: true,
          },
        },
      });
    }

    if (!customer.email) {
      return this.createDecision({
        type: DecisionTypes.COLLECT_CUSTOMER,
        context: {
          action: DecisionTypes.COLLECT_CUSTOMER,
          field: {
            id: "email",
            label: "Email",
            question: "What's your email address?",
            required: true,
          },
        },
      });
    }

    return null;
  }
}
