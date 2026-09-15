/**
 * WhatsAppFlowBuilder.js
 *
 * Single generic WhatsApp Flow builder.
 *
 * Produces native WhatsApp Flow JSON definitions and interactive message payloads
 * dynamically driven by the sales catalog.
 *
 * STRICT REQUIREMENT:
 * Absolutely NO hardcoded product IDs (e.g., "softcase-curved", "softcase-straight").
 * Structure is determined purely by:
 * - product.fields
 * - product.workflow
 * - product.requirements
 * - product.addons
 * - product.pricing
 */

import WhatsAppFlowFieldMapper from "./WhatsAppFlowFieldMapper.js";
import WhatsAppFlowTokenService from "../WhatsappFlowTokenService.js";
import COMMON_ORDER_FIELDS from "../../sales/services/CommonOrderFields.js";

export default class WhatsAppFlowBuilder {
  constructor(tokenService = null) {
    this.tokenService = tokenService || new WhatsAppFlowTokenService();
  }

  /**
   * Extracts all active order fields for a product without inspecting product IDs.
   *
   * @param {Object} product - Authoritative catalog product (or composite selectedProduct)
   * @param {Object} context - Optional context (liveRequirement, order, variant)
   * @returns {Array<Object>} Normalized catalog field definitions
   */
  extractCatalogFields(product = {}, context = {}) {
    if (!product || typeof product !== "object") {
      return [];
    }

    const fieldsMap = new Map();

    const addField = (field) => {
      if (!field || typeof field !== "object") return;
      const id = field.id || field.name;
      if (!id) return;
      if (!fieldsMap.has(id)) {
        fieldsMap.set(id, {
          id: String(id),
          label: field.label || field.title || field.name || id,
          type: field.type || "text",
          required: Boolean(field.required ?? false),
          options: Array.isArray(field.options) ? field.options : [],
          order: field.order ?? fieldsMap.size + 1,
          validation: field.validation || null,
          helperText:
            field.helperText || field.description || field.question || null,
          ...(field.displayAsRadio ? { displayAsRadio: true } : {}),
        });
      }
    };

    // 1. Primary product fields
    if (Array.isArray(product.fields)) {
      product.fields.forEach(addField);
    }

    // 2. Selected product / variant fields if nested
    const selectedVariant =
      context.selectedProduct ||
      context.variant ||
      product.selectedProduct ||
      null;

    if (selectedVariant && Array.isArray(selectedVariant.fields)) {
      selectedVariant.fields.forEach(addField);
    }

    // 3. Selection level fields / options (e.g. bannerType, stampShape)
    if (product.selection && Array.isArray(product.selection.fields)) {
      product.selection.fields.forEach(addField);
    }
    if (
      product.selection &&
      product.selection.id &&
      !product.selection.options?.some((o) => o.id === product.id) &&
      Array.isArray(product.selection.options) &&
      product.selection.options.length > 0
    ) {
      addField({
        id: product.selection.id,
        label: product.selection.label || product.selection.name || "Selection",
        type: "select",
        required: false,
        options: product.selection.options.map((opt) => ({
          id: opt.id,
          label: opt.name || opt.label || opt.id,
        })),
      });
    }

    // 4. Form container fields if declared
    if (product.form && Array.isArray(product.form.fields)) {
      product.form.fields.forEach(addField);
    }

    // 4.5 Common order fields (quantity, artwork, deliveryMethod, etc.) if requested
    if (context.includeCommonFields === true && Array.isArray(COMMON_ORDER_FIELDS)) {
      COMMON_ORDER_FIELDS.forEach((f) => {
        addField({
          ...f,
          required: f.id === "quantity" ? Boolean(f.required) : false,
        });
      });
    }

    // 5. Catalog-level requirements that need customer input
    if (Array.isArray(product.requirements)) {
      product.requirements.forEach((req) => {
        if (req && req.id && (req.type || req.options)) {
          addField({
            id: req.id,
            label: req.label || req.name || req.id,
            type: req.type || (Array.isArray(req.options) ? "select" : "text"),
            required: Boolean(req.required ?? false),
            options: req.options || [],
            helperText: req.description || null,
          });
        }
      });
    }

    // 6. Catalog-level addons if defined as choices
    if (Array.isArray(product.addons) && product.addons.length > 0) {
      const addonOptions = product.addons
        .filter((addon) => addon && (addon.id || addon.name))
        .map((addon) => ({
          id: String(addon.id || addon.name),
          label: `${addon.name || addon.label || addon.id}${addon.price ? ` (+AED ${addon.price})` : ""}`,
          description: addon.description || null,
        }));

      if (addonOptions.length > 0) {
        addField({
          id: "addons",
          label: "Optional Add-ons",
          type: "multiple-select",
          required: false,
          options: addonOptions,
        });
      }
    }

    // 7. Context dynamic form fields if supplied via OrderManager
    const contextForm = context.form || context.context?.form;
    if (contextForm && Array.isArray(contextForm.fields)) {
      contextForm.fields.forEach(addField);
    }

    return Array.from(fieldsMap.values()).sort(
      (a, b) => (a.order ?? 99) - (b.order ?? 99),
    );
  }

  /**
   * Builds the native WhatsApp Flow JSON definition (WhatsApp Flow specification v3.x).
   *
   * @param {Object} product - Catalog product
   * @param {Object} context - Execution context
   * @returns {Object} Flow JSON Specification
   */
  buildFlowJson(product = {}, context = {}) {
    const fields = this.extractCatalogFields(product, context);
    const screenId =
      context.screen || process.env.WHATSAPP_ORDER_FLOW_SCREEN || "ORDER_FORM";
    const productName = product.name || product.title || "Exprintmart Product";

    // Map each catalog field to a native WhatsApp Flow component
    const childrenComponents = [
      {
        type: "TextHeading",
        text: `${productName} Details`.slice(0, 60),
      },
      {
        type: "TextBody",
        text: "Please configure your specifications below to proceed with your order.",
      },
    ];

    for (const field of fields) {
      const component = WhatsAppFlowFieldMapper.mapFieldToComponent(field);
      childrenComponents.push(component);
    }

    // Submit footer
    childrenComponents.push({
      type: "Footer",
      label: context.submitLabel || "Continue Order",
      "on-click-action": {
        name: "complete",
        payload: {
          ...Object.fromEntries(fields.map((f) => [f.id, `\${form.${f.id}}`])),
        },
      },
    });

    return {
      version: "3.1",
      screens: [
        {
          id: screenId,
          title: "Order Details".slice(0, 20),
          layout: {
            type: "SingleColumnLayout",
            children: childrenComponents,
          },
          data: {
            product_id: {
              type: "string",
              __example__: product.id || "product_id",
            },
          },
        },
      ],
    };
  }

  /**
   * Builds the interactive WhatsApp Flow message payload ready for dispatch.
   *
   * @param {Object} params - Builder parameters
   * @returns {Object} WhatsApp Interactive Flow Message Payload
   */
  buildInteractiveFlowMessage({
    product = {},
    conversation = null,
    session = null,
    customer = null,
    workflow = "SALES",
    liveRequirement = null,
    order = null,
    formId = null,
    flowId = null,
    screen = null,
    cta = null,
    correlationId = null,
  } = {}) {
    const activeFlowId =
      flowId ||
      process.env.WHATSAPP_ORDER_FLOW_ID ||
      process.env.WHATSAPP_FLOW_ID ||
      null;

    if (!activeFlowId) {
      return null;
    }

    const effectiveProductId =
      product.id ||
      product.productId ||
      order?.items?.[0]?.product?.id ||
      liveRequirement?.items?.[0]?.product?.id ||
      null;

    const phoneNumber =
      customer?.phone ||
      customer?.whatsappNumber ||
      conversation?.customerWaId ||
      session?.phoneNumber ||
      (typeof session === "string" ? session.replace(/\D/g, "") : null) ||
      null;

    const sessionId =
      session?.id ||
      session?.sessionId ||
      conversation?.sessionId ||
      (phoneNumber ? `whatsapp:${phoneNumber}` : null) ||
      "session_default";

    const conversationId =
      conversation?.id ||
      conversation?._id ||
      session?.conversationId ||
      sessionId;

    const token = this.tokenService.create({
      type: "ORDER_FORM",
      sessionId,
      conversationId: String(conversationId),
      phoneNumber,
      productId: effectiveProductId,
      workflow,
      formId:
        formId ||
        (effectiveProductId
          ? `order-form-${effectiveProductId}`
          : "order-form"),
      purpose: "ORDER_FLOW",
    });

    const fields = this.extractCatalogFields(product, {
      liveRequirement,
      order,
      form: contextForm(product, liveRequirement, order),
    });

    const activeScreen =
      screen || process.env.WHATSAPP_ORDER_FLOW_SCREEN || "ORDER_FORM";
    const productName = product.name || product.title || "Product";
    const buttonCta = (cta || "Configure & Order").slice(0, 20);

    const logContext = {
      correlationId: correlationId || `flow_${Date.now().toString(36)}`,
      sessionId,
      conversationId,
      productId: effectiveProductId,
      workflow,
      fieldCount: fields.length,
      screen: activeScreen,
    };

    console.log(
      `[WhatsApp][Flow] BUILD correlationId=${logContext.correlationId} sessionId=${logContext.sessionId} productId=${logContext.productId} fieldCount=${logContext.fieldCount}`,
    );

    return {
      type: "interactive",
      interactive: {
        type: "flow",
        header: {
          type: "text",
          text: "Exprintmart",
        },
        body: {
          text: `Configure your ${productName} order specifications directly inside WhatsApp.`,
        },
        footer: {
          text: "Official Catalog Order Form",
        },
        action: {
          name: "flow",
          parameters: {
            flow_message_version: "3",
            flow_token: token,
            flow_id: activeFlowId,
            flow_cta: buttonCta,
            flow_action: "navigate",
            flow_action_payload: {
              screen: activeScreen,
              data: {
                product_id: effectiveProductId || "",
                product_name: productName,
                form_id:
                  formId ||
                  (effectiveProductId
                    ? `order-form-${effectiveProductId}`
                    : "order-form"),
                catalog_fields: fields.map((f) => ({
                  id: f.id,
                  label: f.label,
                  type: f.type,
                  required: f.required,
                  options: f.options,
                })),
              },
            },
          },
        },
      },
    };
  }
}

function contextForm(product, liveRequirement, order) {
  const req = liveRequirement || order;
  if (!req?.items?.[0]) return null;
  return req.items[0].form || null;
}
