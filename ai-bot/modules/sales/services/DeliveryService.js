export const DELIVERY_METHODS = Object.freeze({
  PICKUP: "pickup",
  DELIVERY: "delivery",
});

export const DELIVERY_CHARGES = Object.freeze({
  [DELIVERY_METHODS.DELIVERY]: 25,
  [DELIVERY_METHODS.PICKUP]: 0,
});

const DEFAULT_DELIVERY = Object.freeze({
  method: null,
  address: null,
  requiredDate: null,
  instructions: null,
});


export default class DeliveryService {
  /*
   * =====================================================
   * Update
   * =====================================================
   */

  update(requirement = {}, delivery = {}) {
    return {
      ...DEFAULT_DELIVERY,
      ...(requirement.delivery ?? {}),
      ...delivery,
    };
  }

  /*
   * =====================================================
   * Validation
   * =====================================================
   */

  validate(requirement = {}) {
    const delivery = this.update(requirement);

    const { method, address, requiredDate } = delivery;

    if (!method) {
      return {
        valid: false,
        field: "method",
        message: "Please select a delivery method.",
      };
    }

    if (method === DELIVERY_METHODS.DELIVERY && !address) {
      return {
        valid: false,
        field: "address",
        message: "Please provide the delivery address.",
      };
    }

    if (!requiredDate) {
      return {
        valid: false,
        field: "requiredDate",
        message: "Please provide the required date.",
      };
    }

    return {
      valid: true,
    };
  }

  /*
   * =====================================================
   * Pricing
   * =====================================================
   */

  calculate(requirement = {}) {
    const delivery = this.update(requirement);

    return {
      ...delivery,
      charge: this.calculateCharge(requirement),
    };
  }

  calculateCharge(requirement = {}) {
    const method =
      requirement?.delivery?.method ??
      requirement?.deliveryMethod ??
      requirement?.method ??
      null;

    if (method === DELIVERY_METHODS.DELIVERY) {
      return DELIVERY_CHARGES[DELIVERY_METHODS.DELIVERY];
    }

    return DELIVERY_CHARGES[DELIVERY_METHODS.PICKUP];
  }

  /*
   * =====================================================
   * State
   * =====================================================
   */

  isPickup(requirement = {}) {
    return requirement.delivery?.method === DELIVERY_METHODS.PICKUP;
  }

  isDelivery(requirement = {}) {
    return requirement.delivery?.method === DELIVERY_METHODS.DELIVERY;
  }

  isMethodSelected(requirement = {}) {
    return !!requirement.delivery?.method;
  }

  hasAddress(requirement = {}) {
    return !!requirement.delivery?.address;
  }

  hasRequiredDate(requirement = {}) {
    return !!requirement.delivery?.requiredDate;
  }

  isComplete(requirement = {}) {
    return this.validate(requirement).valid;
  }

  /*
   * =====================================================
   * Extraction
   * =====================================================
   */

  parse(message = "") {
    const text = message.trim().toLowerCase();

    const delivery = {};

    /*
     * -------------------------
     * Delivery Method
     * -------------------------
     */

    if (/\b(delivery|deliver|home delivery)\b/.test(text)) {
      delivery.method = DELIVERY_METHODS.DELIVERY;
    }

    if (/\b(pickup|pick up|collect|self pickup)\b/.test(text)) {
      delivery.method = DELIVERY_METHODS.PICKUP;
    }

    /*
     * -------------------------
     * Date
     * -------------------------
     */

    const dateMatch = message.match(
      /\b\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}\b|\b\d{4}[\/-]\d{1,2}[\/-]\d{1,2}\b/,
    );

    if (dateMatch) {
      delivery.requiredDate = dateMatch[0];
    }

    /*
     * -------------------------
     * Address
     * -------------------------
     */

    if (
      /\b(address|deliver to|ship to|street|road|building|villa|flat|apartment|office)\b/.test(
        text,
      )
    ) {
      delivery.address = message.trim();
    }

    return delivery;
  }
}
