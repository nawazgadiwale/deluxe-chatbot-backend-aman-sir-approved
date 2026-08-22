import DeliveryService from "./DeliveryService.js";
import SalesCatalogService from "./SalesCatalogService.js";

const deliveryService = new DeliveryService();
const catalogService = new SalesCatalogService();

export default class PricingService {
  calculate(requirement = {}) {
    const items = requirement.items ?? [];

    const calculatedItems = items.map((item) => this.calculateItem(item));

    const subtotal = calculatedItems.reduce(
      (total, item) => total + (item.pricing?.total ?? 0),
      0,
    );

    const delivery = deliveryService.calculate(requirement);

    const deliveryCharge = delivery.charge ?? 0;

    return {
      items: calculatedItems,

      subtotal,

      deliveryCharge,

      total: subtotal + deliveryCharge,

      currency: "AED",
    };
  }

  /*
   * =====================================================
   * Item Pricing
   * =====================================================
   */

  calculateItem(item = {}) {
    const quantity = Number(item.workflow?.quantity ?? 0);

    const pricingInfo = this.getPricingInfo(item);

    const unitPrice = this.getUnitPrice(item, quantity, pricingInfo);

    const subtotal = unitPrice * quantity;

    return {
      ...item,

      pricing: {
        currency: pricingInfo.currency,

        unitPrice,

        quantity,

        pricingUnit: pricingInfo.unit,

        pricingQuantity: pricingInfo.pricingQuantity,

        subtotal,

        discount: 0,

        total: subtotal,
      },
    };
  }

  /*
   * =====================================================
   * Pricing Configuration
   * =====================================================
   */

  getPricingInfo(item = {}) {
    const product = this.getProduct(item);

    if (!product) {
      return {
        currency: "AED",
        unit: "piece",
        pricingQuantity: 1,
      };
    }

    const productPricing = product.pricing ?? {};

    return {
      currency: productPricing.currency ?? "AED",

      unit: productPricing.unit ?? "piece",

      pricingQuantity: Number(
        productPricing.quantityStep ??
          this.getSelectionPricingQuantity(product) ??
          1,
      ),
    };
  }

  /*
   * =====================================================
   * Product
   * =====================================================
   */

  getProduct(item = {}) {
    if (!item.product?.id) {
      return null;
    }

    return catalogService.getProduct(item.product.id);
  }

  /*
   * =====================================================
   * Selection
   * =====================================================
   */

  getSelection(item = {}) {
    const product = this.getProduct(item);

    if (!product || !item.selection?.id) {
      return null;
    }

    return catalogService.getSelectionOption(product, item.selection.id);
  }

  /*
   * =====================================================
   * Selection Pricing Quantity
   * =====================================================
   */

  getSelectionPricingQuantity(product = {}) {
    const selection = product.selection;

    if (!selection?.options?.length) {
      return 1;
    }

    const option = selection.options[0];

    return Number(option?.pricingQuantity ?? option?.quantityStep ?? 1);
  }

  /*
   * =====================================================
   * Unit Price
   * =====================================================
   */

  getUnitPrice(item = {}, quantity = 0, pricingInfo = {}) {
    if (quantity <= 0) {
      return 0;
    }

    const product = this.getProduct(item);

    if (!product) {
      return 0;
    }

    const selection = this.getSelection(item);

    /*
     * -----------------------------------------------------
     * Determine Base Price
     * -----------------------------------------------------
     */

    const basePrice = this.getBasePrice(product, selection);

    if (basePrice <= 0) {
      return 0;
    }

    /*
     * -----------------------------------------------------
     * Price Per Piece
     * -----------------------------------------------------
     *
     * Example:
     *
     * Business Cards:
     * AED 60 / 100
     *
     * Roll-Up Banner:
     * AED 130 / 1
     *
     * Stamp:
     * AED 95 / 1
     */

    return basePrice / pricingInfo.pricingQuantity;
  }

  /*
   * =====================================================
   * Base Price
   * =====================================================
   */

  getBasePrice(product = {}, selection = null) {
    /*
     * Selection price has priority.
     *
     * Example:
     *
     * Roll-Up Banner:
     * selection.price = 130
     */

    if (selection?.price != null) {
      return Number(selection.price);
    }

    /*
     * Business Cards / other products:
     *
     * selection.startingPrice = 60
     */

    if (selection?.startingPrice != null) {
      return Number(selection.startingPrice);
    }

    /*
     * Product-level pricing
     */

    if (product.pricing?.startingPrice != null) {
      return Number(product.pricing.startingPrice);
    }

    return 0;
  }
}
