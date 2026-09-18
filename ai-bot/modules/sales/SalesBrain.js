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
import SalesHandoffService from "./services/SalesHandoffService.js";

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
const salesHandoffService = new SalesHandoffService();

export default class SalesBrain {
  async execute(state = {}) {
    let requirement = orderManager.createRequirement(
      state.liveRequirement ?? state.order ?? state.orderContext ?? null,
    );

    const userMessage = (
      state.userMessage ?? (state.action?.id ? "" : (state.message ?? ""))
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
        /^(cancel|cancel order|cancelled|canceling|i want to cancel|please cancel|cancel please|stop|restart|start over|start again|reset|quit|exit|nevermind|i don't want this anymore|i dont want this anymore)$/i.test(
          rawUserMsg,
        ) ||
        /\b(cancel order|cancel my order|cancel the order|i want to cancel|please cancel|stop order|restart bot|restart chat)\b/i.test(
          rawUserMsg,
        );

      if (isCancellation) {
        return this.cancelOrder(state);
      }

      // COMPLETED ORDER GUARD: If previously completed or cancelled, start clean new order on next message
      if (
        state.currentStep === "ORDER_COMPLETED" ||
        state.completed === true ||
        requirement.completed === true
      ) {
        requirement = orderManager.reset();
        state = {
          ...state,
          currentStep: null,
          nextStep: null,
          completed: false,
          confirmed: false,
          orderConfirmed: false,
          liveRequirement: null,
          selectedProduct: null,
          product: null,
          productId: null,
          selection: null,
          selectionId: null,
          fields: null,
          requirements: null,
          addons: null,
          delivery: null,
          action: state.action ?? null,
          message: state.userMessage
            ? state.userMessage
            : state.action?.id
              ? null
              : state.message,
        };
      }

      // PRIORITY 2: NEW PRODUCT INTENT (checked before current step processing)
      if (userMessage && !state.action?.id) {
        const extracted = extractor.extract(
          requirement,
          userMessage,
          state.currentStep,
        );

        if (extracted.isNewProduct && extracted.product) {
          const currentItem = orderManager.getCurrentItem(requirement);
          const currentProd = currentItem?.product?.id
            ? catalogService.getProduct(currentItem.product.id)
            : null;
          const currentParentId =
            currentProd?.parentProductId ??
            currentItem?.product?.parentProductId ??
            currentItem?.selectedProduct?.parentProductId ??
            null;
          const currentRootId =
            currentParentId ??
            currentItem?.productId ??
            currentItem?.product?.id ??
            null;
          const extractedRootId =
            extracted.product?.parentProductId ??
            extracted.product?.productId ??
            extracted.product?.id ??
            null;

          const isSameRootProduct = Boolean(
            (currentRootId &&
              extractedRootId &&
              String(currentRootId).toLowerCase() ===
              String(extractedRootId).toLowerCase()) ||
            (currentItem?.product?.id &&
              extractedRootId &&
              String(currentItem.product.id).toLowerCase() ===
              String(extractedRootId).toLowerCase()) ||
            (currentParentId &&
              extractedRootId &&
              String(currentParentId).toLowerCase() ===
              String(extractedRootId).toLowerCase()),
          );

          if (!isSameRootProduct) {
            console.log("[SalesBrain] NEW_PRODUCT_INTENT_DETECTED:", {
              interruptedProduct: currentRootId ?? currentItem?.product?.id,
              newProduct: extractedRootId ?? extracted.product.id,
            });

            requirement = orderManager.reset();
            requirement = this.selectProduct(
              requirement,
              extracted.product.id ??
              extracted.product.productId ??
              extracted.product.slug,
            );

            if (extracted.categoryProducts?.length) {
              requirement.discoveryMatches = extracted.categoryProducts;
            }
          }
        }
      }

      /*
       * ARTWORK MEDIA
       *
       * Artwork is handled as a normal WhatsApp attachment.
       * No form state is involved.
       */
      if (Array.isArray(state.attachments) && state.attachments.length > 0) {
        const updated = orderManager.applyArtworkAttachments(
          requirement,
          state.attachments,
        );

        if (updated !== requirement) {
          requirement = updated;

          const artwork = orderManager.getWorkflowField(requirement, "artwork");

          if (
            artwork?.status === "UPLOADED" &&
            state.currentStep === "WAITING_FOR_ARTWORK"
          ) {
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

        if (actionId === "ORDER_NOW" || actionId === DecisionTypes.ORDER_NOW) {
          const productId = state.action.payload?.productId ?? null;
          const selectionId = state.action.payload?.selectionId ?? null;

          const currentItem = orderManager.getCurrentItem(requirement);

          if (!productId || catalogService.isSelectionOption(productId)) {
            console.warn(
              `[SalesBrain] ORDER_NOW rejected: invalid/selection productId ${productId}`,
            );
            return {
              ...state,
              workflow: "SALES",
              currentStep: "ERROR",
              nextStep: null,
              awaitingDecision: true,
              liveRequirement: requirement,
              assistantMessage:
                "That option is no longer available. Please choose the product again.",
              response: responseBuilder.error(
                "That option is no longer available. Please choose the product again.",
              ),
            };
          }

          // Authoritative catalog check for parent product
          const canonicalProduct =
            catalogService.getTopLevelProduct(productId) ??
            (currentItem?.product?.id === productId
              ? currentItem.product
              : null) ??
            catalogService.getProduct(productId);

          if (!canonicalProduct) {
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
                "That option is no longer available. Please choose the product again.",
              response: responseBuilder.error(
                "That option is no longer available. Please choose the product again.",
              ),
            };
          }

          // If selectionId is provided, validate that selection belongs to this parent product
          if (selectionId) {
            const validSelection = catalogService.getSelectionOption(
              canonicalProduct,
              selectionId,
            );
            if (!validSelection) {
              console.warn(
                `[SalesBrain] ORDER_NOW rejected: invalid selectionId ${selectionId} for productId ${productId}`,
              );
              return {
                ...state,
                workflow: "SALES",
                currentStep: "ERROR",
                nextStep: null,
                awaitingDecision: true,
                liveRequirement: requirement,
                assistantMessage:
                  "That option is no longer available. Please choose the product again.",
                response: responseBuilder.error(
                  "That option is no longer available. Please choose the product again.",
                ),
              };
            }
          } else {
            // If product requires selection options and none provided, check if currentItem already resolved one
            const options = catalogService.getSelectionOptions(canonicalProduct);
            if (
              options.length > 0 &&
              (!currentItem?.selection?.id ||
                !catalogService.getSelectionOption(
                  canonicalProduct,
                  currentItem.selection.id,
                ))
            ) {
              console.warn(
                `[SalesBrain] ORDER_NOW rejected: missing required selection for productId ${productId}`,
              );
              return {
                ...state,
                workflow: "SALES",
                currentStep: "ERROR",
                nextStep: null,
                awaitingDecision: true,
                liveRequirement: requirement,
                assistantMessage:
                  "Please select an option before placing your order.",
                response: responseBuilder.error(
                  "Please select an option before placing your order.",
                ),
              };
            }
          }

          // Check for stale action across different products
          const currentProdId = currentItem?.product?.id ?? null;
          if (
            currentProdId &&
            currentProdId !== canonicalProduct.id &&
            currentItem?.orderStarted
          ) {
            console.warn(
              `[SalesBrain] ORDER_NOW rejected: stale action for product ${productId} while active order is ${currentProdId}`,
            );
            return {
              ...state,
              workflow: "SALES",
              currentStep: "ERROR",
              nextStep: null,
              awaitingDecision: true,
              liveRequirement: requirement,
              assistantMessage:
                "That option is no longer available. Please choose the product again.",
              response: responseBuilder.error(
                "That option is no longer available. Please choose the product again.",
              ),
            };
          }
        }

        requirement = this.applyAction(requirement, state.action);

        if (actionId === "SET_CUSTOMER_FIELD") {
          return this.handleCustomerFieldAction(
            state,
            requirement,
            state.action,
          );
        }

        if (
          actionId === "CONFIRM_ORDER" ||
          actionId === DecisionTypes.CONFIRM_ORDER
        ) {
          if (state.currentStep === "COLLECT_CUSTOMER") {
            return await this.promptNextCustomerField(state, requirement);
          }
          return await this.confirmOrder(state, requirement);
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
          return await this.handleConversationalEdit(state, requirement);
        }
      }

      // Natural language customer collection input
      if (state.currentStep === "COLLECT_CUSTOMER") {
        return this.handleConversationalCustomerInput(
          state,
          requirement,
          userMessage,
        );
      }

      // Natural language order confirmation on review step
      const isConfirmation =
        (state.currentStep === "REVIEW_ORDER" ||
          state.currentStep === "ORDER_REVIEW") &&
        /^(confirm|confirm order|yes|yes please|place order|place the order|i want to place the order|proceed|i confirm)$/i.test(
          userMessage.trim(),
        );

      if (isConfirmation) {
        return await this.confirmOrder(state, requirement);
      }

      /*
       * NATURAL LANGUAGE SALES INPUT
       *
       * Everything after product selection is conversational.
       */
      const currentItem = orderManager.getCurrentItem(requirement);

      const rawMsg = userMessage.toLowerCase();

      const isPureGreeting = GREETING_PATTERNS.some((pattern) =>
        pattern.test(rawMsg),
      );

      if (isPureGreeting && !currentItem?.product?.id) {
        const greetingResponse = responseBuilder.build({
          workflow: "SALES",
          interaction: "MESSAGE",
          message:
            "Hello! Welcome to Deluxe Printing. How can we help you today with your printing needs?",
          liveRequirement: null,
          completed: false,
          currentStep: DecisionTypes.START_ORDER,
          nextStep: null,
          context: {
            action: DecisionTypes.START_ORDER,
          },
        });

        return {
          ...state,
          ...greetingResponse,
          response: greetingResponse,
          workflow: "SALES",
          currentStep: DecisionTypes.START_ORDER,
          nextStep: null,
          completed: false,
          awaitingDecision: true,
          liveRequirement: null,
          productSales: null,
          order: null,
          orderContext: null,
          productId: null,
          selectedProductId: null,
          selectedProduct: null,
        };
      }

      if (isPureGreeting && currentItem?.product?.id) {
        console.log(
          "[WhatsApp][Greeting] activeWorkflow=SALES preservedWorkflow=true",
        );

        const decision = conversationDecisionService.decide(requirement);

        const response = await this.buildConversationResponse(
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
      if (
        !state.action?.id &&
        userMessage &&
        (state.currentStep === "SELECT_SELECTION" ||
          state.currentStep === DecisionTypes.SELECT_SELECTION)
      ) {
        const prod = catalogService.getProduct(currentItem?.product?.id);
        const options = catalogService.getSelectionOptions(prod);
        const matched = fieldResolver.resolveSelect({ options }, userMessage);
        if (matched) {
          requirement = this.applySelectionAction(requirement, {
            id: "SELECT_SELECTION",
            payload: { productId: prod.id, selectionId: matched },
          });
        }
      } else if (
        !state.action?.id &&
        userMessage &&
        state.currentStep === "SELECT_NESTED_PRODUCT"
      ) {
        const prod = catalogService.getProduct(currentItem?.product?.id);
        const selection = catalogService.getSelectionOption(
          prod,
          currentItem?.selection?.id,
        );
        const options = (selection?.products || []).map((p) => ({
          id: p.id,
          label: p.name,
          value: p.id,
        }));
        const matched = fieldResolver.resolveSelect({ options }, userMessage);
        if (matched) {
          requirement = this.applyNestedProductAction(requirement, {
            id: "SELECT_NESTED_PRODUCT",
            payload: {
              productId: prod.id,
              selectionId: selection.id,
              nestedProductId: matched,
            },
          });
        }
      } else if (
        !state.action?.id &&
        userMessage &&
        state.currentStep === "PRODUCT_DETAILS"
      ) {
        if (
          /^(order now|order|buy|yes|proceed|continue|confirm)$/i.test(
            userMessage.trim(),
          )
        ) {
          const prodId =
            currentItem?.selectedProduct?.id ?? currentItem?.product?.id;
          requirement = this.applyOrderNowAction(requirement, {
            id: "ORDER_NOW",
            payload: { productId: prodId },
          });
        }
      } else if (state.action?.id === "SELECT_NESTED_PRODUCT") {
        // Explicit nested product selection is continuation of existing flow; skip re-extracting natural language message.
      } else if (currentItem?.orderStarted === true) {
        const concreteProduct =
          currentItem.selectedProduct ?? currentItem.product ?? null;

        let resolvedAny = false;

        if (concreteProduct) {
          // 1. DELIVERY ADDRESS
          if (
            (state.currentStep === "DELIVERY_ADDRESS" ||
              state.currentStep === "ASK_DELIVERY_ADDRESS" ||
              state.currentStep === DecisionTypes.DELIVERY_ADDRESS) &&
            userMessage?.trim()
          ) {
            const addr = userMessage.trim();

            requirement.delivery = {
              ...(requirement.delivery ?? {}),
              method: "delivery",
              address: addr,
            };

            requirement = orderManager.updateCurrentItem(requirement, {
              delivery: {
                ...(currentItem.delivery ?? {}),
                method: "delivery",
                address: addr,
              },
              workflow: {
                ...(currentItem.workflow ?? {}),
                deliveryMethod: "delivery",
                deliveryAddress: addr,
                address: addr,
              },
              productData: {
                ...(currentItem.productData ?? {}),
                deliveryMethod: "delivery",
                deliveryAddress: addr,
                address: addr,
              },
            });

            resolvedAny = true;
          }

          // 2. DELIVERY DATE
          if (
            !resolvedAny &&
            (state.currentStep === "DELIVERY_DATE" ||
              state.currentStep === "ASK_DELIVERY_DATE" ||
              state.currentStep === DecisionTypes.DELIVERY_DATE) &&
            userMessage?.trim()
          ) {
            const resolvedDate = extractor.resolveDeliveryDate(userMessage);

            if (resolvedDate) {
              requirement.delivery = {
                ...(requirement.delivery ?? {}),
                method: requirement.delivery?.method ?? "delivery",
                requiredDate: resolvedDate,
              };

              requirement = orderManager.updateCurrentItem(requirement, {
                delivery: {
                  ...(currentItem.delivery ?? {}),
                  requiredDate: resolvedDate,
                },
                workflow: {
                  ...(currentItem.workflow ?? {}),
                  deliveryDate: resolvedDate,
                  requiredDate: resolvedDate,
                },
                productData: {
                  ...(currentItem.productData ?? {}),
                  deliveryDate: resolvedDate,
                  requiredDate: resolvedDate,
                },
              });

              resolvedAny = true;
            }
          }

          // 3. ARTWORK (Media Attachment or Design Help)
          const attachments =
            state.attachments ??
            state.incoming?.attachments ??
            state.whatsapp?.attachments ??
            [];

          if (
            !resolvedAny &&
            (state.currentStep === "ARTWORK" ||
              state.currentStep === "COLLECT_ARTWORK" ||
              state.currentStep === DecisionTypes.ARTWORK ||
              attachments.length > 0)
          ) {
            if (attachments.length > 0) {
              const att = attachments[0];
              const artworkMeta = {
                received: true,
                mediaId: att.mediaId || "media_uploaded",
                fileName:
                  att.filename ||
                  att.storedFilename ||
                  att.originalFilename ||
                  "artwork",
                mimeType: att.mimeType || "application/octet-stream",
                size: att.size || att.fileSize || 0,
                storagePath: att.path || null,
                storageUrl: att.url || null,
                receivedAt: new Date().toISOString(),
              };

              requirement = orderManager.updateCurrentItem(requirement, {
                artwork: artworkMeta,
                artworkReceived: true,
                workflow: {
                  ...(currentItem.workflow ?? {}),
                  artwork: true,
                  artworkReceived: true,
                  designRequired: "have_artwork",
                },
                productData: {
                  ...(currentItem.productData ?? {}),
                  artwork: artworkMeta,
                  artworkReceived: true,
                },
              });
              resolvedAny = true;
            } else if (
              userMessage &&
              /\b(need design|design service|design required|create design|help with (the )?design|design help)\b/i.test(
                userMessage,
              )
            ) {
              requirement = orderManager.updateCurrentItem(requirement, {
                workflow: {
                  ...(currentItem.workflow ?? {}),
                  designRequired: "need_design",
                  artworkHelp: true,
                },
                productData: {
                  ...(currentItem.productData ?? {}),
                  designRequired: "need_design",
                  artworkHelp: true,
                },
              });
              resolvedAny = true;
            } else if (
              state.currentStep === "ARTWORK" ||
              state.currentStep === "COLLECT_ARTWORK" ||
              state.currentStep === DecisionTypes.ARTWORK
            ) {
              // Customer typed text during ARTWORK step without sending media or asking for design help
              // Keep ARTWORK step active and prevent generic product discovery
              resolvedAny = true;
            }
          }

          // 4. PRODUCT FIELDS
          if (!resolvedAny && userMessage) {
            const fields = catalogService.getProductFields(
              concreteProduct,
              currentItem,
            );

            const currentField = catalogService.getCurrentField(
              concreteProduct,
              currentItem,
            );
            const isSingleOrdinalOrIndex =
              currentField &&
              /^(1st|2nd|3rd|4th|5th|6th|7th|8th|9th|10th|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|\d+)$/i.test(
                userMessage.trim(),
              );

            if (isSingleOrdinalOrIndex) {
              const value = fieldResolver.resolveField(
                currentField,
                userMessage,
              );
              if (value != null) {
                if (
                  currentField.mapsTo === "delivery.method" ||
                  currentField.id === "deliveryMethod" ||
                  currentField.id === "delivery"
                ) {
                  requirement = this.applyDeliveryUpdate(requirement, value);
                } else {
                  requirement = this.applyFieldUpdate(
                    requirement,
                    currentField.id,
                    value,
                  );
                }
                resolvedAny = true;
              }
            } else {
              let remainingMessage = userMessage;
              for (const field of fields) {
                const value = fieldResolver.resolveField(
                  field,
                  remainingMessage,
                );

                if (value != null) {
                  if (
                    field.mapsTo === "delivery.method" ||
                    field.id === "deliveryMethod" ||
                    field.id === "delivery"
                  ) {
                    requirement = this.applyDeliveryUpdate(requirement, value);
                  } else {
                    requirement = this.applyFieldUpdate(
                      requirement,
                      field.id,
                      value,
                    );
                  }

                  resolvedAny = true;
                  remainingMessage = fieldResolver.consumeMatch(
                    field,
                    remainingMessage,
                    value,
                  );
                }
              }
            }
          }

          // 5. DELIVERY / PICKUP METHOD TEXT
          if (!resolvedAny && userMessage) {
            if (
              /\b(self[ -]?pickup|pick[ -]?up|store pickup)\b/i.test(
                userMessage,
              )
            ) {
              requirement = this.applyDeliveryUpdate(requirement, "pickup");

              resolvedAny = true;
            } else if (
              /\b(delivery|deliver|shipping|ship to)\b/i.test(userMessage) &&
              state.currentStep !== "DELIVERY_ADDRESS" &&
              state.currentStep !== "DELIVERY_DATE"
            ) {
              requirement = this.applyDeliveryUpdate(requirement, "delivery");

              resolvedAny = true;
            }
          }

          // 6. PRODUCT REQUIREMENTS
          if (!resolvedAny && userMessage) {
            const currentReq = catalogService.getCurrentRequirement(
              concreteProduct,
              currentItem,
            );
            if (currentReq) {
              const text = userMessage.trim().toLowerCase();
              if (text === "skip" && currentReq.required === false) {
                requirement = this.applyRequirementUpdate(
                  requirement,
                  currentReq.id,
                  "skipped",
                );
                resolvedAny = true;
              } else if (
                currentReq.id === "designRequired" ||
                currentReq.id === "artwork"
              ) {
                if (
                  /\b(have artwork|ready artwork|my artwork|own design)\b/i.test(
                    userMessage,
                  )
                ) {
                  requirement = this.applyRequirementUpdate(
                    requirement,
                    currentReq.id,
                    "have_artwork",
                  );
                  resolvedAny = true;
                } else if (
                  /\b(need design|design service|design required|create design)\b/i.test(
                    userMessage,
                  )
                ) {
                  requirement = this.applyRequirementUpdate(
                    requirement,
                    currentReq.id,
                    "need_design",
                  );
                  resolvedAny = true;
                }
              } else if (currentReq.options?.length) {
                const matchedOpt = currentReq.options.find(
                  (opt) =>
                    String(opt.value ?? opt.id).toLowerCase() === text ||
                    String(opt.label ?? opt.name).toLowerCase() === text,
                );
                if (matchedOpt) {
                  requirement = this.applyRequirementUpdate(
                    requirement,
                    currentReq.id,
                    matchedOpt.value ?? matchedOpt.id,
                  );
                  resolvedAny = true;
                }
              } else {
                requirement = this.applyRequirementUpdate(
                  requirement,
                  currentReq.id,
                  userMessage.trim(),
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
          const extracted = extractor.extract(
            requirement,
            userMessage,
            state.currentStep,
          );

          if (extracted.isNewProduct && extracted.product) {
            const currentRootId =
              currentItem?.productId ??
              currentItem?.product?.parentProductId ??
              currentItem?.selectedProduct?.parentProductId ??
              currentItem?.product?.id ??
              null;
            const extractedRootId =
              extracted.product?.parentProductId ??
              extracted.product?.productId ??
              extracted.product?.id ??
              null;

            const isSameRootProduct = Boolean(
              currentRootId &&
              extractedRootId &&
              String(currentRootId).toLowerCase() ===
              String(extractedRootId).toLowerCase(),
            );

            if (!isSameRootProduct) {
              console.log("[SalesBrain] NEW_PRODUCT_INTENT_DETECTED:", {
                interruptedProduct: currentRootId ?? currentItem?.product?.id,
                newProduct: extractedRootId ?? extracted.product.id,
              });

              requirement = orderManager.reset();

              requirement = this.selectProduct(
                requirement,
                extracted.product.id ??
                extracted.product.productId ??
                extracted.product.slug,
              );

              if (extracted.categoryProducts?.length) {
                requirement.discoveryMatches = extracted.categoryProducts;
              }
            } else {
              requirement = this.applyDiscoveryExtraction(
                requirement,
                extracted,
              );
            }
          } else {
            requirement = this.applyDiscoveryExtraction(requirement, extracted);
          }
        }
      } else if (userMessage) {
        /*
         * PRODUCT DISCOVERY
         *
         * No form.
         */
        const extracted = extractor.extract(
          requirement,
          userMessage,
          state.currentStep,
        );

        if (extracted.isNewProduct && extracted.product) {
          const currentRootId =
            currentItem?.productId ??
            currentItem?.product?.parentProductId ??
            currentItem?.selectedProduct?.parentProductId ??
            currentItem?.product?.id ??
            null;
          const extractedRootId =
            extracted.product?.parentProductId ??
            extracted.product?.productId ??
            extracted.product?.id ??
            null;

          const isSameRootProduct = Boolean(
            currentRootId &&
            extractedRootId &&
            String(currentRootId).toLowerCase() ===
            String(extractedRootId).toLowerCase(),
          );

          if (!isSameRootProduct) {
            console.log("[SalesBrain] NEW_PRODUCT_INTENT_DETECTED:", {
              interruptedProduct: currentRootId ?? currentItem?.product?.id,
              newProduct: extractedRootId ?? extracted.product.id,
            });

            requirement = orderManager.reset();

            requirement = this.selectProduct(
              requirement,
              extracted.product.id ??
              extracted.product.productId ??
              extracted.product.slug,
            );

            if (extracted.categoryProducts?.length) {
              requirement.discoveryMatches = extracted.categoryProducts;
            }
          } else {
            requirement = this.applyDiscoveryExtraction(requirement, extracted);
          }
        } else if (
          extracted.isNewProduct &&
          extracted.categoryProducts?.length
        ) {
          const currentRootId =
            currentItem?.productId ??
            currentItem?.product?.parentProductId ??
            currentItem?.selectedProduct?.parentProductId ??
            currentItem?.product?.id ??
            null;

          const isSameRootCategory = Boolean(
            currentRootId &&
            extracted.categoryProducts.some((p) => {
              const rootId = p.parentProductId ?? p.productId ?? p.id;
              return (
                rootId &&
                String(rootId).toLowerCase() ===
                String(currentRootId).toLowerCase()
              );
            }),
          );

          if (!isSameRootCategory) {
            requirement = orderManager.reset();

            requirement.discoveryMatches = extracted.categoryProducts;
          } else {
            requirement = this.applyDiscoveryExtraction(requirement, extracted);
          }
        } else {
          requirement = this.applyDiscoveryExtraction(requirement, extracted);
        }
      }

      /*
       * SALES DECISION
       */
      const decision = conversationDecisionService.decide(requirement);

      if (!this.isConversationDecision(decision.type)) {
        return responseBuilder.error(
          `Unsupported sales decision: ${decision.type}`,
        );
      }

      /*
       * GENERATE CONVERSATIONAL RESPONSE
       */
      const response = await this.buildConversationResponse(
        requirement,
        decision,
        userMessage,
      );

      const item = orderManager.getCurrentItem(requirement);

      if (state.action?.id) {
        console.log(`[SalesAction]\nid=${state.action.id}`);
      }
      console.log(
        `[SalesStep]\ncompleted=${state.currentStep || "none"}\nnext=${decision.type}`,
      );
      console.log(`[SalesState]\ncurrentStep=${decision.type}`);

      return {
        ...response,
        response,

        liveRequirement: requirement,
        productSales: requirement,
        order: requirement,
        orderContext: requirement,
        whatsapp: state.whatsapp ?? null,
        sessionId: state.sessionId ?? null,
        visitorId: state.visitorId ?? null,
        customer:
          (state.customer && Object.values(state.customer).some(Boolean))
            ? { ...(state.customer || {}), ...(Object.fromEntries(Object.entries(requirement.customer || {}).filter(([_, v]) => v != null))) }
            : (requirement.customer ?? state.customer ?? null),

        productId: item?.productId ?? item?.product?.id ?? null,
        selectionId: item?.selectionId ?? item?.selection?.id ?? null,
        selectedProductId:
          item?.selectedProductId ?? item?.selectedProduct?.id ?? null,
        selectedProduct: item?.selectedProduct ?? null,
        selection: item?.selection ?? null,

        workflow: "SALES",
        completed:
          decision.type === DecisionTypes.ORDER_COMPLETED ||
          decision.type === "ORDER_COMPLETED",

        currentStep: decision.type,
        nextStep: decision.nextStep ?? null,

        awaitingDecision:
          decision.type !== DecisionTypes.ORDER_COMPLETED &&
          decision.type !== "ORDER_COMPLETED",
      };
    } catch (error) {
      console.error("[SalesBrain] ERROR:", error.stack || error.message);

      return responseBuilder.error(
        "I apologize, but I encountered a temporary issue while processing the request.",
        {
          interaction: "MESSAGE",
          metadata: {
            error: true,
          },
          currentStep: state.currentStep ?? null,
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
          if (fieldId === "deliveryMethod" || fieldId === "delivery") {
            requirement = this.applyDeliveryUpdate(requirement, value);
          }
          return this.applyFieldUpdate(requirement, fieldId, value);
        }

        return requirement;
      }

      case "SET_REQUIREMENT": {
        const requirementId = action.payload?.requirementId;
        const value = action.payload?.value;

        if (requirementId && value != null) {
          return this.applyRequirementUpdate(requirement, requirementId, value);
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
        const method = action.payload?.method ?? null;
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

        if (step === "quotation") {
          const item = orderManager.getCurrentItem(requirement);
          return orderManager.updateCurrentItem(requirement, {
            quotation: {
              accepted: true,
            },
            workflow: {
              ...(item?.workflow ?? {}),
              quotationAccepted: true,
            },
          });
        }

        if (step === "production") {
          const item = orderManager.getCurrentItem(requirement);
          return orderManager.updateCurrentItem(requirement, {
            production: {
              confirmed: true,
            },
            workflow: {
              ...(item?.workflow ?? {}),
              productionConfirmed: true,
            },
          });
        }

        if (step === "dispatch") {
          const item = orderManager.getCurrentItem(requirement);
          return orderManager.updateCurrentItem(requirement, {
            dispatch: {
              confirmed: true,
            },
            workflow: {
              ...(item?.workflow ?? {}),
              dispatchConfirmed: true,
            },
          });
        }

        return requirement;
      }

      case "BACK":
        return this.handleBackStep(requirement);

      case "EDIT_ORDER": {
        const currentItem = orderManager.getCurrentItem(requirement);
        return orderManager.updateCurrentItem(requirement, {
          productData: { ...(currentItem?.productData ?? {}) },
          workflow: { ...(currentItem?.workflow ?? {}) },
          delivery: { ...(currentItem?.delivery ?? {}) },
          artwork: currentItem?.artwork ?? null,
          artworkReceived: currentItem?.artworkReceived ?? false,
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

    const concreteProduct = item.selectedProduct ?? item.product ?? null;

    const field = concreteProduct
      ? catalogService.getProductField(concreteProduct, item, fieldId)
      : null;

    let value = rawValue;

    if (field) {
      if (field.type === "number" || field.type === "quantity") {
        const num = Number(value);

        if (!Number.isNaN(num)) {
          value = num;
        }
      }

      if (Array.isArray(field.options) && field.options.length > 0) {
        const matchingOpt = field.options.find(
          (option) =>
            String(option.value ?? option.id).toLowerCase() ===
            String(value).toLowerCase() ||
            String(option.label ?? option.name).toLowerCase() ===
            String(value).toLowerCase(),
        );

        if (matchingOpt) {
          value = matchingOpt.value !== undefined ? matchingOpt.value : matchingOpt.id;

          const currentQty = Number(
            item.workflow?.quantity ?? item.quantity ?? 0,
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
        } else if (field.type === "select") {
          console.warn(
            `[SalesBrain] Option ${value} not found in catalog options for field ${fieldId}`,
          );
          return requirement;
        }
      }
    }

    if (fieldId === "numberOfNames") {
      console.log(
        `[CatalogField] field=numberOfNames value=${value} source=applyFieldUpdate workflow=SALES`,
      );
    }

    let updated = orderManager.updateCurrentItem(requirement, {
      formData: {
        ...(item.formData ?? {}),
        [fieldId]: value,
      },

      workflow: {
        ...(item.workflow ?? {}),
        [fieldId]: value,
      },

      productData: {
        ...(item.formData ?? {}),
        [fieldId]: value,
      },
    });

    if (fieldId === "quantity" || field?.mapsTo === "workflow.quantity") {
      const quantity = Number(value) || 0;

      updated = orderManager.updateCurrentItem(updated, {
        quantity,

        formData: {
          ...(orderManager.getCurrentItem(updated)?.formData ?? {}),
          quantity,
        },

        workflow: {
          ...(orderManager.getCurrentItem(updated)?.workflow ?? {}),
          quantity,
        },
      });
    }

    return updated;
  }

  applyRequirementUpdate(requirement = {}, requirementId, value) {
    const item = orderManager.getCurrentItem(requirement);

    if (!item) {
      return requirement;
    }

    return orderManager.updateCurrentItem(requirement, {
      formData: {
        ...(item.formData ?? {}),
        [requirementId]: value,
      },

      workflow: {
        ...(item.workflow ?? {}),
        [requirementId]: value,
      },

      productData: {
        ...(item.productData ?? {}),
        [requirementId]: value,
      },
    });
  }

  applyDeliveryUpdate(requirement = {}, method = null) {
    const item = orderManager.getCurrentItem(requirement);

    if (!item || !method) {
      return requirement;
    }

    const isPickup =
      String(method).toLowerCase() === "pickup" ||
      String(method).toLowerCase() === "self-pickup" ||
      String(method).toLowerCase() === "self_pickup";

    const canonicalMethod = isPickup ? "pickup" : String(method).toLowerCase();

    const deliveryObj = {
      ...(item.delivery ?? {}),
      method: canonicalMethod,
      address: isPickup ? null : (item.delivery?.address ?? null),
    };

    requirement.delivery = {
      ...(requirement.delivery ?? {}),
      ...deliveryObj,
    };

    return orderManager.updateCurrentItem(requirement, {
      formData: {
        ...(item.formData ?? {}),
        deliveryMethod: canonicalMethod,
      },

      delivery: deliveryObj,

      workflow: {
        ...(item.workflow ?? {}),
        deliveryMethod: canonicalMethod,
        ...(isPickup
          ? {
            deliveryAddress: null,
            address: null,
          }
          : {}),
      },

      productData: {
        ...(item.productData ?? {}),
        deliveryMethod: canonicalMethod,
        ...(isPickup
          ? {
            deliveryAddress: null,
            address: null,
          }
          : {}),
      },
    });
  }

  handleConversationalEdit(state = {}, requirement = {}) {
    const updated = orderManager.updateCurrentItem(requirement, {
      reviewCompleted: false,
      confirmClicked: false,
      confirmed: false,
      completed: false,
      orderConfirmed: false,
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
    const item = orderManager.getCurrentItem(requirement);

    if (!item) return requirement;

    const workflow = {
      ...(item.workflow ?? {}),
    };

    const keys = Object.keys(workflow);

    if (keys.length === 0) {
      return requirement;
    }

    const lastKey = keys[keys.length - 1];

    delete workflow[lastKey];

    const productData = {
      ...(item.productData ?? {}),
    };

    delete productData[lastKey];

    return orderManager.updateCurrentItem(requirement, {
      workflow,
      productData,
      reviewCompleted: false,
      confirmClicked: false,
    });
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
    const product = catalogService.getProduct(productId);

    if (!currentItem) {
      updated = orderManager.addItem(
        requirement,
        product || {
          id: productId,
        },
      );
    } else {
      if (!product) {
        return requirement;
      }

      updated = orderManager.updateCurrentItem(requirement, {
        product,

        productId: product.id,

        selection: null,

        selectionId: null,

        selectedProduct: null,

        selectedProductId: null,

        productData: {},

        requirements: [],

        workflow: {},
      });
    }

    const item = orderManager.getCurrentItem(updated);

    const activeProduct = item?.product?.id
      ? catalogService.getProduct(item.product.id)
      : product;

    if (!activeProduct) {
      return updated;
    }

    const selections = catalogService.getSelectionOptions(activeProduct);

    // NO CATEGORY / NO VARIANT
    // Product itself is final.

    if (!Array.isArray(selections) || selections.length === 0) {
      return orderManager.updateCurrentItem(updated, {
        selectedProduct: product,

        selectedProductId: product.id,

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

    const rootProductId =
      action.payload?.productId ??
      currentItem?.productId ??
      currentItem?.product?.parentProductId ??
      currentItem?.selectedProduct?.parentProductId ??
      currentItem?.product?.id ??
      requirement.discoveryMatches?.[0]?.id ??
      requirement.discoveryMatches?.[0]?.slug ??
      null;

    if (!currentItem?.product?.id && rootProductId) {
      requirement = this.selectProduct(requirement, rootProductId);
      currentItem = orderManager.getCurrentItem(requirement);
    }

    if (!currentItem?.product?.id && !rootProductId) {
      return requirement;
    }

    const currentRootId =
      currentItem?.productId ??
      currentItem?.product?.parentProductId ??
      currentItem?.selectedProduct?.parentProductId ??
      currentItem?.product?.id ??
      null;

    const resolvedProductId =
      action.payload?.productId &&
        currentRootId &&
        String(action.payload.productId).toLowerCase() ===
        String(currentRootId).toLowerCase()
        ? currentRootId
        : (action.payload?.productId ?? currentRootId);

    const product = catalogService.getProduct(resolvedProductId);

    if (!product) {
      return requirement;
    }

    const selectionId =
      action.payload?.selectionId ??
      currentItem?.selectionId ??
      currentItem?.selection?.id ??
      null;

    if (selectionId == null) {
      return requirement;
    }

    const selection = catalogService.getSelectionOption(product, selectionId);

    if (!selection) {
      return requirement;
    }

    const nestedProductId =
      action.payload?.nestedProductId ??
      currentItem?.selectedProductId ??
      currentItem?.selectedProduct?.id ??
      null;

    if (nestedProductId == null) {
      return requirement;
    }

    const nestedProducts = Array.isArray(selection.products)
      ? selection.products
      : [];

    const nestedProduct =
      nestedProducts.find(
        (child) =>
          String(child?.id).toLowerCase() ===
          String(nestedProductId).toLowerCase() ||
          String(child?.productId).toLowerCase() ===
          String(nestedProductId).toLowerCase() ||
          String(child?.slug).toLowerCase() ===
          String(nestedProductId).toLowerCase(),
      ) ?? null;

    if (!nestedProduct) {
      return requirement;
    }

    const resolvedProduct = catalogService.resolveProduct({
      productId: nestedProduct.id,
      parentProductId: product.id,
      selectionId: selection.id,
    }) || {
      ...product,
      ...nestedProduct,
      id: nestedProduct.id,
      productId: nestedProduct.id,
      parentProductId: product.id,
      parentSelectionId: selection.id,
      parentProduct: product,
      selection,
    };

    requirement.productId = product.id;
    requirement.selectionId = selection.id;
    requirement.selectedProductId = nestedProduct.id;

    return orderManager.updateCurrentItem(requirement, {
      product: resolvedProduct,

      productId: product.id,

      selection: {
        ...selection,
        id: selection.id,
        name: selection.name ?? selection.label ?? null,
      },

      selectionId: selection.id,

      selectedProduct: resolvedProduct,

      selectedProductId: nestedProduct.id,

      orderStarted: false,

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
      product: {
        ...product,
        id: product.id,
        productId: product.id,
      },

      productId: product.id,

      selection: {
        ...selection,

        id: selection.id,

        name: selection.name ?? selection.label ?? null,
      },

      selectionId: selection.id,

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

      selectedProductId: hasNestedProducts ? null : product.id,

      // Form opens only on ORDER NOW action.

      productData: {},

      requirements: [],

      workflow: {},
    });
  }

  // ORDER NOW

  applyOrderNowAction(requirement = {}, action = {}) {
    const productId = action.payload?.productId;
    const selectionId = action.payload?.selectionId;

    if (!productId) {
      return requirement;
    }

    const topProduct =
      catalogService.getTopLevelProduct(productId) ??
      catalogService.getProduct(productId);

    if (!topProduct) {
      console.warn(
        `[SalesBrain] ORDER_NOW rejected: unknown productId ${productId}`,
      );
      return requirement;
    }

    let currentItem = orderManager.getCurrentItem(requirement);

    let selection = null;
    if (selectionId) {
      selection = catalogService.getSelectionOption(topProduct, selectionId);
      if (!selection) {
        console.warn(
          `[SalesBrain] ORDER_NOW rejected: unknown selectionId ${selectionId} for productId ${productId}`,
        );
        return requirement;
      }
    } else if (currentItem?.selection?.id) {
      selection = catalogService.getSelectionOption(
        topProduct,
        currentItem.selection.id,
      );
    }

    const concreteProduct = selection
      ? (catalogService.resolveProduct({
        parentProductId: topProduct.id,
        selectionId: selection.id,
        productId: selection.id,
      }) ?? {
        ...topProduct,
        ...selection,
        id: selection.id,
        parentProductId: topProduct.id,
        parentSelectionId: selection.id,
        name: selection.name ?? selection.label ?? topProduct.name,
      })
      : topProduct;

    if (!currentItem) {
      requirement = orderManager.addItem(requirement, {
        id: topProduct.id,
        product: topProduct,
        selectedProduct: concreteProduct,
        selection,
      });
      currentItem = orderManager.getCurrentItem(requirement);
    }

    const updated = orderManager.updateCurrentItem(requirement, {
      product: topProduct,
      productId: topProduct.id,
      selectedProduct: concreteProduct,
      selectedProductId: concreteProduct.id,
      selection: selection ?? null,
      selectionId: selection?.id ?? null,
      orderStarted: true,
      formData: {},
      productData: {},
      workflow: {},
      requirements: [],
      quantity: null,
      reviewCompleted: false,
      confirmed: false,
      confirmClicked: false,
    });

    updated.reviewCompleted = false;
    updated.confirmed = false;
    updated.confirmClicked = false;
    updated.delivery = {
      method: null,
      address: null,
      requiredDate: null,
    };

    console.log(
      `[WhatsApp][OrderNow] productId=${topProduct.id} selectionId=${selection?.id ?? "none"} orderStarted=true`,
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
    console.log("[CANCEL][Detected]");
    console.log("[CANCEL][Action] action=CANCEL_ORDER");

    /*
     * ============================================================
     * CANCEL DATABASE ORDER
     * ============================================================
     */

    const orderId = state.order?._id;

    if (orderId) {
      try {
        orderRepository
          .update(orderId, {
            status: "CANCELLED",
          })
          .catch((error) => {
            console.error(
              "[CANCEL] Failed to update order:",
              error?.message,
            );
          });
      } catch (error) {
        console.error(
          "[CANCEL] Order cancellation update failed:",
          error?.message,
        );
      }
    }

    const cancellationMessage =
      "Sure, your current order has been cancelled. What would you like to print?";

    /*
     * ============================================================
     * CLEAN CANCELLATION METADATA
     * ============================================================
     */

    const metadata = {
      stage: "CANCELLED",
      cancelled: true,

      product: null,
      productId: null,

      selectedProduct: null,
      selectedProductId: null,

      selection: null,
      selectionId: null,

      options: [],

      recommendation: null,

      recommendations: {
        relatedProducts: [],
        frequentlyBoughtTogether: [],
        similarProducts: [],
      },

      media: null,
      image: null,
      images: [],
      attachments: [],
    };

    /*
     * ============================================================
     * TEXT-ONLY RESPONSE
     * ============================================================
     */

    const response = responseBuilder.build({
      workflow: "NONE",

      interaction: "MESSAGE",

      message: cancellationMessage,

      actions: [],

      sections: [],

      context: null,

      liveRequirement: null,

      completed: false,

      metadata,

      currentStep: DecisionTypes.CANCEL_ORDER,

      nextStep: null,
    });

    /*
     * ============================================================
     * HARD RESET
     * ============================================================
     */

    return {
      ...state,

      /*
       * Input
       */
      action: null,
      message: null,
      userMessage: null,

      /*
       * Workflow
       */
      workflow: "NONE",
      currentStep: DecisionTypes.CANCEL_ORDER,
      nextStep: null,

      awaitingDecision: false,

      /*
       * Completion
       */
      completed: false,
      confirmed: false,
      orderConfirmed: false,
      leadCreated: false,

      /*
       * Requirement
       */
      liveRequirement: null,
      productSales: null,
      orderContext: null,

      /*
       * Order
       */
      order: null,

      /*
       * Customer / Lead
       */
      customer: state.customer ?? null,
      visitor: state.visitor ?? null,

      /*
       * Product
       */
      product: null,
      productId: null,

      selectedProduct: null,
      selectedProductId: null,

      selection: null,
      selectionId: null,

      /*
       * Fields
       */
      fields: null,
      requirements: null,
      addons: null,
      delivery: null,
      review: null,

      /*
       * Discovery
       */
      discoveryMatches: [],
      browseCatalog: false,

      /*
       * Media
       */
      attachments: [],
      mediaContext: null,

      /*
       * Execution
       */
      workflowStack: [],
      executionPlan: [],
      currentExecutionIndex: 0,

      /*
       * Transient execution MUST be removed.
       *
       * Otherwise SaveSessionNode can restore the old order.
       */
      transientExecution: null,

      /*
       * Response
       */
      sales: null,
      assistantMessage: cancellationMessage,
      response,

      /*
       * Metadata
       */
      metadata,

      /*
       * Preserve WhatsApp identity.
       * Remove all old media.
       */
      incoming: {
        ...(state.incoming ?? {}),
        attachments: [],
        media: null,
        mediaContext: null,
      },

      whatsapp: {
        ...(state.whatsapp ?? {}),
        attachments: [],
        media: null,
        mediaContext: null,
      },

      /*
       * Persistence
       */
      persistence: {
        ...(state.persistence ?? {}),

        conversation: {
          ...(state.persistence?.conversation ?? {}),
          dirty: true,
          updatedAt: new Date(),
        },

        order: {
          ...(state.persistence?.order ?? {}),
          dirty: false,
          updatedAt: new Date(),
        },
      },
    };
  }
  async confirmOrder(state = {}, requirement = {}) {
    const item = orderManager.getCurrentItem(requirement);

    if (!item) {
      return responseBuilder.error("There is no order to confirm.");
    }

    const concreteProduct = item.selectedProduct ?? item.product ?? null;

    if (!concreteProduct) {
      return responseBuilder.error(
        "Please select a product before confirming your order.",
      );
    }

    if (catalogService.hasRemainingFields(concreteProduct, item)) {
      return responseBuilder.error(
        "Please complete all product specifications before confirming.",
      );
    }

    if (catalogService.hasRemainingRequirements(concreteProduct, item)) {
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
      artwork?.status === "UPLOADED" ||
      item.artwork?.received === true ||
      item.artworkReceived === true ||
      Boolean(
        item.artwork?.storagePath ||
        item.artwork?.storageUrl ||
        item.artwork?.mediaId ||
        item.artwork?.fileName,
      ) ||
      item.workflow?.designRequired === "need_design" ||
      item.workflow?.artworkHelp === true;

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

    requirement = orderManager.updateCurrentItem(requirement, {
      reviewCompleted: true,
      confirmClicked: true,
      confirmed: true,
    });

    requirement.reviewCompleted = true;
    requirement.confirmClicked = true;
    requirement.confirmed = true;

    // Attach customer info from state if available
    const phone =
      state.whatsapp?.phoneNumber ||
      requirement.customer?.phone ||
      state.customer?.phone ||
      null;

    const activeCustomer = {
      ...(requirement.customer ?? {}),
      ...(state.customer ?? {}),
    };
    for (const [k, v] of Object.entries(state.customer ?? {})) {
      if (v != null) activeCustomer[k] = v;
    }
    for (const [k, v] of Object.entries(requirement.customer ?? {})) {
      if (v != null) activeCustomer[k] = v;
    }
    if (phone) activeCustomer.phone = phone;
    requirement.customer = activeCustomer;

    const workflow = catalogService.getProductWorkflow(concreteProduct);
    const updatedItem = orderManager.getCurrentItem(requirement) ?? item;
    const hasNextWorkflowStep = workflow.some(
      (step) =>
        !catalogService.isWorkflowStepCompleted(
          concreteProduct,
          updatedItem,
          step,
        ),
    );

    if (hasNextWorkflowStep) {
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

    return await this.promptNextCustomerField(state, requirement);
  }

  async promptNextCustomerField(state = {}, requirement = {}, customMessage = null) {
    const customer = requirement?.customer ?? state?.customer ?? {};
    let message = "";
    let fieldId = "name";
    let actions = [];

    if (!customer.name) {
      fieldId = "name";
      message =
        customMessage ||
        "Great! To complete your order, please enter your full name.";
    } else if (!customer.email) {
      fieldId = "email";
      const firstName =
        String(customer.name || "")
          .trim()
          .split(/\s+/)[0] || customer.name;
      message =
        customMessage ||
        `Thanks, ${firstName}! Now, please enter your email address:`;
    } else if (!customer.company) {
      fieldId = "company";
      message =
        customMessage ||
        "Company name is optional. You can enter your company name, or tap Skip.";
      actions = [
        {
          id: "SET_CUSTOMER_FIELD",
          label: "Skip",
          payload: { fieldId: "company", value: "skip" },
        },
      ];
    } else {
      return await this.finalizeOrder(state, requirement);
    }

    const phone =
      customer?.phone ||
      state.customer?.phone ||
      requirement?.customer?.phone ||
      state.whatsapp?.phoneNumber ||
      state.phone ||
      null;

    const customerObj = {
      ...(state.customer ?? {}),
      ...customer,
      phone,
      awaitingCustomerField: fieldId,
    };
    if (requirement) {
      requirement.customer = customerObj;
    }

    const response = responseBuilder.build({
      workflow: "SALES",
      interaction: actions.length > 0 ? "BUTTONS" : "MESSAGE",
      message,
      actions,
      liveRequirement: requirement,
      completed: false,
      currentStep: "COLLECT_CUSTOMER",
      nextStep: null,
      context: {
        action: "COLLECT_CUSTOMER",
        fieldId,
        customer: customerObj,
      },
    });

    return {
      ...response,
      response,
      workflow: "SALES",
      currentStep: "COLLECT_CUSTOMER",
      nextStep: null,
      completed: false,
      confirmed: false,
      orderConfirmed: false,
      awaitingDecision: true,
      liveRequirement: requirement,
      productSales: requirement,
      order: requirement,
      orderContext: requirement,
      customer: customerObj,
      message,
      assistantMessage: message,
      metadata: {
        ...(state.metadata ?? {}),
        routing: {
          capability: "sales",
          workflow: "SALES",
          step: "COLLECT_CUSTOMER",
        },
      },
    };
  }

  async finalizeOrder(state = {}, requirement = {}) {
    requirement = orderManager.updateCurrentItem(requirement, {
      reviewCompleted: true,
      confirmClicked: true,
      confirmed: true,
      completed: true,
      orderConfirmed: true,
    });

    requirement.reviewCompleted = true;
    requirement.confirmClicked = true;
    requirement.confirmed = true;
    requirement.completed = true;
    requirement.orderConfirmed = true;
    requirement.status = "CONFIRMED";
    requirement = orderManager.generateOrderNumber(requirement);

    const resolvedCustomer = {
      ...(state.customer ?? {}),
      ...(requirement.customer ?? {}),
      phone:
        requirement.customer?.phone ||
        state.customer?.phone ||
        state.whatsapp?.phoneNumber ||
        state.phone ||
        null,
    };
    requirement.customer = resolvedCustomer;

    const lead = {
      _id: `lead-${Date.now()}`,
      name: resolvedCustomer.name || null,
      emailId: resolvedCustomer.email || null,
      phoneNumber: resolvedCustomer.phone || null,
      companyName: resolvedCustomer.company || null,
      products:
        requirement.items?.map((it) => ({
          productId: it.product?.id || it.id,
          productName: it.product?.name || it.name,
        })) ?? [],
    };

    requirement.leadId = lead._id;

    const message = `Thank you! Your order details have been submitted successfully. Order number: ${requirement.orderNumber}. Our sales team will contact you regarding the quotation.`;

    console.log(`[SalesAction]\nid=CONFIRM_ORDER`);
    console.log(
      `[SalesStep]\ncompleted=${state.currentStep || "CONFIRM_ORDER"}\nnext=ORDER_COMPLETED`,
    );
    console.log(`[SalesState]\ncurrentStep=ORDER_COMPLETED`);

    const response = responseBuilder.build({
      workflow: "SALES",
      interaction: "MESSAGE",
      message,
      liveRequirement: requirement,
      completed: true,
      currentStep: "ORDER_COMPLETED",
      nextStep: null,
      context: {
        action: "ORDER_COMPLETED",
        order: requirement,
        lead,
      },
    });

    if (resolvedCustomer.phone) {
      try {
        await salesHandoffService.triggerHandoff(
          { ...state, order: requirement, customer: resolvedCustomer },
          "ORDER_CONFIRMED",
        );
      } catch (err) {
        console.warn("[SalesBrain] Sales handoff trigger skipped:", err.message);
      }
    }

    return {
      ...state,
      ...response,
      response,
      workflow: "SALES",
      currentStep: "ORDER_COMPLETED",
      nextStep: null,
      completed: true,
      confirmed: true,
      orderConfirmed: true,
      awaitingDecision: false,
      liveRequirement: requirement,
      productSales: requirement,
      selectedProduct: null,
      selectedProductId: null,
      product: null,
      productId: null,
      selection: null,
      selectionId: null,
      fields: null,
      requirements: null,
      addons: null,
      delivery: null,
      action: null,
      order: {
        ...(typeof requirement?.toObject === "function"
          ? requirement.toObject()
          : requirement),
        leadId: lead._id,
      },
      orderContext: requirement,
      customer: resolvedCustomer,
      lead,
      message,
      assistantMessage: message,
    };
  }

  handleCustomerFieldAction(state = {}, requirement = {}, action = {}) {
    const fieldId = action.payload?.fieldId;
    const rawValue = action.payload?.value;
    const currentCustomer = requirement.customer ?? state.customer ?? {};

    if (fieldId === "name") {
      const name = String(rawValue || "").trim();
      if (!name) {
        return this.promptNextCustomerField(
          state,
          requirement,
          "Please enter your name.",
        );
      }
      requirement.customer = { ...currentCustomer, name };
      return this.promptNextCustomerField(state, requirement);
    }

    if (fieldId === "email") {
      const email = String(rawValue || "").trim();
      if (!/\S+@\S+\.\S+/.test(email)) {
        return this.promptNextCustomerField(
          state,
          requirement,
          "Please enter a valid email address.",
        );
      }
      requirement.customer = { ...currentCustomer, email };
      return this.promptNextCustomerField(state, requirement);
    }

    if (fieldId === "company") {
      const company =
        String(rawValue || "")
          .trim()
          .toLowerCase() === "skip"
          ? null
          : String(rawValue || "").trim() || null;
      requirement.customer = { ...currentCustomer, company };
      return this.finalizeOrder(state, requirement);
    }

    return this.promptNextCustomerField(state, requirement);
  }

  handleConversationalCustomerInput(
    state = {},
    requirement = {},
    userMessage = "",
  ) {
    const currentCustomer = requirement.customer ?? state.customer ?? {};
    const awaitingField =
      state.customer?.awaitingCustomerField ||
      (!currentCustomer.name
        ? "name"
        : !currentCustomer.email
          ? "email"
          : "company");

    if (awaitingField === "name") {
      const name = userMessage.trim();
      if (!name) {
        return this.promptNextCustomerField(
          state,
          requirement,
          "Please enter your name.",
        );
      }
      requirement.customer = { ...currentCustomer, name };
      return this.promptNextCustomerField(state, requirement);
    }

    if (awaitingField === "email") {
      const email = userMessage.trim();
      if (!/\S+@\S+\.\S+/.test(email)) {
        return this.promptNextCustomerField(
          state,
          requirement,
          "Please enter a valid email address.",
        );
      }
      requirement.customer = { ...currentCustomer, email };
      return this.promptNextCustomerField(state, requirement);
    }

    if (awaitingField === "company") {
      const company =
        userMessage.trim().toLowerCase() === "skip"
          ? null
          : userMessage.trim() || null;
      requirement.customer = { ...currentCustomer, company };
      return this.finalizeOrder(state, requirement);
    }

    return this.promptNextCustomerField(state, requirement);
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
      DecisionTypes.DELIVERY_ADDRESS,
      "DELIVERY_ADDRESS",
      "ASK_DELIVERY_ADDRESS",
      DecisionTypes.DELIVERY_DATE,
      "DELIVERY_DATE",
      "ASK_DELIVERY_DATE",
      DecisionTypes.ARTWORK,
      "ARTWORK",
      "COLLECT_ARTWORK",
      DecisionTypes.REVIEW_ORDER,
      DecisionTypes.ORDER_REVIEW,
      DecisionTypes.COMPLETE_ORDER,
      DecisionTypes.CONFIRM_ORDER,
      DecisionTypes.CANCEL_ORDER,
      DecisionTypes.EDIT_ORDER,
      "ORDER_REVIEW",
      "REVIEW_ORDER",
      "ORDER_COMPLETED",
      DecisionTypes.ORDER_COMPLETED,
      DecisionTypes.QUOTATION,
      "QUOTATION",
      DecisionTypes.PRODUCTION,
      "PRODUCTION",
      DecisionTypes.DISPATCH,
      "DISPATCH",
      "SELECT_DELIVERY_METHOD",
      "COLLECT_PRODUCT_FIELD",
      "COLLECT_REQUIREMENT",
      "SELECT_ADDONS",
      "COLLECT_CUSTOMER",
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
      "DELIVERY_ADDRESS",
      "ASK_DELIVERY_ADDRESS",
      DecisionTypes.DELIVERY_ADDRESS,
      "DELIVERY_DATE",
      "ASK_DELIVERY_DATE",
      DecisionTypes.DELIVERY_DATE,
      "ARTWORK",
      "COLLECT_ARTWORK",
      DecisionTypes.ARTWORK,
      "ORDER_REVIEW",
      "REVIEW_ORDER",
      DecisionTypes.COLLECT_PRODUCT_FIELD,
      DecisionTypes.COLLECT_REQUIREMENT,
      DecisionTypes.SELECT_ADDONS,
      DecisionTypes.SELECT_DELIVERY_METHOD,
      DecisionTypes.REVIEW_ORDER,
      DecisionTypes.ORDER_REVIEW,
      "COLLECT_CUSTOMER",
      "ORDER_COMPLETED",
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
