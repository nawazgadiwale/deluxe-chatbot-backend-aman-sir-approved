import DecisionTypes from "../helpers/DecisionTypes.js";
import SalesCatalogService from "./SalesCatalogService.js";
import PricingService from "./PricingService.js";
import DeliveryService, {
  DELIVERY_CHARGES,
  DELIVERY_METHODS,
} from "./DeliveryService.js";
import { resolveCatalogImage } from "../helpers/CatalogHelper.js";

const catalogService = new SalesCatalogService();
const pricingService = new PricingService();
const deliveryService = new DeliveryService();

export default class ConversationDecisionService {
  decide(requirement = {}) {
    const item =
      requirement.items?.[requirement.currentItem ?? 0] ?? null;

    if (!item?.product?.id) {
      const candidates = Array.isArray(requirement.discoveryMatches)
        ? requirement.discoveryMatches
        : [];

      if (candidates.length > 1) {
        return this.buildDiscoveryClarification(candidates);
      }

      return this.buildUnknownProduct();
    }

    const product = catalogService.getProduct(item.product.id);

    if (!product) {
      return this.buildUnknownProduct();
    }

    if (item.selectedProduct?.id || product.parentProductId) {
      const concreteProduct = item.selectedProduct ?? product;
      const parentId =
        item.productId ||
        item.product?.parentProductId ||
        concreteProduct.parentProductId ||
        item.product?.id;

      const parentProd = parentId
        ? catalogService.getProduct(parentId)
        : product;

      const selectionId =
        item.selectionId ||
        item.selection?.id ||
        concreteProduct.parentSelectionId;
      const selection = selectionId
        ? catalogService.getSelectionOption(parentProd, selectionId) ||
        item.selection
        : null;

      if (!item.orderStarted) {
        return this.buildProductDetails(concreteProduct, selection, parentProd);
      }

      return this.nextCatalogStep(concreteProduct, item);
    }

    if (item.selection?.id) {
      const selection = catalogService.getSelectionOption(
        product,
        item.selection.id,
      );

      if (!selection) {
        return this.buildSelection(product);
      }

      if (
        Array.isArray(selection.products) &&
        selection.products.length > 0 &&
        !item.selectedProduct?.id
      ) {
        return this.buildNestedProducts(product, selection);
      }

      const concreteProduct = item.selectedProduct ??
        catalogService.getProduct(item.selection.id) ?? {
        ...product,
        ...selection,
        id: selection.id,
        name: selection.name ?? selection.label ?? product.name,
      };

      if (!item.orderStarted) {
        return this.buildProductDetails(concreteProduct, selection, product);
      }

      return this.nextCatalogStep(concreteProduct, item);
    }

    const selections = catalogService.getSelectionOptions(product);

    if (selections.length > 0) {
      return this.buildSelection(product);
    }

    if (!item.orderStarted) {
      return this.buildProductDetails(product, null, product);
    }

    return this.nextCatalogStep(product, item);
  }

  buildProductSelection(candidates = null) {
    const products =
      Array.isArray(candidates) && candidates.length
        ? candidates
        : catalogService.getProducts();

    return this.decision(
      DecisionTypes.SELECT_PRODUCT,
      {
        products: products.map(this.productSummary),
      },
      products.map((product) => ({
        id: DecisionTypes.SELECT_PRODUCT,
        label: product.name,
        payload: {
          productId: product.id,
        },
      })),
    );
  }

  buildUnknownProduct() {
    return this.decision(
      "UNKNOWN_PRODUCT",
      {
        message:
          "I couldn't find that product in our catalog. Please describe what you need and I'll try to find the right product.",
      },
      [],
    );
  }

  buildSelection(product) {
    const options = catalogService.getSelectionOptions(product);

    return this.decision(
      DecisionTypes.SELECT_SELECTION,
      {
        product: this.productSummary(product),
        selection: {
          id: product.selection?.id ?? "selection",
          name:
            product.selection?.name ?? product.selection?.label ?? "Options",
          description: product.selection?.description ?? null,
          required: product.selection?.required !== false,
        },
        options: options.map((option) => ({
          id: option.id,
          name: option.name ?? option.label ?? option.id,
          description: option.description ?? null,
          image: resolveCatalogImage(option),
          badge: option.badge ?? null,
          startingPrice: option.startingPrice ?? option.price ?? null,
          products: Array.isArray(option.products)
            ? option.products.map((product) => this.productSummary(product))
            : [],
        })),
      },
      options.map((option) => ({
        id: DecisionTypes.SELECT_SELECTION,
        label: option.name ?? option.label ?? option.id,
        payload: {
          productId: product.id,
          selectionId: option.id,
        },
      })),
    );
  }

  buildNestedProducts(product, selection) {
    const products = Array.isArray(selection.products)
      ? selection.products
      : [];

    return this.decision(
      "SELECT_NESTED_PRODUCT",
      {
        product: this.productSummary(product),
        category: {
          id: selection.id,
          name: selection.name ?? selection.label ?? selection.id,
          description: selection.description ?? null,
          image: resolveCatalogImage(selection),
        },
        products: products.map(this.productSummary),
      },
      products.map((child) => ({
        id: "SELECT_NESTED_PRODUCT",
        label: child.name ?? child.productName ?? child.title ?? child.id,
        payload: {
          productId: product.id,
          selectionId: selection.id,
          nestedProductId: child.id,
        },
      })),
    );
  }

  buildProductDetails(concreteProduct, selection = null, parentProduct = null) {
    const rootProduct =
      parentProduct ??
      (concreteProduct.parentProductId
        ? catalogService.getProduct(concreteProduct.parentProductId)
        : null) ??
      (catalogService.getTopLevelProduct(concreteProduct.id)
        ? concreteProduct
        : null) ??
      concreteProduct;

    const selectedVariant =
      selection ??
      (concreteProduct.parentSelectionId
        ? catalogService.getSelectionOption(
            rootProduct,
            concreteProduct.parentSelectionId,
          )
        : null) ??
      (rootProduct.id !== concreteProduct.id ? concreteProduct : null);

    const selectionId = selectedVariant?.id ?? null;

    return this.decision(
      "PRODUCT_DETAILS",
      {
        product: this.productSummary(concreteProduct),
        selectedProduct: concreteProduct,
        selection: selectedVariant
          ? {
            id: selectedVariant.id,
            name: selectedVariant.name ?? selectedVariant.label ?? selectedVariant.id,
            description: selectedVariant.description ?? null,
            image: resolveCatalogImage(selectedVariant),
          }
          : null,
      },
      [
        {
          id: "ORDER_NOW",
          type: "ORDER_NOW",
          label: "ORDER NOW",
          payload: {
            productId: rootProduct.id,
            ...(selectionId && selectionId !== rootProduct.id
              ? { selectionId }
              : {}),
          },
        },
      ],
    );
  }

  nextCatalogStep(product, item) {
    const concreteProduct = item.selectedProduct ?? product;
    const workflow = catalogService.getProductWorkflow(concreteProduct);

    // 1. If order is confirmed, check for remaining post-confirmation workflow steps
    if (item.confirmed || item.orderConfirmed) {
      for (const step of workflow) {
        if (!catalogService.isWorkflowStepCompleted(concreteProduct, item, step)) {
          return this.resolveWorkflowStepDecision(concreteProduct, item, step);
        }
      }
      return this.decision(DecisionTypes.ORDER_COMPLETED, {
        product: this.productSummary(concreteProduct, { skipMedia: true }),
        message:
          "Thank you for choosing Deluxe Printing! Your order details have been submitted successfully. Our sales team will contact you regarding the quotation.",
      });
    }

    // 2. Check delivery address if delivery method is already selected as delivery
    const deliveryMethod = this.getDeliveryMethod(item);
    if (
      deliveryMethod === DELIVERY_METHODS.DELIVERY &&
      !this.hasCompleteDeliveryAddress(item)
    ) {
      const hasDeliveryInWorkflow = workflow.some(
        (s) => catalogService.getWorkflowStepType(s) === "delivery" || s.id === "delivery",
      );
      const fields = catalogService.getProductFields(concreteProduct, item);
      const hasDeliveryField = fields.some(
        (f) => f.mapsTo === "delivery.method" || f.id === "deliveryMethod" || f.id === "delivery",
      );
      if (hasDeliveryInWorkflow || hasDeliveryField) {
        return this.buildDeliveryAddressDecision(concreteProduct, item);
      }
    }

    // 3. Resolve first incomplete catalog workflow step dynamically
    for (const step of workflow) {
      if (!catalogService.isWorkflowStepCompleted(concreteProduct, item, step)) {
        return this.resolveWorkflowStepDecision(concreteProduct, item, step);
      }
    }

    // 4. If all catalog workflow items are completed, reach confirmation
    return this.buildReviewDecision(concreteProduct, item);
  }

  resolveWorkflowStepDecision(concreteProduct, item, step) {
    const stepType = catalogService.getWorkflowStepType(step);

    switch (stepType) {
      case "selection":
        return this.buildSelection(concreteProduct);

      case "fields":
        return this.buildFieldDecision(concreteProduct, item);

      case "requirements":
      case "requirement":
        return this.buildRequirementDecision(concreteProduct, item);

      case "quotation":
        return this.buildQuotationDecision(concreteProduct, item, step);

      case "artwork":
        return this.buildArtworkDecision(concreteProduct, item, step);

      case "delivery":
      case "deliveryMethod": {
        const method = this.getDeliveryMethod(item);
        if (!method) {
          return this.buildDeliveryDecision(concreteProduct, item);
        }
        if (
          method === DELIVERY_METHODS.DELIVERY &&
          !this.hasCompleteDeliveryAddress(item)
        ) {
          return this.buildDeliveryAddressDecision(concreteProduct, item);
        }
        return this.nextCatalogStep(concreteProduct, item);
      }

      case "delivery_date":
      case "deliveryDate":
        return this.buildDeliveryDateDecision(concreteProduct, item);

      case "addons":
        return this.buildAddonDecision(concreteProduct, item);

      case "confirmation":
        return this.buildReviewDecision(concreteProduct, item);

      case "production":
        return this.buildProductionDecision(concreteProduct, item, step);

      case "dispatch":
        return this.buildDispatchDecision(concreteProduct, item, step);

      default:
        return this.buildReviewDecision(concreteProduct, item);
    }
  }

  getDeliveryMethod(item = {}) {
    const method =
      item.delivery?.method ??
      item.workflow?.deliveryMethod ??
      item.productData?.deliveryMethod ??
      null;

    if (!method) return null;

    const normalized = String(method).trim().toLowerCase();

    if (normalized === DELIVERY_METHODS.DELIVERY || normalized === "deliver") {
      return DELIVERY_METHODS.DELIVERY;
    }

    if (
      normalized === DELIVERY_METHODS.PICKUP ||
      normalized === "pick up" ||
      normalized === "self-pickup" ||
      normalized === "self_pickup"
    ) {
      return DELIVERY_METHODS.PICKUP;
    }

    return normalized;
  }

  getDeliveryAddress(item = {}) {
    return (
      item.delivery?.address ??
      item.productData?.deliveryAddress ??
      item.productData?.address ??
      item.workflow?.deliveryAddress ??
      item.workflow?.address ??
      ""
    );
  }

  getDeliveryDate(item = {}) {
    return (
      item.delivery?.requiredDate ??
      item.productData?.deliveryDate ??
      item.productData?.requiredDate ??
      item.workflow?.deliveryDate ??
      item.workflow?.requiredDate ??
      ""
    );
  }

  hasCompleteDeliveryAddress(item = {}) {
    const address = this.getDeliveryAddress(item);
    if (!address) return false;

    if (typeof address === "object" && address) {
      const parts = [
        address.building,
        address.buildingNumber,
        address.villa,
        address.street,
        address.area,
        address.city,
        address.addressLine1,
        address.addressLine2,
        address.fullAddress,
      ].filter(
        (value) =>
          value !== undefined && value !== null && String(value).trim() !== "",
      );

      return parts.length >= 1;
    }

    return typeof address === "string" && address.trim().length >= 3;
  }

  hasDeliveryDate(item = {}) {
    const date = this.getDeliveryDate(item);

    return date !== null && date !== undefined && String(date).trim() !== "";
  }

  isDeliveryDateRequired(product = {}, item = {}) {
    const deliveryMethod = this.getDeliveryMethod(item);
    if (deliveryMethod === DELIVERY_METHODS.PICKUP) {
      const workflow = catalogService.getProductWorkflow(product);
      return workflow.some(
        (step) =>
          (catalogService.getWorkflowStepType(step) === "collection_date" ||
            step.id === "collection_date") &&
          step.required !== false,
      );
    }
    if (deliveryMethod === DELIVERY_METHODS.DELIVERY) {
      const workflow = catalogService.getProductWorkflow(product);
      const hasDeliveryDateStep = workflow.some(
        (step) =>
          (catalogService.getWorkflowStepType(step) === "delivery_date" ||
            catalogService.getWorkflowStepType(step) === "deliveryDate" ||
            step.id === "delivery_date" ||
            step.id === "deliveryDate") &&
          step.required !== false,
      );
      if (hasDeliveryDateStep) return true;

      if (
        product.deliveryDateRequired === true ||
        product.requiresDeliveryDate === true ||
        product.allowDeliveryDate !== false
      ) {
        return true;
      }
    }
    return false;
  }

  hasArtwork(item = {}) {
    if (
      item.artwork?.received === true ||
      item.artwork?.mediaId ||
      item.artworkReceived === true ||
      item.workflow?.artwork === true ||
      item.workflow?.artworkReceived === true
    ) {
      return true;
    }
    if (
      item.workflow?.designRequired === "need_design" ||
      item.productData?.designRequired === "need_design" ||
      item.workflow?.artworkHelp === true
    ) {
      return true;
    }
    return false;
  }

  isArtworkRequired(product = {}, item = {}) {
    const workflow = catalogService.getProductWorkflow(product);
    const hasArtworkWorkflow = workflow.some(
      (step) =>
        (catalogService.getWorkflowStepType(step) === "artwork" ||
          step.id === "artwork") &&
        step.required !== false,
    );
    if (hasArtworkWorkflow) return true;

    const requirements = catalogService.getRequirements(product);
    const artworkReq = requirements.find(
      (req) =>
        req.id === "artwork" ||
        req.id === "designRequired" ||
        req.type === "artwork",
    );
    if (artworkReq) {
      if (artworkReq.required === true) return true;
      const val =
        item.workflow?.[artworkReq.id] ??
        item.productData?.[artworkReq.id] ??
        null;
      if (val === "have_artwork" || val === "artwork_ready" || val === true) {
        return true;
      }
      if (!val && artworkReq.id === "designRequired") {
        return true;
      }
    }
    return false;
  }

  buildFieldDecision(product, item) {
    const field = catalogService.getCurrentField(product, item);

    if (!field) {
      return this.nextCatalogStep(product, item);
    }

    const currentQty = Number(
      item.workflow?.quantity ?? item.productData?.quantity ?? 0,
    );

    let options = Array.isArray(field.options) ? field.options : [];

    if (currentQty > 0) {
      options = options.filter(
        (opt) => !opt.minQuantity || currentQty >= opt.minQuantity,
      );
    }

    const question =
      field.question ??
      field.label ??
      `Please select ${field.name ?? field.id}:`;

    const isDeliveryField =
      field.mapsTo === "delivery.method" ||
      field.id === "deliveryMethod" ||
      field.id === "delivery";

    const actions = options.map((option) => ({
      id: isDeliveryField ? "SET_DELIVERY" : "SET_FIELD",
      label: option.label ?? option.name ?? String(option.value ?? option.id),
      payload: isDeliveryField
        ? {
          fieldId: field.id,
          method: option.value ?? option.id,
        }
        : {
          fieldId: field.id,
          value: option.value ?? option.id ?? option.name ?? option.label,
        },
    }));

    return this.decision(
      isDeliveryField
        ? DecisionTypes.SELECT_DELIVERY_METHOD
        : DecisionTypes.COLLECT_PRODUCT_FIELD,
      {
        product: this.productSummary(product, { skipMedia: true }),
        field: {
          id: field.id,
          label: field.label ?? field.name ?? field.id,
          question,
          description: field.description ?? null,
          type: field.type ?? "text",
          required: field.required !== false,
          options,
          validation: field.validation ?? {},
        },
      },
      actions,
    );
  }

  buildRequirementDecision(product, item) {
    const requirement = catalogService.getCurrentRequirement(product, item);

    if (!requirement) {
      return this.nextCatalogStep(product, item);
    }

    const question =
      requirement.instruction ??
      requirement.description ??
      requirement.question ??
      `Please provide details for ${requirement.name ?? requirement.label ?? requirement.id
      }:`;

    const options = Array.isArray(requirement.options)
      ? requirement.options
      : [];

    const actions = options.map((option) => ({
      id: "SET_REQUIREMENT",
      label: option.label ?? option.name ?? String(option.value ?? option.id),
      payload: {
        requirementId: requirement.id,
        value: option.value ?? option.id ?? option.name,
      },
    }));

    if (requirement.required === false) {
      actions.push({
        id: "SET_REQUIREMENT",
        label: "Skip",
        payload: {
          requirementId: requirement.id,
          value: "skipped",
        },
      });
    }

    return this.decision(
      DecisionTypes.COLLECT_REQUIREMENT,
      {
        product: this.productSummary(product, { skipMedia: true }),
        requirement: {
          id: requirement.id,
          name: requirement.name ?? requirement.label ?? requirement.id,
          description: requirement.description ?? null,
          instruction: question,
          required: requirement.required !== false,
          options,
        },
      },
      actions,
    );
  }

  buildAddonDecision(product, item) {
    const addons = catalogService.getAddons(product);

    if (
      !addons?.enabled ||
      !Array.isArray(addons.options) ||
      addons.options.length === 0
    ) {
      return this.nextCatalogStep(product, item);
    }

    const selectedAddons = item.addons?.selected ?? [];

    const actions = addons.options.map((addon) => {
      const isSelected = selectedAddons.includes(addon.id);

      return {
        id: "TOGGLE_ADDON",
        label: `${isSelected ? "✓ " : ""}${addon.name ?? addon.label ?? addon.id
          }`,
        payload: {
          addonId: addon.id,
        },
      };
    });

    actions.push({
      id: "NEXT_STEP",
      label: "Continue",
      payload: {
        step: "addons",
      },
    });

    const addonLabel = addons.label || "Finishing Options";

    return this.decision(
      DecisionTypes.SELECT_ADDONS,
      {
        product: this.productSummary(product, { skipMedia: true }),
        message: addonLabel,
        addons,
        selectedAddons,
      },
      actions,
    );
  }

  buildDeliveryDecision(product, item) {
    const fields = catalogService.getProductFields(product, item);
    const deliveryField = fields.find(
      (f) => f.mapsTo === "delivery.method" || f.id === "deliveryMethod" || f.id === "delivery",
    );

    let options = deliveryField?.options;

    if (!options || !options.length) {
      const workflow = catalogService.getProductWorkflow(product);
      const deliveryStep = workflow.find(
        (s) => catalogService.getWorkflowStepType(s) === "delivery" || s.id === "delivery",
      );
      if (Array.isArray(deliveryStep?.options) && deliveryStep.options.length > 0) {
        options = deliveryStep.options;
      }
    }

    const actions = (options && options.length > 0)
      ? options.map((opt) => ({
        id: "SET_DELIVERY",
        label: opt.label ?? opt.name ?? String(opt.value ?? opt.id),
        payload: {
          method: opt.value ?? opt.id,
        },
      }))
      : [
        {
          id: "SET_DELIVERY",
          label: "Delivery (AED 25)",
          payload: {
            method: DELIVERY_METHODS.DELIVERY,
          },
        },
        {
          id: "SET_DELIVERY",
          label: "Self Pickup (Free)",
          payload: {
            method: DELIVERY_METHODS.PICKUP,
          },
        },
      ];

    return this.decision(
      DecisionTypes.SELECT_DELIVERY_METHOD,
      {
        product: this.productSummary(product, { skipMedia: true }),
        message: deliveryField?.question ?? "How would you like to receive your order?",
        options: options ?? null,
      },
      actions,
    );
  }

  buildDeliveryAddressDecision(product, item) {
    return this.decision(
      DecisionTypes.DELIVERY_ADDRESS,
      {
        product: this.productSummary(product, { skipMedia: true }),
        message: "Please share your delivery address.",
        required: true,
      },
      [],
    );
  }

  buildDeliveryDateDecision(product, item) {
    const deliveryMethod = this.getDeliveryMethod(item);

    return this.decision(
      DecisionTypes.DELIVERY_DATE,
      {
        product: this.productSummary(product, { skipMedia: true }),
        message: "Which date would you like to receive your order?",
        required: true,
        deliveryMethod,
      },
      [],
    );
  }

  buildArtworkDecision(product, item, step = {}) {
    const concreteProduct = item.selectedProduct ?? product;

    const actions = [
      {
        id: "SET_REQUIREMENT",
        label: "I need help with design",
        payload: {
          requirementId: "designRequired",
          value: "need_design",
        },
      },
    ];

    if (step?.required === false) {
      actions.push({
        id: "SET_REQUIREMENT",
        label: "Skip",
        payload: {
          requirementId: "artwork",
          value: "skipped",
        },
      });
    }

    return this.decision(
      DecisionTypes.ARTWORK,
      {
        product: this.productSummary(concreteProduct, { skipMedia: true }),
        message: "Please send your artwork/design file here.",
        required: step?.required !== false,
      },
      actions,
    );
  }

  buildQuotationDecision(product, item, step = {}) {
    const calculated = pricingService.calculateItem(item);
    const unitPrice = calculated.pricing?.unitPrice ?? 0;
    const isQuoteRequired = calculated.pricing?.quotationRequired === true;

    const message = isQuoteRequired || unitPrice === 0
      ? `Quotation for ${product.name}:\nOur sales team will prepare a customized quotation based on your specifications.`
      : `Quotation for ${product.name}:\n• Estimated unit price: AED ${unitPrice}\n\nPlease review and proceed.`;

    const actions = [
      {
        id: "NEXT_STEP",
        label: "Accept & Continue",
        payload: {
          step: "quotation",
          accepted: true,
        },
      },
    ];

    if (step?.required === false) {
      actions.push({
        id: "NEXT_STEP",
        label: "Skip",
        payload: {
          step: "quotation",
          skipped: true,
        },
      });
    }

    return this.decision(
      DecisionTypes.QUOTATION,
      {
        product: this.productSummary(product, { skipMedia: true }),
        message,
        pricing: calculated.pricing,
      },
      actions,
    );
  }

  buildProductionDecision(product, item, step = {}) {
    const production = catalogService.getProduction(product);
    const turnaround =
      production.turnaround?.standard ??
      production.turnaround ??
      "1-2 business days";

    return this.decision(
      DecisionTypes.PRODUCTION,
      {
        product: this.productSummary(product, { skipMedia: true }),
        message: `Production details for ${product.name}:\n• Standard turnaround: ${turnaround}\nPrinting begins after artwork approval.`,
        production,
      },
      [
        {
          id: "NEXT_STEP",
          label: "Proceed to Dispatch",
          payload: {
            step: "production",
            confirmed: true,
          },
        },
      ],
    );
  }

  buildDispatchDecision(product, item, step = {}) {
    return this.decision(
      DecisionTypes.ORDER_COMPLETED,
      {
        product: this.productSummary(product, { skipMedia: true }),
        message: `Thank you! Your order for ${product.name} has been confirmed and queued for dispatch. Our team will contact you with shipping and tracking updates.`,
      },
      [],
    );
  }

  buildReviewDecision(product, item) {
    const calculated = pricingService.calculateItem(item);

    const unitPrice = calculated.pricing?.unitPrice ?? 0;

    const quantity =
      calculated.pricing?.quantity ||
      Number(item.workflow?.quantity || item.productData?.quantity || 1);

    const subtotal = calculated.pricing?.subtotal ?? unitPrice * quantity;

    const deliveryMethod = this.getDeliveryMethod(item);

    const deliveryCharge =
      deliveryMethod === DELIVERY_METHODS.DELIVERY
        ? (DELIVERY_CHARGES[DELIVERY_METHODS.DELIVERY] ?? 25)
        : 0;

    const isQuoteRequired = calculated.pricing?.quotationRequired === true;

    const totalBeforeVAT = isQuoteRequired ? null : subtotal + deliveryCharge;

    const productName =
      product.name ?? product.productName ?? product.title ?? "Product";

    const lines = [
      "*Order Summary*",
      `• *Product:* ${productName}`,
      `• *Quantity:* ${quantity}`,
    ];

    const fields = catalogService.getProductFields(product, item);
    const seenFieldIds = new Set([
      "quantity",
      "deliveryMethod",
      "delivery",
      "deliveryAddress",
      "address",
      "deliveryDate",
      "artwork",
      "designRequired",
    ]);

    for (const field of fields) {
      if (
        seenFieldIds.has(field.id) ||
        field.mapsTo === "delivery.method" ||
        field.mapsTo === "workflow.quantity"
      ) {
        continue;
      }
      seenFieldIds.add(field.id);

      const val =
        item.formData?.[field.id] ??
        item.productData?.[field.id] ??
        item.workflow?.[field.id];

      if (val == null || val === "" || typeof val === "object") {
        continue;
      }

      let displayValue = val;
      if (Array.isArray(field.options) && field.options.length > 0) {
        const matchedOption = field.options.find(
          (opt) =>
            String(opt.value ?? opt.id).toLowerCase() ===
              String(val).toLowerCase() ||
            String(opt.label ?? opt.name).toLowerCase() ===
              String(val).toLowerCase(),
        );
        if (matchedOption) {
          displayValue =
            matchedOption.label ??
            matchedOption.name ??
            matchedOption.value ??
            displayValue;
        }
      }

      const fieldLabel = field.label ?? field.name ?? field.id;
      lines.push(`• *${fieldLabel}:* ${displayValue}`);
    }

    const allItemFields = {
      ...(item.workflow ?? {}),
      ...(item.productData ?? {}),
      ...(item.formData ?? {}),
    };
    for (const [key, value] of Object.entries(allItemFields)) {
      if (
        seenFieldIds.has(key) ||
        value == null ||
        value === "" ||
        typeof value === "object"
      ) {
        continue;
      }
      seenFieldIds.add(key);
      const label = key
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (s) => s.toUpperCase())
        .trim();
      lines.push(`• *${label}:* ${value}`);
    }

    const selectedAddons = item.addons?.selected ?? [];

    if (selectedAddons.length > 0) {
      lines.push(`• *Addons:* ${selectedAddons.join(", ")}`);
    }

    if (deliveryMethod) {
      lines.push(
        `• *Delivery:* ${deliveryMethod === DELIVERY_METHODS.DELIVERY
          ? "Delivery (AED 25)"
          : "Store Pickup (Free)"
        }`,
      );

      if (deliveryMethod === DELIVERY_METHODS.DELIVERY) {
        const address = this.getDeliveryAddress(item);

        if (address && typeof address === "string") {
          lines.push(`• *Delivery Address:* ${address}`);
        } else if (address && typeof address === "object") {
          const formattedAddress = [
            address.building,
            address.buildingNumber,
            address.villa,
            address.street,
            address.area,
            address.city,
            address.addressLine1,
            address.addressLine2,
            address.fullAddress,
          ]
            .filter(Boolean)
            .join(", ");

          if (formattedAddress) {
            lines.push(`• *Delivery Address:* ${formattedAddress}`);
          }
        }
      }
    }

    const deliveryDate = this.getDeliveryDate(item);

    if (deliveryDate) {
      lines.push(`• *Date:* ${deliveryDate}`);
    }

    if (
      item.artwork?.fileName ||
      item.artwork?.mediaId ||
      item.workflow?.artworkReceived ||
      item.artworkReceived
    ) {
      const artName = item.artwork?.fileName || "File uploaded";
      lines.push(`• *Artwork:* ${artName}`);
    } else if (
      item.workflow?.designRequired === "need_design" ||
      item.productData?.designRequired === "need_design"
    ) {
      lines.push(`• *Artwork:* Design assistance requested`);
    }

    lines.push("\n*Price Details:*");

    if (isQuoteRequired || (unitPrice === 0 && subtotal === 0)) {
      lines.push("• *Price:* Quotation required");
    } else {
      lines.push(`• *Unit Price:* AED ${unitPrice}`);
      lines.push(`• *Subtotal:* AED ${subtotal}`);
      if (deliveryMethod) {
        lines.push(`• *Delivery Charge:* AED ${deliveryCharge}`);
      }
      lines.push(`• *Total before VAT:* AED ${totalBeforeVAT}`);
    }

    lines.push(
      "\nPlease review your order summary above. Would you like to confirm?",
    );

    const summaryText = lines.join("\n");

    return this.decision(
      DecisionTypes.REVIEW_ORDER,
      {
        product: this.productSummary(product),
        message: summaryText,
        summary: summaryText,
        pricing: {
          unitPrice,
          quantity,
          subtotal,
          deliveryCharge,
          totalBeforeVAT,
        },
        deliveryMethod,
        deliveryAddress:
          deliveryMethod === DELIVERY_METHODS.DELIVERY
            ? this.getDeliveryAddress(item)
            : null,
        deliveryDate: deliveryDate || null,
      },
      [
        {
          id: "CONFIRM_ORDER",
          label: "Confirm Order",
          payload: {
            confirmed: true,
          },
        },
        {
          id: "EDIT_ORDER",
          label: "Edit Order",
          payload: {
            edit: true,
          },
        },
        {
          id: "CANCEL_ORDER",
          label: "Cancel Order",
          payload: {
            cancel: true,
          },
        },
      ],
    );
  }

  decision(type, context, actions = []) {
    return {
      type,
      stage: "SALES",
      context,
      actions,
      sections: [],
    };
  }

  productSummary(product = {}, options = {}) {
    const image = options?.skipMedia === true
      ? (product.image ?? null)
      : resolveCatalogImage(product);

    return {
      id: product.id ?? null,
      name:
        product.name ??
        product.productName ??
        product.title ??
        product.label ??
        product.id ??
        null,
      slug: product.slug ?? null,
      image,
      images: Array.isArray(product.images)
        ? product.images
        : image
          ? [image]
          : [],
      description: product.description ?? product.shortDescription ?? null,
      badge: product.badge ?? null,
      pricing: catalogService.getPricing(product),
    };
  }

  buildDiscoveryClarification(products = []) {
    return this.decision(
      "DISCOVERY_CLARIFICATION",
      {
        products: products.map(this.productSummary),
        message:
          "I found a few products that could match. Could you describe what you need a little more?",
      },
      [],
    );
  }
}
