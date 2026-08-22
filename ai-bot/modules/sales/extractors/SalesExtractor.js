import SalesCatalogService from "../services/SalesCatalogService.js";
import SalesProductResolver from "../services/SalesProductResolver.js";
import VariantResolver from "../services/VariantResolver.js";
import FieldResolver from "../services/FieldResolver.js";
import DeliveryService from "../services/DeliveryService.js";

const catalogService = new SalesCatalogService();

const productResolver = new SalesProductResolver();
const selectionResolver = new VariantResolver();
const fieldResolver = new FieldResolver();
const deliveryService = new DeliveryService();

const CONFIRM_KEYWORDS = [
  "yes",
  "confirm",
  "confirmed",
  "place order",
  "submit",
  "continue",
  "looks good",
  "proceed",
  "go ahead",
  "okay",
  "ok",
];

const ADD_PRODUCT_KEYWORDS = ["also", "another", "add", "plus", "along with"];

export default class SalesExtractor {
  extract(requirement = {}, message = "", currentStep = null) {
    const text = this.normalize(message);

    /*
     * =====================================================
     * Customer
     * =====================================================
     *
     * Customer details are collected AFTER the order
     * requirements are completed.
     *
     * Do not run product extraction during this stage.
     */

    if (currentStep === "COLLECT_CUSTOMER") {
      return this.extractCustomer(message);
    }

    const currentItem = requirement.items?.[requirement.currentItem] ?? {};

    /*
     * =====================================================
     * Product
     * =====================================================
     */

    const product = this.resolveProduct(currentItem, text);

    /*
     * =====================================================
     * Selection
     * =====================================================
     */

    const selection = this.resolveSelection(product, currentItem, text);

    /*
     * =====================================================
     * Product Data
     * =====================================================
     */

    const productData = this.resolveField(product, currentItem, text);

    /*
     * =====================================================
     * Requirements
     * =====================================================
     */

    const requirements = [];

    /*
     * =====================================================
     * Quantity
     * =====================================================
     */

    const quantity = this.extractQuantity(
      product,
      currentItem,
      text,
      currentStep,
    );

    /*
     * =====================================================
     * Artwork
     * =====================================================
     */

    const artwork = this.extractArtwork(text);

    /*
     * =====================================================
     * Delivery
     * =====================================================
     */

    const delivery = this.extractDelivery(text, currentStep, message);

    return {
      /*
       * Product
       */

      product: currentItem.product?.id ? null : product,

      /*
       * Selection
       */

      selection,

      /*
       * Product Data
       */

      productData,

      /*
       * Requirements
       */

      requirements,

      /*
       * Workflow
       */

      quantity,

      artwork,

      /*
       * Delivery
       */

      deliveryMethod: delivery.method,

      address: delivery.address,

      requiredDate: delivery.requiredDate,

      /*
       * Conversation
       */

      confirmed: this.extractConfirmation(text),

      addAnotherProduct: this.extractAddAnotherProduct(text),
    };
  }

  /*
   * =====================================================
   * Customer
   * =====================================================
   */

  extractCustomer(message = "") {
    const value = message.trim();

    if (!value) {
      return {
        customer: {},
      };
    }

    /*
     * -----------------------------------------------------
     * Phone
     * -----------------------------------------------------
     */

    const phone = this.extractPhone(value);

    if (phone) {
      return {
        customer: {
          phone,
        },
      };
    }

    /*
     * -----------------------------------------------------
     * Email
     * -----------------------------------------------------
     */

    const email = this.extractEmail(value);

    if (email) {
      return {
        customer: {
          email,
        },
      };
    }

    /*
     * -----------------------------------------------------
     * Name
     * -----------------------------------------------------
     *
     * At COLLECT_CUSTOMER the decision service asks
     * for name first, so plain text is treated as name.
     */

    return {
      customer: {
        name: value,
      },
    };
  }

  /*
   * =====================================================
   * Phone
   * =====================================================
   */

  extractPhone(value = "") {
    const match = value.match(/(?:\+?\d[\d\s\-().]{6,}\d)/);

    if (!match) {
      return null;
    }

    const phone = match[0].replace(/[\s\-().]/g, "").trim();

    const phoneRegex = /^\+?[0-9]{7,15}$/;

    return phoneRegex.test(phone) ? phone : null;
  }

  /*
   * =====================================================
   * Email
   * =====================================================
   */

  extractEmail(value = "") {
    const match = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);

    return match ? match[0].trim() : null;
  }

  /*
   * =====================================================
   * Product
   * =====================================================
   */

  resolveProduct(currentItem = {}, text = "") {
    if (currentItem.product?.id) {
      return catalogService.getProduct(currentItem.product.id);
    }

    return productResolver.resolve(text);
  }

  /*
   * =====================================================
   * Selection
   * =====================================================
   */

  resolveSelection(product = null, currentItem = {}, text = "") {
    if (!product) {
      return null;
    }

    if (currentItem.selection?.id) {
      return catalogService.getSelectionOption(
        product,
        currentItem.selection.id,
      );
    }

    return selectionResolver.resolve(product, text);
  }

  /*
   * =====================================================
   * Product Field
   * =====================================================
   */

  resolveField(product = null, currentItem = {}, text = "") {
    if (!product) {
      return {};
    }

    const field = catalogService.getCurrentField(product, currentItem);

    if (!field) {
      return {};
    }

    return fieldResolver.resolve(field, text);
  }

  /*
   * =====================================================
   * Quantity
   * =====================================================
   */

  extractQuantity(
    product = null,
    currentItem = {},
    text = "",
    currentStep = null,
  ) {
    // Quantity should only be extracted when the
    // conversation is explicitly asking for quantity.
    if (currentStep !== "COLLECT_QUANTITY") {
      return null;
    }

    // Reject dates such as 12/08/2026
    if (/\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}/.test(text)) {
      return null;
    }

    // Accept plain integer input: "2", "10", "25"
    const match = text.match(/^\d+$/);

    if (!match) {
      return null;
    }

    const quantity = Number(match[0]);

    if (!Number.isInteger(quantity) || quantity < 1) {
      return null;
    }

    return quantity;
  }

  /*
   * =====================================================
   * Artwork
   * =====================================================
   */

  extractArtwork(text = "") {
    if (/need design|design service|design it|create artwork/i.test(text)) {
      return {
        status: "NEED_DESIGN",
        reference: null,
      };
    }

    if (/have artwork|artwork ready|already have|ready/i.test(text)) {
      return {
        status: "CUSTOMER_ARTWORK",
        reference: null,
      };
    }

    return null;
  }
  /*
   * =====================================================
   * Delivery
   * =====================================================
   */

  extractDelivery(text = "", currentStep = null, message = "") {
    const delivery = deliveryService.parse(text);

    /*
     * =====================================================
     * Delivery Address
     * =====================================================
     */

    if (
      currentStep === "ASK_DELIVERY_ADDRESS" &&
      !delivery.address &&
      message.trim()
    ) {
      delivery.address = message.trim();
    }

    /*
     * =====================================================
     * Delivery Date
     * =====================================================
     */

    if (currentStep === "ASK_DELIVERY_DATE") {
      if (!delivery.requiredDate && message.trim()) {
        delivery.requiredDate = this.resolveDeliveryDate(message);
      }
    }

    return delivery;
  }

  /*
   * =====================================================
   * Resolve Delivery Date
   * =====================================================
   */

  resolveDeliveryDate(message = "") {
    const text = message.trim().toLowerCase();

    const today = new Date();

    /*
     * -----------------------------------------------------
     * Today
     * -----------------------------------------------------
     */

    if (/\btoday\b/.test(text)) {
      return this.formatDate(today);
    }

    /*
     * -----------------------------------------------------
     * Tomorrow
     * -----------------------------------------------------
     */

    if (/\btomorrow\b/.test(text)) {
      const date = new Date(today);
      date.setDate(date.getDate() + 1);

      return this.formatDate(date);
    }

    /*
     * -----------------------------------------------------
     * Day names
     * -----------------------------------------------------
     */

    const days = {
      sunday: 0,
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6,
    };

    for (const [dayName, targetDay] of Object.entries(days)) {
      if (new RegExp(`\\b${dayName}\\b`).test(text)) {
        return this.getNextDay(targetDay, today);
      }
    }

    /*
     * -----------------------------------------------------
     * Explicit date
     * -----------------------------------------------------
     *
     * If the customer says:
     *
     * 20/08/2026
     * 20-08-2026
     *
     * keep the existing value.
     */

    const explicitDate = this.extractExplicitDate(text);

    if (explicitDate) {
      return explicitDate;
    }

    /*
     * -----------------------------------------------------
     * Fallback
     * -----------------------------------------------------
     */

    return message.trim();
  }

  /*
   * =====================================================
   * Get Next Day
   * =====================================================
   */

  getNextDay(targetDay, fromDate = new Date()) {
    const date = new Date(fromDate);

    const currentDay = date.getDay();

    let difference = targetDay - currentDay;

    /*
     * If today is Friday and customer says Friday,
     * interpret it as NEXT Friday rather than today.
     */

    if (difference <= 0) {
      difference += 7;
    }

    date.setDate(date.getDate() + difference);

    return this.formatDate(date);
  }

  /*
   * =====================================================
   * Format Date
   * =====================================================
   */

  formatDate(date) {
    const year = date.getFullYear();

    const month = String(date.getMonth() + 1).padStart(2, "0");

    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  /*
   * =====================================================
   * Explicit Date
   * =====================================================
   */

  extractExplicitDate(text = "") {
    const match = text.match(/\b(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})\b/);

    if (!match) {
      return null;
    }

    let [, day, month, year] = match;

    day = Number(day);
    month = Number(month);

    year = Number(year);

    if (year < 100) {
      year += 2000;
    }

    const date = new Date(year, month - 1, day);

    /*
     * Validate the date so something like
     * 32/99/2026 isn't accepted.
     */

    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return null;
    }

    return this.formatDate(date);
  }
  /*
   * =====================================================
   * Confirmation
   * =====================================================
   */

  extractConfirmation(text = "") {
    return this.contains(text, CONFIRM_KEYWORDS);
  }

  /*
   * =====================================================
   * Add Product
   * =====================================================
   */

  extractAddAnotherProduct(text = "") {
    return this.contains(text, ADD_PRODUCT_KEYWORDS);
  }

  /*
   * =====================================================
   * Helpers
   * =====================================================
   */

  normalize(message = "") {
    return message.trim().toLowerCase().replace(/\s+/g, " ");
  }

  contains(text = "", keywords = []) {
    return keywords.some((keyword) => text.includes(keyword));
  }
}
