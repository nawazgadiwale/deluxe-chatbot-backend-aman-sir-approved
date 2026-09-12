import DeliveryService from "./DeliveryService.js";
import SalesCatalogService from "./SalesCatalogService.js";

const deliveryService = new DeliveryService();
const catalogService = new SalesCatalogService();

export default class PricingService {
  calculate(requirement = {}) {
    const items = requirement.items ?? [];

    const calculatedItems = items.map((item) => this.calculateItem(item));

    const subtotal = calculatedItems.reduce(
      (total, item) => total + (item.pricing?.total ?? item.pricing?.subtotal ?? 0),
      0,
    );

    const delivery = deliveryService.calculate(requirement);

    const deliveryCharge = delivery.charge ?? 0;

    const quotationRequired =
      requirement.quotationRequired === true ||
      (calculatedItems.length > 0 &&
        calculatedItems.every((item) => item.pricing?.quotationRequired === true)) ||
      (calculatedItems.length === 0 &&
        Boolean(
          requirement.product &&
          catalogService.isQuotationRequired(requirement.product),
        ));

    const totalBeforeVAT = quotationRequired ? null : subtotal + deliveryCharge;

    return {
      items: calculatedItems,

      subtotal,

      deliveryCharge,

      totalBeforeVAT,

      total: totalBeforeVAT,

      quotationRequired,

      currency: calculatedItems[0]?.pricing?.currency ?? "AED",
    };
  }


  // Item Pricing

  calculateItem(item = {}) {
    const rawQuantity =
      item.workflow?.quantity ??
      item.quantity ??
      item.formData?.quantity ??
      item.productData?.quantity ??
      item.selections?.quantity ??
      0;

    const quantity = Number(rawQuantity) || 0;

    const product = this.getProduct(item);
    const selection = this.getSelection(item, product);

    const pricingInfo = this.getPricingInfo(item, product, selection);

    const isQuoteRequired =
      product?.pricing?.quotationRequired === true ||
      selection?.quotationRequired === true;

    const basePrice = this.getBasePrice(product, selection);
    const unitPrice = this.getUnitPrice(
      item,
      quantity,
      pricingInfo,
      product,
      selection,
    );

    const subtotal =
      !isQuoteRequired && basePrice > 0
        ? unitPrice * (quantity > 0 ? quantity : 0)
        : 0;

    return {
      ...item,

      pricing: {
        currency: pricingInfo.currency || "AED",

        unitPrice,

        quantity: quantity > 0 ? quantity : 1,

        pricingUnit: pricingInfo.unit,

        pricingQuantity: pricingInfo.pricingQuantity,

        subtotal,

        discount: 0,

        total: subtotal,

        quotationRequired: isQuoteRequired || basePrice <= 0,
      },
    };
  }

  // Pricing Configuration

  getPricingInfo(item = {}, product = null, selection = null) {
    const prod = product || this.getProduct(item);

    if (!prod) {
      return {
        currency: "AED",
        unit: "piece",
        pricingQuantity: 1,
      };
    }

    const sel = selection || this.getSelection(item, prod);
    const productPricing = prod.pricing ?? {};

    const currency = sel?.currency ?? productPricing.currency ?? "AED";
    const unit = sel?.unit ?? productPricing.unit ?? "piece";

    const pricingQuantity = Number(
      sel?.pricingQuantity ??
      sel?.quantityStep ??
      productPricing.quantityStep ??
      this.getSelectionPricingQuantity(prod) ??
      1,
    );

    return {
      currency,
      unit,
      pricingQuantity: pricingQuantity > 0 ? pricingQuantity : 1,
    };
  }

  // Product Resolution

  getProduct(item = {}) {
    if (
      item.product &&
      typeof item.product === "object" &&
      (item.product.pricing || item.product.selection)
    ) {
      return item.product;
    }

    const candidateId =
      item.selectedProduct?.id ??
      item.selectedProduct?.productId ??
      item.selectedProduct?.slug ??
      item.product?.id ??
      item.product?.productId ??
      item.product?.slug ??
      item.productId ??
      item.slug ??
      item.id ??
      null;

    if (!candidateId) {
      return null;
    }

    return (
      catalogService.getProduct(candidateId) ??
      catalogService.resolveProduct({
        productId: candidateId,
        slug: candidateId,
      }) ??
      (item.product && typeof item.product === "object" ? item.product : null)
    );
  }

  // Selection / Variant Resolution

  getSelection(item = {}, product = null) {
    const prod = product || this.getProduct(item);
    if (!prod) {
      return null;
    }

    if (
      item.selection &&
      typeof item.selection === "object" &&
      (item.selection.price != null ||
        item.selection.startingPrice != null ||
        item.selection.id)
    ) {
      if (item.selection.id) {
        const opt = catalogService.getSelectionOption(prod, item.selection.id);
        if (opt) return opt;
      }
      return item.selection;
    }

    if (
      item.variant &&
      typeof item.variant === "object" &&
      (item.variant.price != null ||
        item.variant.startingPrice != null ||
        item.variant.id)
    ) {
      if (item.variant.id) {
        const opt = catalogService.getSelectionOption(prod, item.variant.id);
        if (opt) return opt;
      }
      return item.variant;
    }

    const optionId =
      (typeof item.selection === "string" ? item.selection : null) ??
      (typeof item.variant === "string" ? item.variant : null) ??
      item.selections?.[prod.selection?.id] ??
      item.formData?.[prod.selection?.id] ??
      item.productData?.[prod.selection?.id] ??
      item.formData?.size ??
      item.formData?.bannerType ??
      item.formData?.stampShape ??
      item.formData?.variant ??
      item.selections?.size ??
      item.selections?.bannerType ??
      item.selections?.stampShape ??
      item.selections?.variant ??
      item.selectionId ??
      null;

    if (optionId) {
      const opt = catalogService.getSelectionOption(prod, optionId);
      if (opt) return opt;
    }

    if (prod.parentSelectionId && prod.parentProduct) {
      const opt = catalogService.getSelectionOption(
        prod.parentProduct,
        prod.parentSelectionId,
      );
      if (opt) return opt;
    }

    return null;
  }

  // Selection Pricing Quantity

  getSelectionPricingQuantity(product = {}) {
    const selection = product.selection;

    if (!selection?.options?.length) {
      return 1;
    }

    const option = selection.options[0];

    return Number(option?.pricingQuantity ?? option?.quantityStep ?? 1);
  }

  // Unit Price

  getUnitPrice(
    item = {},
    quantity = 0,
    pricingInfo = {},
    product = null,
    selection = null,
  ) {
    const prod = product || this.getProduct(item);
    if (!prod) {
      return 0;
    }

    const sel = selection || this.getSelection(item, prod);
    const basePrice = this.getBasePrice(prod, sel);
    if (basePrice <= 0) {
      return 0;
    }

    const info = pricingInfo?.pricingQuantity
      ? pricingInfo
      : this.getPricingInfo(item, prod, sel);

    const pq = Number(info?.pricingQuantity) || 1;
    return basePrice / pq;
  }

  // Base Price

  getBasePrice(product = {}, selection = null) {
    if (selection?.price != null) {
      return Number(selection.price);
    }

    if (selection?.startingPrice != null) {
      return Number(selection.startingPrice);
    }

    if (product?.pricing?.price != null) {
      return Number(product.pricing.price);
    }

    if (product?.pricing?.startingPrice != null) {
      return Number(product.pricing.startingPrice);
    }

    if (product?.price != null) {
      return Number(product.price);
    }

    if (product?.startingPrice != null) {
      return Number(product.startingPrice);
    }

    if (product?.selection?.options?.length > 0) {
      const defaultOpt =
        (product.selection.recommended
          ? product.selection.options.find(
            (o) => o.id === product.selection.recommended,
          )
          : null) ?? product.selection.options[0];
      if (defaultOpt?.price != null) return Number(defaultOpt.price);
      if (defaultOpt?.startingPrice != null)
        return Number(defaultOpt.startingPrice);
    }

    return 0;
  }
}
