import WhatsappActionCodec from "./WhatsappActionCodec.js";
import OrderManager from "../sales/services/OrderManager.js";
import PricingService from "../sales/services/PricingService.js";
import SalesCatalogService from "../sales/services/SalesCatalogService.js";
import {
  DELIVERY_CHARGES,
  DELIVERY_METHODS,
} from "../sales/services/DeliveryService.js";
import {
  resolveCatalogImage,
  normalizeImageUrl,
} from "../sales/helpers/CatalogHelper.js";

export { normalizeImageUrl, resolveCatalogImage };

export const BRAND_GREETING_LOGO_URL =
  "https://www.exprintmart.com/_next/static/media/exprint_logo.41b1dc5b.svg";

export default class WhatsAppResponseAdapter {
  constructor() {
    this.orderManager = new OrderManager();
    this.pricingService = new PricingService();
    this.catalogService = new SalesCatalogService();
  }

  // =====================================================
  // ADAPT RESULT TO WHATSAPP MESSAGES
  // =====================================================

  toWhatsAppMessages(result = {}) {
    const messages = [];

    // 1. Order Form (interactive controls)
    if (this.isOrderForm(result)) {
      const interactiveForm = this.buildInteractiveOrderForm(result);
      if (interactiveForm && interactiveForm.length > 0) {
        return interactiveForm;
      }
    }

    // 2. Lead Form (interactive controls)
    if (this.isLeadForm(result)) {
      const interactiveLead = this.buildInteractiveLeadForm(result);
      if (interactiveLead && interactiveLead.length > 0) {
        return interactiveLead;
      }
    }

    // 3. Extract text, actions & product image / brand asset
    const rawMessage = this.extractMessage(result);
    const formattedMessage = this.formatWhatsAppText(rawMessage);
    const actions = this.extractActions(result);
    const isGreetingMsg = this.isGreeting(result);
    const imageUrl = isGreetingMsg
      ? BRAND_GREETING_LOGO_URL
      : this.extractProductImage(result);

    // 4. Build WhatsApp interactive or media messages
    if (actions.length > 0) {
      // 1 to 3 actions -> WhatsApp Reply Buttons
      if (actions.length <= 3) {
        if (formattedMessage && formattedMessage.length <= 1024) {
          const header = imageUrl
            ? { type: "image", image: { link: imageUrl } }
            : null;

          const interactive = this.buildInteractive(
            actions,
            formattedMessage,
            header,
          );
          if (interactive) {
            messages.push(interactive);
            return messages;
          }
        }

        // Long message: send image / text first, then interactive buttons
        if (imageUrl) {
          messages.push({
            type: "image",
            image: {
              link: imageUrl,
              ...(formattedMessage && formattedMessage.length <= 1024
                ? { caption: formattedMessage }
                : {}),
            },
          });
          if (formattedMessage && formattedMessage.length > 1024) {
            messages.push({
              type: "text",
              text: { preview_url: false, body: formattedMessage },
            });
          }
        } else if (formattedMessage) {
          messages.push({
            type: "text",
            text: { preview_url: false, body: formattedMessage },
          });
        }

        const interactive = this.buildInteractive(
          actions,
          "Please choose an option:",
        );
        if (interactive) {
          messages.push(interactive);
          return messages;
        }
      } else {
        // 4 to 10 choices -> WhatsApp Interactive List
        if (imageUrl) {
          messages.push({
            type: "image",
            image: {
              link: imageUrl,
            },
          });
        }

        const interactive = this.buildInteractive(
          actions,
          formattedMessage || "Available options",
        );
        if (interactive) {
          messages.push(interactive);
          return messages;
        }
      }
    } else if (imageUrl) {
      // Standalone product presentation without actions
      messages.push({
        type: "image",
        image: {
          link: imageUrl,
          ...(formattedMessage
            ? { caption: formattedMessage.slice(0, 1024) }
            : {}),
        },
      });
      if (formattedMessage && formattedMessage.length > 1024) {
        messages.push({
          type: "text",
          text: { preview_url: false, body: formattedMessage },
        });
      }
    } else if (formattedMessage) {
      messages.push({
        type: "text",
        text: { preview_url: false, body: formattedMessage },
      });
    }

    // 5. Fallback message
    if (messages.length === 0) {
      messages.push({
        type: "text",
        text: {
          preview_url: false,
          body: "I'd be happy to help with your printing requirements. How can I assist you today?",
        },
      });
    }

    return messages;
  }

  isGreeting(result = {}) {
    return (
      result?.workflow === "GREETING" ||
      result?.response?.type === "greeting" ||
      result?.response?.data?.type === "greeting" ||
      result?.type === "greeting" ||
      result?.currentStep === "GREETING" ||
      result?.metadata?.stage === "GREETING"
    );
  }

  // =====================================================
  // EXTRACT PRODUCT IMAGE
  // =====================================================

  extractProductImage(result = {}) {
    if (
      this.isOrderForm(result) ||
      this.isLeadForm(result) ||
      result?.currentStep === "ORDER_FORM" ||
      result?.currentStep === "ORDER_COMPLETED" ||
      result?.currentStep === "WAITING_FOR_ARTWORK" ||
      result?.workflow === "FAQ" ||
      result?.workflow === "GREETING" ||
      result?.workflow === "SUPPORT" ||
      result?.success === false
    ) {
      return null;
    }

    const currentStep =
      result?.currentStep ??
      result?.response?.currentStep ??
      result?.response?.metadata?.stage ??
      result?.metadata?.stage ??
      null;

    if (currentStep === "SELECT_NESTED_PRODUCT") {
      const categoryObj =
        result?.context?.category ??
        result?.response?.context?.category ??
        result?.context?.selection ??
        result?.response?.context?.selection ??
        null;
      return resolveCatalogImage(categoryObj);
    }

    if (currentStep === "SELECT_SELECTION") {
      const productObj =
        result?.context?.product ??
        result?.response?.context?.product ??
        result?.metadata?.product ??
        result?.response?.metadata?.product ??
        null;
      if (productObj) {
        return resolveCatalogImage(productObj);
      }
      const selectedProd =
        result?.context?.selectedProduct ??
        result?.response?.context?.selectedProduct ??
        null;
      if (selectedProd) {
        return resolveCatalogImage(selectedProd);
      }
      return null;
    }

    const selectedProd =
      result?.context?.selectedProduct ??
      result?.response?.context?.selectedProduct ??
      result?.metadata?.selectedProduct ??
      result?.response?.metadata?.selectedProduct ??
      null;
    if (selectedProd) {
      const img = resolveCatalogImage(selectedProd);
      if (img) return img;
    }

    const selectionObj =
      result?.context?.selection ??
      result?.response?.context?.selection ??
      result?.metadata?.selection ??
      result?.response?.metadata?.selection ??
      null;
    if (selectionObj) {
      const img = resolveCatalogImage(selectionObj);
      if (img) return img;
    }

    const productObj =
      result?.context?.product ??
      result?.response?.context?.product ??
      result?.metadata?.product ??
      result?.response?.metadata?.product ??
      result?.response?.data?.product ??
      result?.data?.product ??
      result?.product ??
      null;
    if (productObj) {
      const img = resolveCatalogImage(productObj);
      if (img) return img;
    }

    const responseData = result?.response?.data ?? result?.data ?? {};
    if (responseData.product) {
      return resolveCatalogImage(responseData.product);
    }
    if (
      Array.isArray(responseData.products) &&
      responseData.products.length === 1
    ) {
      return resolveCatalogImage(responseData.products[0]);
    }
    if (responseData.winner) {
      return resolveCatalogImage(responseData.winner);
    }

    return null;
  }

  normalizeImageUrl(rawUrl) {
    return normalizeImageUrl(rawUrl);
  }

  resolveCatalogImage(catalogItem) {
    return resolveCatalogImage(catalogItem);
  }

  // =====================================================
  // PRODUCT CAPTION / DETAILS FORMATTER (CATALOG-DRIVEN)
  // =====================================================

  generateProductCaption(concreteItem = {}, options = {}) {
    if (!concreteItem || typeof concreteItem !== "object") return "";

    let catalogProduct = null;
    const productId =
      concreteItem.id ||
      concreteItem.productId ||
      concreteItem.slug ||
      options.id ||
      options.productId;

    if (productId && this.catalogService) {
      catalogProduct =
        this.catalogService.getProduct(productId) ??
        this.catalogService.resolveProduct({ productId, slug: productId });
    }

    const resolvedItem = catalogProduct
      ? { ...catalogProduct, ...concreteItem }
      : concreteItem;

    const productName =
      options.productName ||
      resolvedItem.name ||
      resolvedItem.productName ||
      resolvedItem.title ||
      "Product Details";

    const description =
      resolvedItem.description ||
      resolvedItem.shortDescription ||
      options.description ||
      null;

    const lines = [`*${productName}*`];
    if (description) {
      lines.push("", description);
    }

    let priceText = null;
    let deliveryText = null;
    let totalText = null;

    if (catalogProduct && this.pricingService) {
      let selection = null;
      if (resolvedItem.selection && this.catalogService) {
        selection = this.catalogService.getSelectionOption(
          catalogProduct,
          resolvedItem.selection,
        );
      }
      const calc = this.pricingService.calculateItem({
        product: catalogProduct,
        selection,
        quantity: resolvedItem.quantity || 1,
      });

      const isQuoteRequired =
        catalogProduct.pricing?.quotationRequired === true ||
        calc?.pricing?.quotationRequired === true;

      if (
        isQuoteRequired ||
        (calc?.pricing?.unitPrice == null && !catalogProduct.pricing?.price)
      ) {
        priceText = "*Price:* Quotation required";
      } else if (calc?.pricing?.unitPrice != null) {
        const unitPrice = calc.pricing.unitPrice;
        const quantity = calc.pricing.quantity || 1;
        const subtotal = calc.pricing.subtotal || unitPrice * quantity;
        const deliveryCharge =
          DELIVERY_CHARGES[DELIVERY_METHODS.DELIVERY] ?? 25;
        const totalBeforeVAT = subtotal + deliveryCharge;

        priceText = `*Price:* AED ${unitPrice}`;
        if (quantity > 1) {
          priceText += `\n*Quantity:* ${quantity}\n*Subtotal:* AED ${subtotal}`;
        }
        deliveryText = `*Delivery:* AED ${deliveryCharge}`;
        totalText = `*Total before VAT:* AED ${totalBeforeVAT}`;
      }
    }

    if (!priceText) {
      const startingPrice =
        resolvedItem.startingPrice ??
        resolvedItem.price ??
        resolvedItem.pricing?.startingPrice ??
        resolvedItem.pricing?.price ??
        options.startingPrice ??
        null;
      if (startingPrice != null) {
        priceText = `*Price:* AED ${startingPrice}`;
      }
    }

    const badge = resolvedItem.badge || options.badge || null;
    const badgeText = badge ? `Badge: ${badge}` : null;

    if (priceText || badgeText) {
      lines.push("");
      if (priceText) lines.push(priceText);
      if (deliveryText) lines.push(deliveryText);
      if (totalText) lines.push(totalText);
      if (badgeText) lines.push(badgeText);
    }

    const specs = catalogProduct?.specifications || resolvedItem.specifications;
    if (specs && typeof specs === "object") {
      const specEntries = Object.entries(specs).filter(
        ([_, v]) => v != null && v !== "",
      );
      if (specEntries.length > 0) {
        lines.push("", "*Specifications:*");
        for (const [k, v] of specEntries.slice(0, 4)) {
          const label = k
            .replace(/([A-Z])/g, " $1")
            .replace(/^./, (s) => s.toUpperCase());
          lines.push(`• *${label}*: ${Array.isArray(v) ? v.join(", ") : v}`);
        }
      }
    } else if (catalogProduct?.selection?.options?.length > 0) {
      lines.push(
        "",
        `*Available ${catalogProduct.selection.label || "Options"}:*`,
      );
      for (const opt of catalogProduct.selection.options.slice(0, 5)) {
        const optPrice =
          opt.price != null
            ? ` (AED ${opt.price})`
            : opt.startingPrice != null
              ? ` (From AED ${opt.startingPrice})`
              : "";
        lines.push(`• ${opt.name || opt.id}${optPrice}`);
      }
    }

    let caption = lines.join("\n").trim();
    if (caption.length > 1024) {
      caption = caption.slice(0, 1020) + "...";
    }
    return caption;
  }

  // =====================================================
  // EXTRACT MESSAGE TEXT
  // =====================================================

  extractMessage(result = {}) {
    const errors =
      result?.response?.context?.errors ??
      result?.context?.errors ??
      result?.sections?.[0]?.errors ??
      result?.errors ??
      null;

    if (
      errors &&
      typeof errors === "object" &&
      Object.keys(errors).length > 0
    ) {
      const errorLines = ["⚠️ *Please check the following details:*"];
      for (const [key, val] of Object.entries(errors)) {
        if (!val) continue;
        if (key === "_form") {
          errorLines.push(`• ${val}`);
        } else {
          const label = key
            .replace(/([A-Z])/g, " $1")
            .replace(/^./, (str) => str.toUpperCase())
            .trim();
          errorLines.push(`• *${label}*: ${val}`);
        }
      }
      return errorLines.join("\n");
    }

    if (
      result?.currentStep === "PRODUCT_DETAILS" ||
      result?.response?.currentStep === "PRODUCT_DETAILS"
    ) {
      const concreteItem =
        result?.context?.selectedProduct ??
        result?.response?.context?.selectedProduct ??
        result?.order?.items?.[0]?.selectedProduct ??
        result?.order?.items?.[0]?.product ??
        result?.context?.product ??
        result?.response?.context?.product ??
        null;
      if (concreteItem) {
        const caption = this.generateProductCaption(concreteItem);
        if (caption) return caption;
      }
    }

    if (
      typeof result?.response?.message === "string" &&
      result.response.message.trim()
    ) {
      return result.response.message.trim();
    }
    if (typeof result?.message === "string" && result.message.trim()) {
      return result.message.trim();
    }
    if (
      typeof result?.assistantMessage === "string" &&
      result.assistantMessage.trim()
    ) {
      return result.assistantMessage.trim();
    }
    if (
      typeof result?.whatsapp?.message === "string" &&
      result.whatsapp.message.trim()
    ) {
      return result.whatsapp.message.trim();
    }

    const responseData = result?.response?.data ?? result?.data ?? {};
    const responseType = result?.response?.type ?? result?.type;

    if (responseType === "discovery") {
      const lines = [];
      if (responseData.summary) lines.push(responseData.summary);
      if (
        Array.isArray(responseData.products) &&
        responseData.products.length > 0
      ) {
        lines.push("\n*Available Options:*");
        for (const prod of responseData.products.slice(0, 6)) {
          const name = prod.name ?? prod.title ?? prod.slug ?? "Product";
          const desc = prod.shortDescription
            ? ` - ${prod.shortDescription}`
            : "";
          lines.push(`• *${name}*${desc}`);
        }
      }
      if (responseData.followUpQuestion) {
        lines.push(`\n${responseData.followUpQuestion}`);
      }
      if (lines.length > 0) return lines.join("\n");
    }

    if (responseType === "recommendation") {
      const lines = [];
      if (responseData.summary) lines.push(responseData.summary);
      if (
        Array.isArray(responseData.recommendations) &&
        responseData.recommendations.length > 0
      ) {
        lines.push("\n*Recommendations:*");
        for (const rec of responseData.recommendations.slice(0, 6)) {
          const name = rec.name ?? rec.title ?? rec.productName ?? "Option";
          const reason = rec.reason ? ` - ${rec.reason}` : "";
          lines.push(`• *${name}*${reason}`);
        }
      }
      if (responseData.followUpQuestion) {
        lines.push(`\n${responseData.followUpQuestion}`);
      }
      if (lines.length > 0) return lines.join("\n");
    }

    if (
      result?.currentStep === "PRODUCT_DETAILS" ||
      result?.response?.currentStep === "PRODUCT_DETAILS" ||
      responseType === "product_details"
    ) {
      const concreteItem =
        result?.context?.selectedProduct ??
        result?.response?.context?.selectedProduct ??
        result?.context?.product ??
        result?.response?.context?.product ??
        result?.order?.items?.[0]?.selectedProduct ??
        result?.order?.items?.[0]?.product ??
        responseData.product ??
        null;
      if (concreteItem) {
        return this.generateProductCaption(concreteItem);
      }
      const lines = [];
      if (responseData.summary) lines.push(responseData.summary);
      if (responseData.product) {
        const p = responseData.product;
        lines.push(`\n*${p.name ?? p.title}*`);
        if (p.description) lines.push(p.description);
      }
      if (lines.length > 0) return lines.join("\n");
    }

    if (responseType === "comparison") {
      const lines = [];
      if (responseData.summary) lines.push(responseData.summary);
      if (responseData.winner?.product) {
        lines.push(`\n*Recommended Choice:* *${responseData.winner.product}*`);
        if (responseData.winner.reason) lines.push(responseData.winner.reason);
      }
      if (responseData.followUpQuestion) {
        lines.push(`\n${responseData.followUpQuestion}`);
      }
      if (lines.length > 0) return lines.join("\n");
    }

    if (responseType === "faq" || responseType === "support") {
      if (typeof responseData === "string" && responseData.trim()) {
        return responseData.trim();
      }
      if (responseData.answer) return responseData.answer;
      if (responseData.message) return responseData.message;
    }

    if (responseType === "out_of_scope") {
      const lines = [];
      if (responseData.message) lines.push(responseData.message);
      if (
        Array.isArray(responseData.suggestions) &&
        responseData.suggestions.length > 0
      ) {
        lines.push("\n*Here are a few things I can help you with:*");
        for (const sug of responseData.suggestions) {
          lines.push(`• ${sug}`);
        }
      }
      if (lines.length > 0) return lines.join("\n");
    }

    if (responseType === "lead" && responseData.response?.message) {
      return responseData.response.message;
    }

    const currentStep =
      result?.currentStep ??
      result?.response?.currentStep ??
      result?.response?.metadata?.stage ??
      result?.metadata?.stage ??
      null;

    const context = result?.context ?? result?.response?.context ?? {};

    if (currentStep === "COLLECT_PRODUCT_FIELD") {
      return (
        context?.field?.question ||
        context?.field?.label ||
        "Please choose an option:"
      );
    }

    if (currentStep === "COLLECT_REQUIREMENT") {
      return (
        context?.requirement?.instruction ||
        context?.requirement?.description ||
        context?.requirement?.name ||
        "Please provide the requested details:"
      );
    }

    if (currentStep === "SELECT_ADDONS") {
      return "Would you like to add any finishing options or addons to your order?";
    }

    if (currentStep === "SELECT_DELIVERY_METHOD") {
      return (
        context?.message || "Please select your preferred delivery method:"
      );
    }

    if (currentStep === "REVIEW_ORDER" || currentStep === "ORDER_REVIEW") {
      return (
        context?.summary ||
        context?.message ||
        "Please review your order summary below:"
      );
    }

    if (currentStep === "COLLECT_CUSTOMER") {
      return (
        result?.response?.message ||
        result?.message ||
        result?.assistantMessage ||
        context?.message ||
        "Great! To complete your order, please enter your full name."
      );
    }

    return "";
  }

  // =====================================================
  // EXTRACT ACTIONS
  // =====================================================

  extractActions(result = {}) {
    if (this.isOrderForm(result)) {
      const form =
        result?.context?.form ??
        result?.response?.context?.form ??
        result?.sections?.find((s) => s?.type === "FORM" && s?.form)?.form ??
        result?.response?.sections?.find((s) => s?.type === "FORM" && s?.form)
          ?.form ??
        result?.sections?.[0]?.form ??
        result?.response?.sections?.[0]?.form ??
        result?.form ??
        result?.response?.form ??
        (result?.liveRequirement
          ? this.orderManager.getDynamicForm(result.liveRequirement)
          : null) ??
        (result?.order ? this.orderManager.getDynamicForm(result.order) : null);

      if (form && Array.isArray(form.fields)) {
        const requirement =
          result?.liveRequirement ??
          result?.order ??
          result?.productSales ??
          {};
        const item = Array.isArray(requirement?.items)
          ? (requirement.items[requirement.currentItem ?? 0] ?? {})
          : {};
        const values = {
          ...(item.formData ?? {}),
          ...(form.values ?? {}),
          ...(result?.context?.values ?? {}),
          ...(result?.values ?? {}),
        };
        const errors =
          result?.response?.context?.errors ??
          result?.context?.errors ??
          result?.sections?.[0]?.errors ??
          result?.errors ??
          {};
        const visibleFields = form.fields.filter((f) =>
          this.isFieldVisible(f, values),
        );
        const missingFields = visibleFields.filter((f) => {
          const conditionActive =
            f.conditional || f.condition
              ? this.isFieldVisible(f, values)
              : false;
          const isRequired =
            f.required === true ||
            (f.conditionalRequired === true && conditionActive) ||
            f.validation?.required === true;
          const val = values[f.id];
          return (
            isRequired &&
            (val === undefined ||
              val === null ||
              val === "" ||
              (Array.isArray(val) && val.length === 0))
          );
        });

        let curField = null;
        const errorKey = Object.keys(errors).find((k) => k !== "_form");
        if (errorKey) {
          curField = visibleFields.find((f) => f.id === errorKey) || null;
        }
        if (!curField && missingFields.length > 0) curField = missingFields[0];

        if (
          curField &&
          [
            "select",
            "radio",
            "boolean",
            "confirmation",
            "multiselect",
            "number",
          ].includes(currentFieldType(curField)) &&
          Array.isArray(curField.options) &&
          curField.options.length > 0
        ) {
          return curField.options.slice(0, 10).map((opt) => ({
            id: "SET_FORM_FIELD",
            type: "SET_FORM_FIELD",
            label: String(opt.label || opt.name || opt.value || opt.id).trim(),
            payload: {
              formId: form.id,
              fieldId: curField.id,
              value: opt.value ?? opt.id,
            },
          }));
        } else if (!curField && missingFields.length === 0) {
          return [
            {
              id: form.submit?.action || "SUBMIT_ORDER_FORM",
              type: form.submit?.action || "SUBMIT_ORDER_FORM",
              label: form.submit?.label || "Continue",
              payload: {
                formId: form.id,
                values,
              },
            },
          ];
        } else {
          return [];
        }
      }
    }

    let actions = result?.response?.actions ?? result?.actions ?? [];
    if (!Array.isArray(actions) || actions.length === 0) {
      actions = result?.response?.data?.actions ?? result?.data?.actions ?? [];
    }

    const responseData = result?.response?.data ?? result?.data ?? {};
    const responseType = result?.response?.type ?? result?.type;

    if (
      (!actions || actions.length === 0) &&
      responseType === "discovery" &&
      Array.isArray(responseData.products)
    ) {
      actions = responseData.products.slice(0, 10).map((prod) => ({
        id: "SELECT_PRODUCT",
        type: "SELECT_PRODUCT",
        label: prod.name ?? prod.title ?? prod.slug,
        payload: { productId: prod.id ?? prod.slug },
      }));
    }

    if (
      (!actions || actions.length === 0) &&
      responseType === "recommendation" &&
      Array.isArray(responseData.recommendations)
    ) {
      actions = responseData.recommendations.slice(0, 10).map((rec) => ({
        id: "SELECT_PRODUCT",
        type: "SELECT_PRODUCT",
        label: rec.name ?? rec.title ?? rec.productName,
        payload: { productId: rec.id ?? rec.productId ?? rec.slug },
      }));
    }

    if (!Array.isArray(actions)) return [];

    return actions
      .filter((a) => a && typeof a === "object")
      .map((a) => {
        const actionId = a.id || a.type;
        const actionType = a.type || a.id;
        const label = a.label || a.title || a.name || actionId;
        return { ...a, id: actionId, type: actionType, label };
      })
      .filter((a) => Boolean(a.id));
  }

  // =====================================================
  // FORMAT WHATSAPP MARKDOWN TEXT
  // =====================================================

  formatWhatsAppText(text = "") {
    if (!text || typeof text !== "string") return "";

    return text
      .replace(/^#{1,6}\s*(.+)$/gm, "*$1*")
      .replace(/\*\*(.*?)\*\*/g, "*$1*")
      .replace(/__(.*?)__/g, "*$1*")
      .replace(/^[\*\-]\s+(.+)$/gm, "• $1")
      .replace(/<[^>]+>/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  // =====================================================
  // DETECT FORMS
  // =====================================================

  isOrderForm(result = {}) {
    const sections = result?.response?.sections ?? result?.sections ?? [];
    const hasFormSection =
      Array.isArray(sections) &&
      sections.some((s) => s?.type === "FORM" && s?.form);

    const interaction =
      result?.response?.interaction ??
      result?.interaction ??
      result?.response?.sections?.[0]?.type ??
      result?.sections?.[0]?.type ??
      null;

    const currentStep =
      result?.currentStep ??
      result?.response?.currentStep ??
      result?.metadata?.stage ??
      result?.response?.metadata?.stage ??
      null;

    const hasForm = Boolean(
      hasFormSection ||
      result?.context?.form ||
      result?.response?.context?.form ||
      result?.form ||
      result?.response?.form ||
      (result?.liveRequirement &&
        this.orderManager.isFormMode(result.liveRequirement)) ||
      (result?.order && this.orderManager.isFormMode(result.order)),
    );

    return (
      (interaction === "FORM" ||
        currentStep === "ORDER_FORM" ||
        hasFormSection) &&
      hasForm
    );
  }

  isLeadForm(result = {}) {
    const workflow = result?.workflow ?? result?.response?.workflow ?? null;
    const currentStep =
      result?.currentStep ??
      result?.response?.currentStep ??
      result?.metadata?.stage ??
      result?.response?.metadata?.stage ??
      null;
    const nextStep = result?.nextStep ?? result?.response?.nextStep ?? null;

    return (
      workflow === "LEAD" &&
      (currentStep === "COLLECT_CUSTOMER" ||
        nextStep === "SUBMIT_LEAD" ||
        currentStep === "LEAD_FORM")
    );
  }

  isFieldVisible(field = {}, values = {}) {
    if (field.ui?.hidden || field.hidden === true) return false;
    const condition = field.conditional ?? field.condition ?? null;
    if (!condition) return true;
    if (typeof condition === "function") return Boolean(condition(values));
    if (typeof condition !== "object") return true;
    const fieldId = condition.field ?? condition.when ?? condition.id;
    if (!fieldId) return true;
    const actual = values[fieldId];
    if (condition.equals !== undefined) return actual === condition.equals;
    if (condition.notEquals !== undefined)
      return actual !== condition.notEquals;
    if (Array.isArray(condition.in)) return condition.in.includes(actual);
    if (Array.isArray(condition.oneOf)) return condition.oneOf.includes(actual);
    return true;
  }

  // =====================================================
  // INTERACTIVE ORDER FORM (NORMAL WHATSAPP CONTROLS)
  // =====================================================

  buildInteractiveOrderForm(result = {}) {
    const form =
      result?.context?.form ??
      result?.response?.context?.form ??
      result?.sections?.find((s) => s?.type === "FORM" && s?.form)?.form ??
      result?.response?.sections?.find((s) => s?.type === "FORM" && s?.form)
        ?.form ??
      result?.sections?.[0]?.form ??
      result?.response?.sections?.[0]?.form ??
      result?.form ??
      result?.response?.form ??
      (result?.liveRequirement
        ? this.orderManager.getDynamicForm(result.liveRequirement)
        : null) ??
      (result?.order ? this.orderManager.getDynamicForm(result.order) : null);

    if (!form || !Array.isArray(form.fields)) return null;

    const requirement =
      result?.liveRequirement ?? result?.order ?? result?.productSales ?? {};
    const item = Array.isArray(requirement?.items)
      ? (requirement.items[requirement.currentItem ?? 0] ?? {})
      : {};

    const values = {
      ...(item.formData ?? {}),
      ...(form.values ?? {}),
      ...(result?.context?.values ?? {}),
      ...(result?.values ?? {}),
    };

    const errors =
      result?.response?.context?.errors ??
      result?.context?.errors ??
      result?.sections?.[0]?.errors ??
      result?.errors ??
      {};

    const visibleFields = form.fields.filter((field) =>
      this.isFieldVisible(field, values),
    );

    const filledFields = [];
    const missingRequiredFields = [];

    for (const field of visibleFields) {
      const conditionActive =
        field.conditional || field.condition
          ? this.isFieldVisible(field, values)
          : false;
      const isRequired =
        field.required === true ||
        (field.conditionalRequired === true && conditionActive) ||
        field.validation?.required === true;

      const val = values[field.id];
      const isFilled =
        val !== undefined &&
        val !== null &&
        val !== "" &&
        (!Array.isArray(val) || val.length > 0);

      if (isFilled) {
        filledFields.push({ field, value: val });
      } else if (isRequired) {
        missingRequiredFields.push(field);
      }
    }

    const productName =
      item.selectedProduct?.name ||
      (item.product?.name && item.product.name !== item.product.id
        ? item.product.name
        : null) ||
      form.title ||
      form.product?.name ||
      item.product?.name ||
      "Order Details";

    const formTitle = form.title || `${productName} Details`;
    const lines = [`📋 *${formTitle}*`];
    lines.push(`Product: *${productName}*`);

    if (filledFields.length > 0) {
      lines.push("\n*Completed Details:*");
      for (const { field, value } of filledFields) {
        let displayVal = value;
        if (Array.isArray(field.options)) {
          const matchedOpt = field.options.find(
            (o) => String(o.value ?? o.id) === String(value),
          );
          if (matchedOpt) {
            displayVal = matchedOpt.label || matchedOpt.name || displayVal;
          }
        }
        lines.push(
          `• *${field.label || field.name || field.id}*: ${displayVal} ✅`,
        );
      }
    }

    if (Object.keys(errors).length > 0) {
      lines.push("\n⚠️ *Please check the following details:*");
      for (const [key, msg] of Object.entries(errors)) {
        if (!msg) continue;
        if (key === "_form") {
          lines.push(`• ${msg}`);
        } else {
          const fieldObj = form.fields.find((f) => f.id === key);
          lines.push(`• *${fieldObj?.label || key}*: ${msg}`);
        }
      }
    }

    // Determine current active question
    let currentField = null;
    const errorFieldId = Object.keys(errors).find((k) => k !== "_form");
    if (errorFieldId) {
      currentField = visibleFields.find((f) => f.id === errorFieldId) || null;
    }
    if (!currentField && missingRequiredFields.length > 0) {
      currentField = missingRequiredFields[0];
    }

    if (currentField) {
      const fieldLabel =
        currentField.label || currentField.name || currentField.id;
      const questionPrompt =
        currentField.question || `Please choose ${fieldLabel}:`;

      if (filledFields.length === 0) {
        const concreteItem =
          item.selectedProduct ??
          form.selectedProduct ??
          item.selection ??
          form.variant ??
          item.product ??
          form.product ??
          {};

        const rawImage =
          resolveCatalogImage(concreteItem) ||
          resolveCatalogImage(item.product) ||
          resolveCatalogImage(form.product) ||
          null;
        const formImage = normalizeImageUrl(rawImage);
        const productCaption = this.generateProductCaption(concreteItem, {
          productName,
        });

        const messages = [];
        if (formImage) {
          messages.push({
            type: "image",
            image: { link: formImage, caption: productCaption },
          });
        } else {
          messages.push({
            type: "text",
            text: { preview_url: false, body: productCaption },
          });
        }

        const promptLines = [];
        if (Object.keys(errors).length > 0) {
          promptLines.push("⚠️ *Please check the following details:*");
          for (const [key, msg] of Object.entries(errors)) {
            if (!msg) continue;
            if (key === "_form") promptLines.push(`• ${msg}`);
            else {
              const fieldObj = form.fields.find((f) => f.id === key);
              promptLines.push(`• *${fieldObj?.label || key}*: ${msg}`);
            }
          }
        }
        promptLines.push(`👉 *${questionPrompt}*`);
        if (currentField.description)
          promptLines.push(`_${currentField.description}_`);
        if (
          currentField.type === "number" &&
          (!currentField.options || currentField.options.length === 0)
        ) {
          promptLines.push("(e.g., 5, 10, 50, 100, 500)");
        } else if (
          currentField.type === "date" ||
          currentField.type === "datetime-local"
        ) {
          promptLines.push("(YYYY-MM-DD)");
        }

        const promptText = promptLines.join("\n");
        if (
          Array.isArray(currentField.options) &&
          currentField.options.length > 0
        ) {
          const fieldActions = currentField.options.slice(0, 10).map((opt) => ({
            id: "SET_FORM_FIELD",
            type: "SET_FORM_FIELD",
            label: String(opt.label || opt.name || opt.value || opt.id).trim(),
            payload: {
              formId: form.id,
              fieldId: currentField.id,
              value: opt.value ?? opt.id,
            },
          }));
          const interactive = this.buildInteractive(
            fieldActions,
            promptText,
            null,
          );
          if (interactive) {
            messages.push(interactive);
            return messages;
          }
        }
        messages.push({
          type: "text",
          text: { preview_url: false, body: promptText },
        });
        return messages;
      }
      lines.push(`\n👉 *${questionPrompt}*`);
      if (currentField.description) {
        lines.push(`_${currentField.description}_`);
      }
      if (
        currentField.type === "number" &&
        (!currentField.options || currentField.options.length === 0)
      ) {
        lines.push("(e.g., 5, 10, 50, 100, 500)");
      } else if (
        currentField.type === "date" ||
        currentField.type === "datetime-local"
      ) {
        lines.push("(YYYY-MM-DD)");
      }

      const bodyText = lines.join("\n");
      if (
        Array.isArray(currentField.options) &&
        currentField.options.length > 0
      ) {
        const fieldActions = currentField.options.slice(0, 10).map((opt) => ({
          id: "SET_FORM_FIELD",
          type: "SET_FORM_FIELD",
          label: String(opt.label || opt.name || opt.value || opt.id).trim(),
          payload: {
            formId: form.id,
            fieldId: currentField.id,
            value: opt.value ?? opt.id,
          },
        }));

        const interactive = this.buildInteractive(fieldActions, bodyText, null);
        if (interactive) return [interactive];
      }

      return [
        {
          type: "text",
          text: { preview_url: false, body: bodyText },
        },
      ];
    }

    // All fields complete -> Submit
    lines.push("\n🎉 *All required details are complete!*");
    lines.push("Press *Continue* to confirm your order details:");

    const submitAction = {
      id: form.submit?.action || "SUBMIT_ORDER_FORM",
      type: form.submit?.action || "SUBMIT_ORDER_FORM",
      label: form.submit?.label || "Continue",
      payload: {
        formId: form.id,
        values,
      },
    };

    const interactive = this.buildInteractive(
      [submitAction],
      lines.join("\n"),
      null,
    );
    if (interactive) return [interactive];

    return [
      {
        type: "text",
        text: { preview_url: false, body: lines.join("\n") },
      },
    ];
  }

  // =====================================================
  // INTERACTIVE LEAD FORM (NORMAL WHATSAPP CONTROLS)
  // =====================================================

  buildInteractiveLeadForm(result = {}) {
    const requirement =
      result?.liveRequirement ?? result?.order ?? result?.orderContext ?? {};
    const customer = {
      ...(result?.customer ?? {}),
      ...(result?.visitor ?? {}),
      ...(requirement?.customer ?? {}),
    };

    const phone =
      result?.whatsapp?.phoneNumber ??
      result?.visitor?.phone ??
      customer.phone ??
      customer.phoneNumber ??
      null;

    const name = customer.name?.trim() || null;

    const lines = [
      "📋 *Contact Information*",
      "Please provide your contact details so our sales team can assist you with your quotation/order.",
    ];

    if (phone) lines.push(`• *Phone*: ${phone} ✅`);

    if (!name) {
      lines.push("\n👉 *Please type your Full Name to continue:*");
      return [
        {
          type: "text",
          text: { preview_url: false, body: lines.join("\n") },
        },
      ];
    }

    lines.push(`• *Name*: ${name} ✅`);
    lines.push("\nPress *Submit* to send your request:");

    const submitAction = {
      id: "SUBMIT_LEAD",
      type: "SUBMIT_LEAD",
      label: "Submit Request",
      payload: {
        name,
        phone,
        email: customer.email || customer.emailId || null,
        company: customer.company || customer.companyName || null,
      },
    };

    const interactive = this.buildInteractive([submitAction], lines.join("\n"));
    if (interactive) return [interactive];

    return [
      {
        type: "text",
        text: { preview_url: false, body: lines.join("\n") },
      },
    ];
  }

  // =====================================================
  // BUTTONS & LISTS BUILDER
  // =====================================================

  buildInteractive(
    actions = [],
    bodyText = "Please choose an option:",
    header = null,
  ) {
    const allValidActions = actions.filter(
      (action) =>
        action &&
        (action.id || action.type) &&
        (action.label || action.title || action.name),
    );

    if (!allValidActions.length) return null;

    const safeBody =
      String(bodyText).trim().slice(0, 1024) || "Please choose an option:";

    // If more than 10 choices -> Fall back to readable numbered text list
    if (allValidActions.length > 10) {
      const numberedList = allValidActions
        .map((a, idx) => `${idx + 1}. ${a.label || a.title || a.name}`)
        .join("\n");
      return {
        type: "text",
        text: {
          preview_url: false,
          body: `${safeBody}\n\n${numberedList}`,
        },
      };
    }

    // 1 to 3 choices -> WhatsApp Reply Buttons
    if (allValidActions.length <= 3) {
      return {
        type: "interactive",
        interactive: {
          type: "button",
          ...(header ? { header } : {}),
          body: { text: safeBody },
          action: {
            buttons: allValidActions.map((action) => ({
              type: "reply",
              reply: {
                id: this.encodeAction(action),
                title: String(action.label ?? action.title ?? action.name)
                  .trim()
                  .slice(0, 20),
              },
            })),
          },
        },
      };
    }

    // 4 to 10 choices -> WhatsApp Interactive List
    return {
      type: "interactive",
      interactive: {
        type: "list",
        ...(header && header.type === "text" ? { header } : {}),
        body: { text: safeBody },
        action: {
          button: "View options".slice(0, 20),
          sections: [
            {
              title: "Available options".slice(0, 24),
              rows: allValidActions.map((action) => ({
                id: this.encodeAction(action),
                title: String(action.label ?? action.title ?? action.name)
                  .trim()
                  .slice(0, 24),
                description: action.description
                  ? String(action.description).trim().slice(0, 72)
                  : undefined,
              })),
            },
          ],
        },
      },
    };
  }

  encodeAction(action = {}) {
    return this.sanitizeButtonId(WhatsappActionCodec.encode(action));
  }

  sanitizeButtonId(id) {
    return String(id || "")
      .trim()
      .slice(0, 256);
  }

  adapt(result = {}) {
    return this.toWhatsAppMessages(result);
  }
}

function currentFieldType(field) {
  return field?.type || "text";
}
