import SalesExtractor from "./extractors/SalesExtractor.js";
import SalesResponseBuilder from "./builders/SalesResponseBuilder.js";
import SalesConversationService from "./services/SalesConversationService.js";
import ConversationDecisionService from "./services/ConversationDecisionService.js";
import OrderManager from "./services/OrderManager.js";
import PricingService from "./services/PricingService.js";
import DeliveryService from "./services/DeliveryService.js";
import SalesCatalogService from "./services/SalesCatalogService.js";
import DecisionTypes from "./helpers/DecisionTypes.js";
import ConversationContextBuilder from "./services/ConversationcontextBuilder.js";
import FieldResolver from "./services/FieldResolver.js";
import { GREETING_PATTERNS } from "../routing/utils/RoutingConstants.js";
import OrderRepository from "../../repositories/OrderRequestRepository.js";

const conversationService = new SalesConversationService();
const contextBuilder = new ConversationContextBuilder();
const extractor = new SalesExtractor();
const orderManager = new OrderManager();
const conversationDecisionService = new ConversationDecisionService();
const pricingService = new PricingService();
const deliveryService = new DeliveryService();
const responseBuilder = new SalesResponseBuilder();
const fieldResolver = new FieldResolver();
const catalogService = new SalesCatalogService();
const orderRepository = new OrderRepository();


export default class SalesBrain {
  async execute(state = {}) {
    let requirement = orderManager.createRequirement(
      state.liveRequirement ?? state.order ?? state.orderContext ?? null,
    );

    const userMessage = (
      state.userMessage ??
      state.message ??
      ""
    ).trim();

    try {
      /*
       * SALES ONLY
       *
       * SalesBrain is completely conversational.
       *
       * Responsibilities:
       * - product discovery
       * - product selection
       * - variants / selections
       * - product-specific requirements
       * - quantity
       * - artwork
       * - delivery / pickup
       * - delivery address
       * - delivery date
       * - pricing
       * - order review
       * - order confirmation
       *
       * NOT responsible for:
       * - customer name
       * - customer email
       * - customer company
       * - Lead creation
       * - WhatsApp Lead Flow
       * - HTML/dynamic forms
       * - form submission
       */

      const rawUserMsg = userMessage.toLowerCase();

      // GLOBAL CANCELLATION / RESET
      const isCancellation =
        state.action?.id === "CANCEL_ORDER" ||
        state.action?.id === DecisionTypes.CANCEL_ORDER ||
        /^(cancel|cancel order|cancelled|stop|restart|start over|start again|reset|quit|exit|nevermind|i don't want this anymore|i dont want this anymore)$/i.test(
          rawUserMsg,
        ) ||
        /\b(cancel order|cancel my order|cancel the order|stop order|restart bot|restart chat)\b/i.test(
          rawUserMsg,
        );

      if (isCancellation) {
        console.log(
          "[SalesBrain] CANCELLATION_HANDLED: clearing active sales order",
        );

        return this.cancelOrder(state);
      }

      // COMPLETED ORDER GUARD
      if (
        state.currentStep === "ORDER_COMPLETED" ||
        requirement.confirmed === true ||
        requirement.completed === true
      ) {
        const successMessage =
          "Thank you! Your order has been confirmed. Our sales team will contact you shortly.";

        return {
          ...state,
          liveRequirement: requirement,
          productSales: requirement,
          order: requirement,
          orderContext: requirement,

          workflow: "SALES",
          currentStep: "ORDER_COMPLETED",
          nextStep: null,

          completed: true,
          confirmed: true,
          orderConfirmed: true,
          awaitingDecision: false,

          assistantMessage: successMessage,

          response: responseBuilder.build({
            workflow: "SALES",
            interaction: "MESSAGE",
            message: successMessage,
            liveRequirement: requirement,
            completed: true,
            currentStep: "ORDER_COMPLETED",
            nextStep: null,
            context: {
              action: "ORDER_COMPLETED",
              order: requirement,
            },
          }),
        };
      }

      /*
       * ARTWORK MEDIA
       *
       * Artwork is handled as a normal WhatsApp attachment.
       * No form state is involved.
       */
      if (
        Array.isArray(state.attachments) &&
        state.attachments.length > 0
      ) {
        const updated = orderManager.applyArtworkAttachments(
          requirement,
          state.attachments,
        );

        if (updated !== requirement) {
          requirement = updated;

          const artwork = orderManager.getWorkflowField(
            requirement,
            "artwork",
          );

          if (
            artwork?.status === "UPLOADED" &&
            state.currentStep === "WAITING_FOR_ARTWORK"
          ) {
            const decision =
              conversationDecisionService.decide(requirement);

            const response =
              await this.buildConversationResponse(
                requirement,
                decision,
                "",
              );

            return {
              ...response,
              response,
              liveRequirement: requirement,
              productSales: requirement,
              order: requirement,
              orderContext: requirement,

              workflow: "SALES",
              completed: false,

              currentStep: decision.type,
              nextStep: decision.nextStep ?? null,

              awaitingDecision: true,
            };
          }
        }
      }

      /*
       * ACTION HANDLING
       *
       * Only conversational/catalog/order actions are accepted.
       */
      if (state.action?.id) {
        const actionId = state.action.id;

        if (
          actionId === "ORDER_NOW" ||
          actionId === DecisionTypes.ORDER_NOW
        ) {
          const productId =
            state.action.payload?.productId ?? null;

          const canonicalProduct = productId
            ? (
              catalogService.getProduct(productId) ??
              catalogService.resolveProduct({
                productId,
                slug: productId,
              })
            )
            : null;

          const currentItem =
            orderManager.getCurrentItem(requirement);

          const currentProdId =
            currentItem?.selectedProduct?.id ??
            currentItem?.product?.id ??
            null;

          const isStale =
            currentProdId &&
            currentProdId !== productId &&
            currentItem?.product?.id !== productId;

          if (!canonicalProduct || isStale) {
            console.warn(
              `[SalesBrain] ORDER_NOW rejected: invalid productId ${productId}`,
            );

            return {
              ...state,
              workflow: "SALES",
              currentStep: "ERROR",
              nextStep: null,
              awaitingDecision: true,
              liveRequirement: requirement,

              assistantMessage:
                "That product selection is no longer available. Please select the product again.",

              response: responseBuilder.error(
                "That product selection is no longer available. Please select the product again.",
              ),
            };
          }
        }

        requirement = this.applyAction(
          requirement,
          state.action,
        );

        if (
          actionId === "CONFIRM_ORDER" ||
          actionId === DecisionTypes.CONFIRM_ORDER
        ) {
          return this.confirmOrder(
            state,
            requirement,
          );
        }

        if (
          actionId === "CANCEL_ORDER" ||
          actionId === DecisionTypes.CANCEL_ORDER
        ) {
          return this.cancelOrder(state);
        }

        if (
          actionId === "EDIT_ORDER" ||
          actionId === DecisionTypes.EDIT_ORDER
        ) {
          return await this.handleConversationalEdit(
            state,
            requirement,
          );
        }
      }

      /*
       * NATURAL LANGUAGE SALES INPUT
       *
       * Everything after product selection is conversational.
       */
      const currentItem =
        orderManager.getCurrentItem(requirement);

      const rawMsg = userMessage.toLowerCase();

      const isPureGreeting = GREETING_PATTERNS.some(
        (pattern) => pattern.test(rawMsg),
      );

      if (
        isPureGreeting &&
        currentItem?.product?.id
      ) {
        console.log(
          "[WhatsApp][Greeting] activeWorkflow=SALES preservedWorkflow=true",
        );

        const decision =
          conversationDecisionService.decide(requirement);

        const response =
          await this.buildConversationResponse(
            requirement,
            decision,
            userMessage,
          );

        return {
          ...response,
          response,
          liveRequirement: requirement,
          productSales: requirement,
          order: requirement,
          orderContext: requirement,

          workflow: "SALES",
          completed: false,

          currentStep: decision.type,
          nextStep: decision.nextStep ?? null,

          awaitingDecision: true,
        };
      }

      /*
       * EXISTING ORDER
       *
       * Resolve product fields directly from conversation.
       */
      if (currentItem?.orderStarted === true) {
        const concreteProduct =
          currentItem.selectedProduct ??
          currentItem.product ??
          null;

        let resolvedAny = false;

        if (concreteProduct && userMessage) {
          const fields =
            catalogService.getProductFields(
              concreteProduct,
              currentItem,
            );

          let remainingMessage = userMessage;

          for (const field of fields) {
            const value =
              fieldResolver.resolveField(
                field,
                remainingMessage,
              );

            if (value != null) {
              requirement =
                this.applyFieldUpdate(
                  requirement,
                  field.id,
                  value,
                );

              resolvedAny = true;

              remainingMessage =
                fieldResolver.consumeMatch(
                  field,
                  remainingMessage,
                  value,
                );
            }
          }

          // DELIVERY / PICKUP
          if (
            /\b(self[ -]?pickup|pick[ -]?up|store pickup)\b/i.test(
              userMessage,
            )
          ) {
            requirement =
              this.applyDeliveryUpdate(
                requirement,
                "pickup",
              );

            resolvedAny = true;
          } else if (
            /\b(delivery|deliver|shipping|ship to)\b/i.test(
              userMessage,
            )
          ) {
            requirement =
              this.applyDeliveryUpdate(
                requirement,
                "delivery",
              );

            resolvedAny = true;
          }

          // PRODUCT REQUIREMENTS
          const requirements =
            catalogService.getRequirements(
              concreteProduct,
            );

          for (const req of requirements) {
            if (req.id === "designRequired") {
              if (
                /\b(have artwork|ready artwork|my artwork|own design)\b/i.test(
                  userMessage,
                )
              ) {
                requirement =
                  this.applyRequirementUpdate(
                    requirement,
                    req.id,
                    "have_artwork",
                  );

                resolvedAny = true;
              } else if (
                /\b(need design|design service|design required|create design)\b/i.test(
                  userMessage,
                )
              ) {
                requirement =
                  this.applyRequirementUpdate(
                    requirement,
                    req.id,
                    "need_design",
                  );

                resolvedAny = true;
              }
            }
          }
        }

        /*
         * If the message was not directly resolved as a
         * known product field, let SalesExtractor interpret it.
         */
        if (!resolvedAny && userMessage) {
          const extracted =
            extractor.extract(
              requirement,
              userMessage,
              state.currentStep,
            );

          if (
            extracted.isNewProduct &&
            extracted.product
          ) {
            requirement = orderManager.reset();

            requirement =
              this.selectProduct(
                requirement,
                extracted.product.id ??
                extracted.product.productId ??
                extracted.product.slug,
              );

            if (
              extracted.categoryProducts?.length
            ) {
              requirement.discoveryMatches =
                extracted.categoryProducts;
            }
          } else {
            requirement =
              this.applyDiscoveryExtraction(
                requirement,
                extracted,
              );
          }
        }
      } else if (userMessage) {
        /*
         * PRODUCT DISCOVERY
         *
         * No form.
         */
        const extracted =
          extractor.extract(
            requirement,
            userMessage,
            state.currentStep,
          );

        if (
          extracted.isNewProduct &&
          extracted.product
        ) {
          console.log(
            "[SalesBrain] NEW_PRODUCT_INTENT_DETECTED:",
            {
              interruptedProduct:
                currentItem?.product?.id,
              newProduct:
                extracted.product.id,
            },
          );

          requirement = orderManager.reset();

          requirement =
            this.selectProduct(
              requirement,
              extracted.product.id ??
              extracted.product.productId ??
              extracted.product.slug,
            );

          if (
            extracted.categoryProducts?.length
          ) {
            requirement.discoveryMatches =
              extracted.categoryProducts;
          }
        } else if (
          extracted.isNewProduct &&
          extracted.categoryProducts?.length
        ) {
          requirement = orderManager.reset();

          requirement.discoveryMatches =
            extracted.categoryProducts;
        } else {
          requirement =
            this.applyDiscoveryExtraction(
              requirement,
              extracted,
            );
        }
      }

      /*
       * SALES DECISION
       */
      const decision =
        conversationDecisionService.decide(
          requirement,
        );

      if (
        !this.isConversationDecision(
          decision.type,
        )
      ) {
        return responseBuilder.error(
          `Unsupported sales decision: ${decision.type}`,
        );
      }

      /*
       * GENERATE CONVERSATIONAL RESPONSE
       */
      const response =
        await this.buildConversationResponse(
          requirement,
          decision,
          userMessage,
        );

      return {
        ...response,
        response,

        liveRequirement: requirement,
        productSales: requirement,
        order: requirement,
        orderContext: requirement,

        workflow: "SALES",
        completed: false,

        currentStep: decision.type,
        nextStep: decision.nextStep ?? null,

        awaitingDecision: true,
      };
    } catch (error) {
      console.error("\n========================================");
      console.error("SALES BRAIN ERROR");
      console.error("========================================");

      console.error(error.message);
      console.error(error.stack);

      console.error("Requirement:");
      console.dir(requirement, {
        depth: null,
      });

      console.error("Action:");
      console.dir(state.action, {
        depth: null,
      });

      console.error("Message:", userMessage);

      console.error("========================================\n");

      return responseBuilder.error(
        "I apologize, but I encountered a temporary issue while processing the request.",
        {
          interaction: "MESSAGE",
          metadata: {
            error: true,
          },
          currentStep:
            state.currentStep ?? null,
          nextStep: null,
        },
      );
    }
  }

  // ACTION ROUTING

  applyAction(requirement = {}, action = {}) {
    if (!action?.id) {
      return requirement;
    }

    // Conversational editing is handled by SalesBrain.
    if (action.payload?.edit) {
      return requirement;
    }

    switch (action.id) {
      case DecisionTypes.START_ORDER:
        return this.applyStartOrderAction(requirement, action);

      case DecisionTypes.SELECT_PRODUCT:
        return this.applyProductAction(requirement, action);

      case DecisionTypes.SELECT_SELECTION:
        return this.applySelectionAction(requirement, action);

      case "SELECT_NESTED_PRODUCT":
        return this.applyNestedProductAction(requirement, action);

      case "ORDER_NOW":
      case DecisionTypes.ORDER_NOW:
        return this.applyOrderNowAction(requirement, action);

      case DecisionTypes.SHOW_SELECTIONS:
        requirement.showAllSelections = true;
        return requirement;

      case "BROWSE_PRODUCTS":
        requirement.browseCatalog = true;
        requirement.discoveryMatches = [];
        return requirement;

      case "SELECT_CATEGORY":
      case "BROWSE_CATEGORY": {
        const categoryName =
          action.payload?.category ??
          action.payload?.label ??
          action.payload?.name ??
          action.payload?.id;

        if (categoryName) {
          const categoryProducts =
            catalogService.findCategoryProducts(categoryName);

          if (categoryProducts.length) {
            requirement.discoveryMatches = categoryProducts;
          }
        }

        return requirement;
      }

      case "SET_FIELD": {
        const fieldId = action.payload?.fieldId;
        const value = action.payload?.value;

        if (fieldId && value != null) {
          return this.applyFieldUpdate(
            requirement,
            fieldId,
            value,
          );
        }

        return requirement;
      }

      case "SET_REQUIREMENT": {
        const requirementId = action.payload?.requirementId;
        const value = action.payload?.value;

        if (requirementId && value != null) {
          return this.applyRequirementUpdate(
            requirement,
            requirementId,
            value,
          );
        }

        return requirement;
      }

      case "TOGGLE_ADDON": {
        const addonId = action.payload?.addonId;

        if (addonId) {
          const item = orderManager.getCurrentItem(requirement);

          const currentAddons = Array.isArray(item?.addons?.selected)
            ? [...item.addons.selected]
            : [];

          const idx = currentAddons.indexOf(addonId);

          if (idx >= 0) {
            currentAddons.splice(idx, 1);
          } else {
            currentAddons.push(addonId);
          }

          return orderManager.updateCurrentItem(requirement, {
            addons: {
              ...(item?.addons ?? {}),
              selected: currentAddons,
            },
          });
        }

        return requirement;
      }

      case "SET_DELIVERY": {
        const method = action.payload?.method || "pickup";
        return this.applyDeliveryUpdate(requirement, method);
      }

      case "SUBMIT_ORDER_FORM":
      case "SUBMIT_FORM": {
        const values = action.payload?.values ?? action.payload ?? {};
        for (const [fieldId, val] of Object.entries(values)) {
          if (val != null) {
            if (fieldId === "deliveryMethod" || fieldId === "delivery") {
              requirement = this.applyDeliveryUpdate(requirement, val);
            }
            requirement = this.applyFieldUpdate(requirement, fieldId, val);
          }
        }
        return requirement;
      }

      case "NEXT_STEP": {
        const step = action.payload?.step;

        if (step === "addons") {
          const item = orderManager.getCurrentItem(requirement);

          return orderManager.updateCurrentItem(requirement, {
            addons: {
              ...(item?.addons ?? {}),
              completed: true,
            },
          });
        }

        return requirement;
      }

      case "BACK":
        return this.handleBackStep(requirement);

      case "EDIT_ORDER": {
        return orderManager.updateCurrentItem(requirement, {
          productData: {},
          workflow: {},
          delivery: {},
          reviewCompleted: false,
          confirmClicked: false,
          confirmed: false,
          completed: false,
          orderConfirmed: false,
        });
      }

      case "CONFIRM_ORDER":
        return requirement;

      case "CANCEL_ORDER":
        return orderManager.reset();

      default:
        return requirement;
    }
  }

  applyFieldUpdate(requirement = {}, fieldId, rawValue) {
    const item = orderManager.getCurrentItem(requirement);

    if (!item) {
      return requirement;
    }

    const concreteProduct =
      item.selectedProduct ??
      item.product ??
      null;

    const field = concreteProduct
      ? catalogService.getProductField(
        concreteProduct,
        item,
        fieldId,
      )
      : null;

    let value = rawValue;

    if (field) {
      if (
        field.type === "number" ||
        field.type === "quantity"
      ) {
        const num = Number(value);

        if (!Number.isNaN(num)) {
          value = num;
        }
      }

      if (
        Array.isArray(field.options) &&
        field.options.length > 0
      ) {
        const matchingOpt = field.options.find(
          (option) =>
            String(option.value ?? option.id).toLowerCase() ===
            String(value).toLowerCase() ||
            String(option.label ?? option.name).toLowerCase() ===
            String(value).toLowerCase(),
        );

        if (matchingOpt) {
          value =
            matchingOpt.value ??
            matchingOpt.id;

          const currentQty = Number(
            item.workflow?.quantity ??
            item.quantity ??
            0,
          );

          if (
            matchingOpt.minQuantity &&
            currentQty > 0 &&
            currentQty < matchingOpt.minQuantity
          ) {
            console.warn(
              `[SalesBrain] Option ${matchingOpt.id} requires minQuantity ${matchingOpt.minQuantity}, current is ${currentQty}`,
            );

            return requirement;
          }
        }
      }
    }

    let updated =
      orderManager.updateCurrentItem(requirement, {
        workflow: {
          ...(item.workflow ?? {}),
          [fieldId]: value,
        },

        productData: {
          ...(item.productData ?? {}),
          [fieldId]: value,
        },
      });

    if (
      fieldId === "quantity" ||
      field?.mapsTo === "workflow.quantity"
    ) {
      const quantity = Number(value) || 0;

      updated = orderManager.updateCurrentItem(
        updated,
        {
          quantity,

          workflow: {
            ...(orderManager.getCurrentItem(updated)?.workflow ?? {}),
            quantity,
          },
        },
      );
    }

    return updated;
  }

  applyRequirementUpdate(
    requirement = {},
    requirementId,
    value,
  ) {
    const item =
      orderManager.getCurrentItem(requirement);

    if (!item) {
      return requirement;
    }

    return orderManager.updateCurrentItem(
      requirement,
      {
        workflow: {
          ...(item.workflow ?? {}),
          [requirementId]: value,
        },

        productData: {
          ...(item.productData ?? {}),
          [requirementId]: value,
        },
      },
    );
  }

  applyDeliveryUpdate(
    requirement = {},
    method = "pickup",
  ) {
    const item =
      orderManager.getCurrentItem(requirement);

    if (!item) {
      return requirement;
    }

    const isPickup = method === "pickup";

    return orderManager.updateCurrentItem(
      requirement,
      {
        delivery: {
          ...(item.delivery ?? {}),
          method,
          address: isPickup
            ? null
            : item.delivery?.address ?? null,
        },

        workflow: {
          ...(item.workflow ?? {}),
          deliveryMethod: method,
          ...(isPickup
            ? {
              deliveryAddress: null,
              address: null,
            }
            : {}),
        },

        productData: {
          ...(item.productData ?? {}),
          deliveryMethod: method,
          ...(isPickup
            ? {
              deliveryAddress: null,
              address: null,
            }
            : {}),
        },
      },
    );
  }

  handleConversationalEdit(state = {}, requirement = {}) {
    const updated = orderManager.updateCurrentItem(requirement, {
      productData: {},
      workflow: {},
      delivery: {},
    });
    const decision = conversationDecisionService.decide(updated);
    return {
      ...state,
      workflow: "SALES",
      currentStep: decision.type,
      nextStep: decision.nextStep ?? null,
      liveRequirement: updated,
      response: responseBuilder.build({
        workflow: "SALES",
        message:
          "Sure! Let's update your order. " +
          (decision.context?.field?.question || "Please select your options:"),
        actions: decision.actions,
        context: decision.context,
      }),
    };
  }

  handleBackStep(requirement = {}) {
    const item =
      orderManager.getCurrentItem(requirement);

    if (!item) return requirement;

    const workflow = {
      ...(item.workflow ?? {}),
    };

    const keys = Object.keys(workflow);

    if (keys.length === 0) {
      return requirement;
    }

    const lastKey =
      keys[keys.length - 1];

    delete workflow[lastKey];

    const productData = {
      ...(item.productData ?? {}),
    };

    delete productData[lastKey];

    return orderManager.updateCurrentItem(
      requirement,
      {
        workflow,
        productData,
        reviewCompleted: false,
        confirmClicked: false,
      },
    );
  }

  // START ORDER

  applyStartOrderAction(requirement = {}, action = {}) {
    const productId = action.payload?.productId;

    if (productId == null) {
      return requirement;
    }

    return this.selectProduct(requirement, productId);
  }

  // PRODUCT

  applyProductAction(requirement = {}, action = {}) {
    const productId = action.payload?.productId;

    if (productId == null) {
      return requirement;
    }

    return this.selectProduct(requirement, productId);
  }

  selectProduct(requirement = {}, productId) {
    let updated;

    const currentItem = orderManager.getCurrentItem(requirement);

    if (!currentItem) {
      updated = orderManager.addItem(requirement, {
        id: productId,
      });
    } else {
      const product = catalogService.getProduct(productId);

      if (!product) {
        return requirement;
      }

      updated = orderManager.updateCurrentItem(requirement, {
        product,

        selection: null,

        selectedProduct: null,

        productData: {},

        requirements: [],

        workflow: {},
      });
    }

    const item = orderManager.getCurrentItem(updated);

    const product = item?.product?.id
      ? catalogService.getProduct(item.product.id)
      : null;

    if (!product) {
      return updated;
    }

    const selections = catalogService.getSelectionOptions(product);

    // NO CATEGORY / NO VARIANT
    // Product itself is final.

    if (!Array.isArray(selections) || selections.length === 0) {
      return orderManager.updateCurrentItem(updated, {
        selectedProduct: product,

        productData: {},
      });
    }

    // HAS CATEGORY / VARIANT
    // Keep form closed.

    return updated;
  }

  // NESTED PRODUCT

  applyNestedProductAction(requirement = {}, action = {}) {
    let currentItem = orderManager.getCurrentItem(requirement);

    if (!currentItem?.product?.id) {
      const productId =
        action.payload?.productId ??
        requirement.discoveryMatches?.[0]?.id ??
        requirement.discoveryMatches?.[0]?.slug ??
        null;
      if (productId) {
        requirement = this.selectProduct(requirement, productId);
        currentItem = orderManager.getCurrentItem(requirement);
      }
    }

    if (!currentItem?.product?.id) {
      return requirement;
    }

    const product = catalogService.getProduct(currentItem.product.id);

    if (!product) {
      return requirement;
    }

    const selectionId =
      action.payload?.selectionId ?? currentItem.selection?.id ?? null;

    if (selectionId == null) {
      return requirement;
    }

    const selection = catalogService.getSelectionOption(product, selectionId);

    if (!selection) {
      return requirement;
    }

    const nestedProductId = action.payload?.nestedProductId ?? null;

    if (nestedProductId == null) {
      return requirement;
    }

    const nestedProducts = Array.isArray(selection.products)
      ? selection.products
      : [];

    const nestedProduct =
      nestedProducts.find(
        (child) =>
          String(child?.id) === String(nestedProductId) ||
          String(child?.productId) === String(nestedProductId) ||
          String(child?.slug) === String(nestedProductId),
      ) ?? null;

    if (!nestedProduct) {
      return requirement;
    }

    // FINAL CATALOG PRODUCT
    // Only here do we open the order form.
    const finalProduct = {
      ...product,
      ...nestedProduct,
      id: nestedProduct.id,
      productId: nestedProduct.id,
      name: nestedProduct.name ?? nestedProduct.productName ?? product.name,
      slug: nestedProduct.slug ?? nestedProduct.id,
      image: nestedProduct.image ?? nestedProduct.images ?? product.image,
      images: nestedProduct.images ?? nestedProduct.image ?? product.images,
      description: nestedProduct.description ?? product.description,
      badge: nestedProduct.badge ?? product.badge,
      parentProductId: product.id,
      parentSelectionId: selection.id,
    };

    return orderManager.updateCurrentItem(requirement, {
      product: finalProduct,

      selection: {
        ...selection,
        id: selection.id,
        name: selection.name ?? selection.label ?? null,
      },

      selectedProduct: {
        ...nestedProduct,
        parentProductId: product.id,
        parentSelectionId: selection.id,
      },


      productData: {},

      requirements: [],

      workflow: {},
    });
  }

  // SELECTION

  applySelectionAction(requirement = {}, action = {}) {
    let currentItem = orderManager.getCurrentItem(requirement);

    if (!currentItem?.product?.id) {
      const productId =
        action.payload?.productId ??
        requirement.discoveryMatches?.[0]?.id ??
        requirement.discoveryMatches?.[0]?.slug ??
        null;
      if (productId) {
        requirement = this.selectProduct(requirement, productId);
        currentItem = orderManager.getCurrentItem(requirement);
      }
    }

    if (!currentItem?.product?.id) {
      return requirement;
    }

    const selectionId = action.payload?.selectionId ?? null;

    if (selectionId == null) {
      return requirement;
    }

    const product = catalogService.getProduct(currentItem.product.id);

    if (!product) {
      return requirement;
    }

    const selection = catalogService.getSelectionOption(product, selectionId);

    if (!selection) {
      return requirement;
    }

    const hasNestedProducts =
      Array.isArray(selection.products) && selection.products.length > 0;

    return orderManager.updateCurrentItem(requirement, {
      selection: {
        ...selection,

        id: selection.id,

        name: selection.name ?? selection.label ?? null,
      },

      selectedProduct: hasNestedProducts
        ? null
        : {
          ...product,

          selection: {
            ...selection,

            id: selection.id,

            name: selection.name ?? selection.label ?? null,
          },
        },

      // Form opens only on ORDER NOW action.

      productData: {},

      requirements: [],

      workflow: {},
    });
  }

  // ORDER NOW

  applyOrderNowAction(requirement = {}, action = {}) {
    const productId = action.payload?.productId;

    if (!productId) {
      return requirement;
    }

    // Re-resolve canonical product against authoritative catalog
    const canonicalProduct =
      catalogService.getProduct(productId) ??
      catalogService.resolveProduct({ productId, slug: productId });

    if (!canonicalProduct) {
      console.warn(
        `[SalesBrain] ORDER_NOW rejected: unknown productId ${productId}`,
      );
      return requirement;
    }

    let currentItem = orderManager.getCurrentItem(requirement);
    if (!currentItem) {
      requirement = orderManager.addItem(requirement, {
        id: canonicalProduct.id,
        product: canonicalProduct,
        selectedProduct: canonicalProduct,
      });
      currentItem = orderManager.getCurrentItem(requirement);
    }

    const currentProdId =
      currentItem.selectedProduct?.id ?? currentItem.product?.id ?? null;

    if (
      currentProdId &&
      currentProdId !== productId &&
      currentItem.product?.id !== productId
    ) {
      const isValidChild =
        currentItem.product?.id &&
        catalogService.getSelectionOption(currentItem.product, productId);
      if (!isValidChild) {
        console.warn(
          `[SalesBrain] ORDER_NOW rejected: stale/wrong productId ${productId} for active product ${currentProdId}`,
        );
        return requirement;
      }
    }

    const finalSelectedProduct = {
      ...(currentItem.selectedProduct ?? {}),
      ...canonicalProduct,
      id: canonicalProduct.id,
    };

    const updated = orderManager.updateCurrentItem(requirement, {
      product: {
        ...(currentItem.product ?? canonicalProduct),
        ...finalSelectedProduct,
        id: finalSelectedProduct.id,
      },
      selectedProduct: finalSelectedProduct,
      orderStarted: true,
    });

    console.log(
      `[WhatsApp][OrderNow] productId=${finalSelectedProduct.id} conversational=true orderStarted=true`,
    );

    return updated;
  }

  // DISCOVERY EXTRACTION

  applyDiscoveryExtraction(requirement = {}, extracted = {}) {
    if (!extracted) {
      return requirement;
    }

    requirement = {
      ...requirement,
      discoveryMatches: [
        ...(extracted.products ?? []),
        ...(extracted.categoryProducts ?? []),
      ].filter(
        (product, index, list) =>
          product?.id &&
          list.findIndex((item) => item?.id === product.id) === index,
      ),
    };

    // Product only.
    if (!orderManager.getCurrentItem(requirement) && extracted.product) {
      requirement = this.selectProduct(
        requirement,
        extracted.product.id ??
        extracted.product.productId ??
        extracted.product.slug,
      );
    }

    // Selection.
    if (extracted.selection) {
      const item = orderManager.getCurrentItem(requirement);

      if (!item?.product?.id) {
        return requirement;
      }

      const product = catalogService.getProduct(item.product.id);

      if (!product) {
        return requirement;
      }

      const selectionId =
        extracted.selection.id ??
        extracted.selection.selectionId ??
        extracted.selection.slug;

      if (selectionId == null) {
        return requirement;
      }

      requirement = this.applySelectionAction(requirement, {
        id: DecisionTypes.SELECT_SELECTION,

        payload: {
          selectionId,
        },
      });
    }

    // Nested product.
    if (extracted.nestedProduct) {
      requirement = this.applyNestedProductAction(requirement, {
        id: "SELECT_NESTED_PRODUCT",

        payload: {
          selectionId: extracted.selection?.id ?? null,

          nestedProductId:
            extracted.nestedProduct.id ??
            extracted.nestedProduct.productId ??
            extracted.nestedProduct.slug,
        },
      });
    }

    return requirement;
  }

  applyExtraction(requirement = {}, extracted = {}) {
    return this.applyDiscoveryExtraction(requirement, extracted);
  }

  cancelOrder(state = {}) {
    if (state.order?._id) {
      try {
        orderRepository
          .update(state.order._id, { status: "CANCELLED" })
          .catch(() => { });
      } catch (err) { }
    }

    const cancellationMessage =
      "No problem. Your order has been cancelled. How else can I help you today?";

    const actions = [
      { id: "BROWSE_PRODUCTS", label: "Browse Products" },
      { id: "START_ORDER", label: "Start Order" },
      { id: "HUMAN_HANDOFF", label: "Talk to Expert" },
    ];

    const response = responseBuilder.build({
      workflow: "SALES",
      interaction: "BUTTONS",
      message: cancellationMessage,
      actions,
      liveRequirement: null,
      completed: true,
      metadata: { stage: "CANCELLED", cancelled: true },
      currentStep: null,
      nextStep: null,
    });

    return {
      ...state,
      completed: false,
      workflow: "NONE",
      currentStep: null,
      awaitingDecision: false,
      liveRequirement: orderManager.reset(),
      productSales: null,
      orderContext: null,
      selectedProduct: null,
      order: {
        ...(state.order && typeof state.order.toObject === "function"
          ? state.order.toObject()
          : (state.order ?? {})),
        status: "CANCELLED",
        active: false,
      },
      workflowStack: [],
      executionPlan: [],
      currentExecutionIndex: 0,
      assistantMessage: cancellationMessage,
      response,
      persistence: {
        ...(state.persistence ?? {}),
        conversation: {
          ...(state.persistence?.conversation ?? {}),
          dirty: true,
          updatedAt: new Date(),
        },
        order: {
          ...(state.persistence?.order ?? {}),
          dirty: true,
          updatedAt: new Date(),
        },
      },
    };
  }

  confirmOrder(state = {}, requirement = {}) {
    const item =
      orderManager.getCurrentItem(requirement);

    if (!item) {
      return responseBuilder.error(
        "There is no order to confirm.",
      );
    }

    const concreteProduct =
      item.selectedProduct ??
      item.product ??
      null;

    if (!concreteProduct) {
      return responseBuilder.error(
        "Please select a product before confirming your order.",
      );
    }

    if (
      catalogService.hasRemainingFields(
        concreteProduct,
        item,
      )
    ) {
      return responseBuilder.error(
        "Please complete all product specifications before confirming.",
      );
    }

    if (
      catalogService.hasRemainingRequirements(
        concreteProduct,
        item,
      )
    ) {
      return responseBuilder.error(
        "Please complete all required specifications before confirming.",
      );
    }

    const artwork = item.workflow?.artwork ?? null;

    const hasArtworkRequirement =
      artwork === "have_artwork" ||
      artwork?.value === "have_artwork" ||
      artwork?.type === "have_artwork";

    const artworkUploaded =
      artwork?.status === "UPLOADED";

    if (hasArtworkRequirement && !artworkUploaded) {
      return {
        ...state,

        workflow: "SALES",

        currentStep: "WAITING_FOR_ARTWORK",
        nextStep: null,

        awaitingDecision: true,
        completed: false,
        confirmed: false,
        orderConfirmed: false,

        liveRequirement: requirement,
        productSales: requirement,
        order: requirement,
        orderContext: requirement,

        assistantMessage:
          "Please upload your print-ready artwork here on WhatsApp before confirming the order.",

        response: responseBuilder.build({
          workflow: "SALES",
          interaction: "MESSAGE",

          message:
            "Please upload your print-ready artwork here on WhatsApp before confirming the order.",

          liveRequirement: requirement,

          completed: false,

          currentStep: "WAITING_FOR_ARTWORK",
          nextStep: null,

          context: {
            action: "WAITING_FOR_ARTWORK",
          },
        }),
      };
    }

    requirement =
      orderManager.updateCurrentItem(
        requirement,
        {
          reviewCompleted: true,
          confirmClicked: true,
          confirmed: true,
          completed: true,
          orderConfirmed: true,
        },
      );

    requirement.reviewCompleted = true;
    requirement.confirmClicked = true;
    requirement.confirmed = true;
    requirement.completed = true;
    requirement.orderConfirmed = true;
    requirement.status = "CONFIRMED";
    requirement = orderManager.generateOrderNumber(requirement);

    const completedOrder = requirement;

    const message =
      `Thank you! Your order has been confirmed (${requirement.orderNumber}). Our sales team will contact you shortly.`;

    return {
      ...state,

      workflow: "SALES",

      currentStep: "ORDER_COMPLETED",
      nextStep: null,

      completed: true,
      confirmed: true,
      orderConfirmed: true,

      awaitingDecision: false,

      liveRequirement: completedOrder,
      productSales: completedOrder,
      order: completedOrder,
      orderContext: completedOrder,

      assistantMessage: message,

      response: responseBuilder.build({
        workflow: "SALES",
        interaction: "MESSAGE",

        message,

        liveRequirement: completedOrder,

        completed: true,

        currentStep: "ORDER_COMPLETED",
        nextStep: null,

        context: {
          action: "ORDER_COMPLETED",
          order: completedOrder,
        },
      }),
    };
  }

  async handleConversationalEdit(state = {}, requirement = {}) {
    requirement = this.applyAction(requirement, { id: "EDIT_ORDER" });
    const decision = conversationDecisionService.decide(requirement);
    const response = await this.buildConversationResponse(
      requirement,
      decision,
      "",
    );
    return {
      ...response,
      response,
      liveRequirement: requirement,
      workflow: "SALES",
      completed: false,
      currentStep: decision.type,
      nextStep: decision.nextStep ?? null,
    };
  }

  // CONVERSATIONAL DECISIONS

  isConversationDecision(type) {
    return [
      DecisionTypes.SELECT_PRODUCT,
      DecisionTypes.RECOMMEND_SELECTION,
      DecisionTypes.SELECT_SELECTION,
      "SELECT_NESTED_PRODUCT",
      "PRODUCT_DETAILS",
      "UNKNOWN_PRODUCT",
      DecisionTypes.COLLECT_PRODUCT_FIELD,
      DecisionTypes.COLLECT_REQUIREMENT,
      DecisionTypes.SELECT_ADDONS,
      DecisionTypes.SELECT_DELIVERY_METHOD,
      DecisionTypes.REVIEW_ORDER,
      DecisionTypes.ORDER_REVIEW,
      DecisionTypes.COMPLETE_ORDER,
      DecisionTypes.CONFIRM_ORDER,
      DecisionTypes.CANCEL_ORDER,
      DecisionTypes.EDIT_ORDER,
      "ORDER_REVIEW",
      "REVIEW_ORDER",
      "ORDER_COMPLETED",
      "SELECT_DELIVERY_METHOD",
      "COLLECT_PRODUCT_FIELD",
      "COLLECT_REQUIREMENT",
      "SELECT_ADDONS",
    ].includes(type);
  }

  // CONVERSATION RESPONSE

  async buildConversationResponse(
    requirement = {},
    decision = {},
    userMessage = "",
  ) {
    const response = await this.generateConversation(
      requirement,
      decision,
      userMessage,
    );

    const currentItem = orderManager.getCurrentItem(requirement);

    let product = null;
    let selection = null;
    let recommendation = null;
    let options = [];

    if (currentItem?.product?.id) {
      product = catalogService.getProduct(currentItem.product.id);

      if (product && currentItem.selection?.id) {
        selection = catalogService.getSelectionOption(
          product,
          currentItem.selection.id,
        );
      }

      if (product) {
        recommendation = catalogService.getRecommendedSelection(product);

        options = catalogService.getSelectionOptions(product);

        if (currentItem.selection?.id) {
          const currentSelection = catalogService.getSelectionOption(
            product,
            currentItem.selection.id,
          );

          if (currentSelection && Array.isArray(currentSelection.products)) {
            options = currentSelection.products;
          }
        }
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

    return this.buildResponse(
      {
        ...response,

        context: decision.context ?? null,
      },

      requirement,

      {
        completed: false,

        workflow: "SALES",

        metadata: {
          stage: decision.type,

          product,

          recommendation,

          selection,

          options,

          order: requirement,

          recommendations: {
            relatedProducts,

            frequentlyBoughtTogether,

            similarProducts,
          },
        },
      },
    );
  }

  // LLM / DETERMINISTIC CONVERSATION

  async generateConversation(
    requirement = {},
    decision = {},
    userMessage = "",
  ) {
    const isDeterministicDecision = [
      DecisionTypes.SELECT_PRODUCT,
      DecisionTypes.SELECT_SELECTION,
      "SELECT_NESTED_PRODUCT",
      "PRODUCT_DETAILS",
      "START_ORDER",
      "BROWSE_PRODUCTS",
      "UNKNOWN_PRODUCT",
      "SHOW_SELECTIONS",
      "COLLECT_PRODUCT_FIELD",
      "COLLECT_REQUIREMENT",
      "SELECT_ADDONS",
      "SELECT_DELIVERY_METHOD",
      "ORDER_REVIEW",
      "REVIEW_ORDER",
      DecisionTypes.COLLECT_PRODUCT_FIELD,
      DecisionTypes.COLLECT_REQUIREMENT,
      DecisionTypes.SELECT_ADDONS,
      DecisionTypes.SELECT_DELIVERY_METHOD,
      DecisionTypes.REVIEW_ORDER,
      DecisionTypes.ORDER_REVIEW,
    ].includes(decision.type);

    const context = contextBuilder.build(requirement, decision, userMessage);

    // FAST PATH: Deterministic catalog actions bypass LLM completely
    if (isDeterministicDecision) {
      console.log(`[WhatsApp][FastPath] action=${decision.type}`);
      const productId =
        decision.context?.product?.id ||
        decision.context?.selectedProduct?.id ||
        orderManager.getCurrentItem(requirement)?.product?.id ||
        null;
      if (productId) {
        console.log(`[WhatsApp][Catalog] productId=${productId} resolved=true`);
      }
      console.log(`[WhatsApp][Response] generatedWithoutLLM=true`);

      const response = conversationService.generateDeterministic(
        context,
        decision,
      );
      return this.normalizeConversationResponse(response);
    }

    let response;

    try {
      if (decision.type === "RECOMMEND_SELECTION") {
        response = await conversationService.generate(context, decision);
      } else {
        response = conversationService.generateDeterministic(context, decision);
      }
    } catch (error) {
      console.error("Conversation Generation Failed:", error);
      response = conversationService.generateDeterministic(context, decision);
    }

    return this.normalizeConversationResponse(
      response ?? this.conversationFallback(),
    );
  }

  //NORMALIZE RESPONSE

  normalizeConversationResponse(response = {}) {
    return {
      message: response.message?.trim() ?? "",

      interaction: response.interaction === "BUTTONS" ? "BUTTONS" : "MESSAGE",

      actions: Array.isArray(response.actions) ? response.actions : [],

      sections: Array.isArray(response.sections) ? response.sections : [],

      context: response.context ?? null,
    };
  }

  // RESPONSE BUILDER

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

      context: response.context ?? null,
    });
  }

  //FALLBACK
  conversationFallback() {
    return {
      message:
        "I'd be happy to help with your printing requirements. Tell me what you'd like to print, and I'll recommend the best option for you.",

      interaction: "MESSAGE",

      actions: [],

      sections: [],

      context: null,
    };
  }
}
