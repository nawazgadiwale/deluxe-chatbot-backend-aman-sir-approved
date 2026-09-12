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
    const item = requirement.items?.[requirement.currentItem ?? 0] ?? null;

    if (!item?.product?.id) {
      const candidates = Array.isArray(requirement.discoveryMatches)
        ? requirement.discoveryMatches
        : [];

      if (candidates.length) return this.buildProductSelection(candidates);
      if (requirement.browseCatalog === true)
        return this.buildProductSelection();

      return this.buildUnknownProduct();
    }

    const product = catalogService.getProduct(item.product.id);

    if (!product) {
      return this.buildProductSelection();
    }

    if (item.selectedProduct?.id) {
      const parentId =
        item.product?.parentProductId ||
        item.selectedProduct?.parentProductId ||
        item.product?.id;

      const parentProd = parentId
        ? catalogService.getProduct(parentId)
        : product;

      const selection = item.selection?.id
        ? catalogService.getSelectionOption(parentProd, item.selection.id) ||
          item.selection
        : null;

      if (!item.orderStarted) {
        return this.buildProductDetails(item.selectedProduct, selection);
      }

      return this.nextCatalogStep(item.selectedProduct, item);
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
        return this.buildProductDetails(concreteProduct, selection);
      }

      return this.nextCatalogStep(concreteProduct, item);
    }

    const selections = catalogService.getSelectionOptions(product);

    if (selections.length > 0) {
      return this.buildSelection(product);
    }

    if (!item.orderStarted) {
      return this.buildProductDetails(product, null);
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
        message: "I couldn't find that exact item in our catalog.",
      },
      [
        {
          id: "BROWSE_PRODUCTS",
          label: "Browse Products",
          payload: {},
        },
        {
          id: "HUMAN_HANDOFF",
          label: "Talk to Expert",
          payload: {},
        },
      ],
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

  buildProductDetails(concreteProduct, selection = null) {
    return this.decision(
      "PRODUCT_DETAILS",
      {
        product: this.productSummary(concreteProduct),
        selectedProduct: concreteProduct,
        selection: selection
          ? {
              id: selection.id,
              name: selection.name ?? selection.label ?? selection.id,
              description: selection.description ?? null,
              image: resolveCatalogImage(selection),
            }
          : null,
      },
      [
        {
          id: "ORDER_NOW",
          type: "ORDER_NOW",
          label: "ORDER NOW",
          payload: {
            productId: concreteProduct.id,
          },
        },
      ],
    );
  }

  nextCatalogStep(product, item) {
    const step = catalogService.getCurrentWorkflowStep(product, item);

    if (step) {
      const type = catalogService.getWorkflowStepType(step);

      switch (type) {
        case "fields":
          return this.buildFieldDecision(product, item);

        case "requirements":
          return this.buildRequirementDecision(product, item);

        case "addons":
          return this.buildAddonDecision(product, item);

        case "selection":
          return this.buildSelection(product);

        default:
          return this.buildFieldDecision(product, item);
      }
    }

    const deliveryMethod = this.getDeliveryMethod(item);

    if (!deliveryMethod) {
      return this.buildDeliveryDecision(product, item);
    }

    /*
     * DELIVERY:
     * Address is required only when delivery is selected.
     */
    if (
      deliveryMethod === DELIVERY_METHODS.DELIVERY &&
      !this.hasCompleteDeliveryAddress(item)
    ) {
      return this.buildDeliveryAddressDecision(product, item);
    }

    /*
     * PICKUP:
     * Never request or require delivery address.
     */
    if (!this.hasDeliveryDate(item)) {
      return this.buildDeliveryDateDecision(product, item);
    }

    if (item.confirmed || item.orderConfirmed) {
      return this.decision(DecisionTypes.ORDER_COMPLETED, {
        message:
          "Your order details have been submitted successfully. Our sales team will contact you regarding the quotation.",
      });
    }
    return this.buildReviewDecision(product, item);
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

    if (normalized === DELIVERY_METHODS.PICKUP || normalized === "pick up") {
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

      return parts.length >= 2;
    }

    return typeof address === "string" && address.trim().length >= 10;
  }

  hasDeliveryDate(item = {}) {
    const date = this.getDeliveryDate(item);

    return date !== null && date !== undefined && String(date).trim() !== "";
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

    return this.decision(
      DecisionTypes.COLLECT_PRODUCT_FIELD,
      {
        product: this.productSummary(product),
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
      options.map((option) => ({
        id: "SET_FIELD",
        label: option.label ?? option.name ?? String(option.value ?? option.id),
        payload: {
          fieldId: field.id,
          value: option.value ?? option.id ?? option.name ?? option.label,
        },
      })),
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
      `Please provide details for ${
        requirement.name ?? requirement.label ?? requirement.id
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
        product: this.productSummary(product),
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
        label: `${isSelected ? "✓ " : ""}${
          addon.name ?? addon.label ?? addon.id
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
        product: this.productSummary(product),
        message: addonLabel,
        addons,
        selectedAddons,
      },
      actions,
    );
  }

  buildDeliveryDecision(product, item) {
    return this.decision(
      DecisionTypes.SELECT_DELIVERY_METHOD,
      {
        product: this.productSummary(product),
        message: "Please select your preferred delivery method:",
      },
      [
        {
          id: "SET_DELIVERY",
          label: "Delivery (AED 25)",
          payload: {
            method: DELIVERY_METHODS.DELIVERY,
          },
        },
        {
          id: "SET_DELIVERY",
          label: "Store Pickup (Free)",
          payload: {
            method: DELIVERY_METHODS.PICKUP,
          },
        },
      ],
    );
  }

  buildDeliveryAddressDecision(product, item) {
    return this.decision(
      DecisionTypes.ASK_DELIVERY_ADDRESS,
      {
        product: this.productSummary(product),
        message:
          "Please enter your complete delivery address, including building/villa number, street, area, city, and any important delivery instructions.",
        required: true,
      },
      [],
    );
  }

  buildDeliveryDateDecision(product, item) {
    const deliveryMethod = this.getDeliveryMethod(item);

    return this.decision(
      DecisionTypes.ASK_DELIVERY_DATE,
      {
        product: this.productSummary(product),
        message:
          deliveryMethod === DELIVERY_METHODS.PICKUP
            ? "When would you like to pick up your order?"
            : "When do you need the order delivered?",
        required: true,
        deliveryMethod,
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

    const deliveryMethod =
      this.getDeliveryMethod(item) ?? DELIVERY_METHODS.PICKUP;

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

    const workflow = item.workflow ?? {};

    for (const [key, value] of Object.entries(workflow)) {
      if (
        key === "quantity" ||
        key === "deliveryMethod" ||
        key === "deliveryAddress" ||
        key === "address" ||
        key === "deliveryDate" ||
        key === "artwork" ||
        value == null ||
        value === "" ||
        typeof value === "object"
      ) {
        continue;
      }

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

    lines.push(
      `• *Delivery:* ${
        deliveryMethod === DELIVERY_METHODS.DELIVERY
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

    const deliveryDate = this.getDeliveryDate(item);

    if (deliveryDate) {
      lines.push(`• *Date:* ${deliveryDate}`);
    }

    lines.push("\n*Price Details:*");

    if (isQuoteRequired || (unitPrice === 0 && subtotal === 0)) {
      lines.push("• *Price:* Quotation required");
    } else {
      lines.push(`• *Unit Price:* AED ${unitPrice}`);
      lines.push(`• *Subtotal:* AED ${subtotal}`);
      lines.push(`• *Delivery Charge:* AED ${deliveryCharge}`);
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

  productSummary(product = {}) {
    const image = resolveCatalogImage(product);

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
}
