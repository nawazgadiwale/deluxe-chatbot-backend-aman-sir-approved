import SalesCatalogService from "./SalesCatalogService.js";

const catalogService = new SalesCatalogService();

export default class SalesSummaryService {
  constructor(customCatalogService = null) {
    this.catalogService = customCatalogService || catalogService;
  }

  // =====================================================
  // BUILD STRUCTURED SALES SUMMARY
  // =====================================================

  buildSummary(state = {}, options = {}) {
    // 1. Customer
    const customer = {
      name:
        state.customer?.name ||
        state.lead?.name ||
        state.leadContext?.name ||
        null,
      phone:
        state.customer?.phone ||
        state.whatsapp?.phoneNumber ||
        state.lead?.phoneNumber ||
        state.phone ||
        null,
      email:
        state.customer?.email ||
        state.lead?.emailId ||
        state.leadContext?.email ||
        null,
      company:
        state.customer?.company ||
        state.lead?.companyName ||
        state.leadContext?.company ||
        null,
    };

    // 2. Order / Requirement State
    const requirement =
      state.order ??
      state.orderContext ??
      state.liveRequirement ??
      state.productSales ??
      {};

    const item =
      requirement.items?.[0] ??
      requirement.products?.[0] ??
      {};

    // 3. Product & Selection Resolution
    const rawProductId =
      item.product?.id ||
      item.productId ||
      state.selectedProduct?.id ||
      state.product?.id ||
      state.productId ||
      null;

    const rawSelectionId =
      item.selection?.id ||
      item.selectionId ||
      state.selection?.id ||
      state.selectionId ||
      null;

    let catalogProduct = null;
    if (rawProductId) {
      catalogProduct =
        this.catalogService.getTopLevelProduct(rawProductId) ||
        this.catalogService.getProduct(rawProductId);
    }

    const productId = catalogProduct?.id || rawProductId || null;
    const productName =
      catalogProduct?.name ||
      item.product?.name ||
      state.selectedProduct?.name ||
      state.product?.name ||
      productId;

    let selectionName = null;
    if (catalogProduct && rawSelectionId) {
      const selectionOpt = this.catalogService.getSelectionOption(
        catalogProduct,
        rawSelectionId,
      );
      selectionName = selectionOpt?.name || rawSelectionId;
    } else if (item.selection?.name) {
      selectionName = item.selection.name;
    } else if (rawSelectionId) {
      selectionName = rawSelectionId;
    }

    const mainCategory =
      catalogProduct?.mainCategory ||
      item.product?.mainCategory ||
      state.product?.mainCategory ||
      null;

    // 4. Requirements
    const formData = item.formData || {};
    const workflowData = item.workflow || {};

    const quantity =
      formData.quantity ??
      workflowData.quantity ??
      item.quantity ??
      requirement.totalQuantity ??
      null;

    const numberOfNames =
      formData.numberOfNames ??
      workflowData.numberOfNames ??
      null;

    const material =
      formData.material ??
      workflowData.material ??
      null;

    const lamination =
      formData.lamination ??
      workflowData.lamination ??
      null;

    let artwork =
      formData.artwork ??
      formData.designRequired ??
      workflowData.artwork ??
      null;

    if (!artwork && item.artworkReceived) {
      artwork = "Artwork received";
    }

    const deliveryMethod =
      requirement.delivery?.method ??
      item.delivery?.method ??
      state.delivery?.method ??
      null;

    const deliveryAddress =
      requirement.delivery?.address ??
      item.delivery?.address ??
      state.delivery?.address ??
      null;

    const requiredDate =
      requirement.delivery?.requiredDate ??
      item.delivery?.requiredDate ??
      state.delivery?.requiredDate ??
      null;

    const addons =
      item.addons?.items ??
      (Array.isArray(item.addons) ? item.addons : []) ??
      [];

    const requirements = {
      quantity,
      numberOfNames,
      material,
      lamination,
      artwork,
      deliveryMethod,
      deliveryAddress,
      requiredDate,
      addons,
    };

    // 5. Pricing
    const pricingObj = requirement.pricing || item.pricing || {};
    const pricing = {
      currency: pricingObj.currency || "AED",
      unitPrice: pricingObj.unitPrice ?? null,
      subtotal: pricingObj.subtotal ?? null,
      delivery: pricingObj.delivery ?? pricingObj.deliveryCharge ?? null,
      tax: pricingObj.tax ?? null,
      total: pricingObj.total ?? null,
    };

    // 6. Missing Information Analysis
    const missingInformation = [];
    if (!customer.name) {
      missingInformation.push("Customer name");
    }
    if (!customer.phone) {
      missingInformation.push("Phone number");
    }
    if (!customer.email) {
      missingInformation.push("Email address");
    }
    if (!customer.company) {
      missingInformation.push("Company name");
    }
    if (!quantity && productId) {
      missingInformation.push("Quantity");
    }
    if (deliveryMethod === "delivery" && !deliveryAddress) {
      missingInformation.push("Delivery address");
    }

    // 7. Deterministic Summary Text (<150 words)
    const summaryParts = [];
    const custLabel = customer.name || "Customer";
    if (productName) {
      const qtyText = quantity ? `${quantity} units of ` : "";
      const varText = selectionName ? ` (${selectionName})` : "";
      summaryParts.push(
        `${custLabel} is interested in ${qtyText}${productName}${varText}.`,
      );
    } else {
      summaryParts.push(`${custLabel} has made a sales inquiry.`);
    }

    if (artwork) {
      summaryParts.push(`Artwork: ${artwork}.`);
    }

    if (deliveryAddress) {
      summaryParts.push(`Delivery requested to ${deliveryAddress}.`);
    } else if (deliveryMethod === "pickup") {
      summaryParts.push("Self pick-up requested.");
    }

    const summaryText = summaryParts.join(" ");

    // 8. Next Action
    let nextAction = "Contact the customer and confirm the requirements.";
    if (missingInformation.length > 0 && missingInformation.includes("Delivery address")) {
      nextAction = "Contact customer to confirm delivery address and finalize quotation.";
    } else if (pricing.total) {
      nextAction = "Contact customer to confirm requirements and share payment details.";
    }

    return {
      customer,
      product: {
        id: productId,
        name: productName,
        selectionId: rawSelectionId,
        selectionName,
        mainCategory,
      },
      requirements,
      pricing,
      status: state.currentStep || "SALES_HANDOFF",
      summary: summaryText,
      nextAction,
      missingInformation,
    };
  }
}
