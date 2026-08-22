export default class ReviewBuilder {
  build(requirement = {}, pricing = {}, delivery = {}, recommendations = []) {
    return {
      items: this.buildItems(requirement.items ?? []),

      delivery: this.buildDelivery(delivery),

      pricing: this.buildPricing(pricing, delivery),

      recommendations,

      summary: this.buildSummary(requirement, pricing, delivery),

      sections: this.buildSections(
        requirement,
        pricing,
        delivery,
        recommendations,
      ),
    };
  }

  /*
   * =====================================================
   * Items
   * =====================================================
   */

  buildItems(items = []) {
    return items.map((item) => ({
      product: item.product,

      variant: item.variant,

      fields: item.fields ?? {},

      quantity: item.fields?.quantity ?? null,

      artwork: item.fields?.artwork ?? null,

      pricing: item.pricing ?? {},

      addons: item.addons ?? [],

      notes: item.notes ?? [],
    }));
  }

  /*
   * =====================================================
   * Delivery
   * =====================================================
   */

  buildDelivery(delivery = {}) {
    return {
      method: delivery.method,

      address: delivery.address,

      requiredDate: delivery.requiredDate,

      charge: delivery.charge ?? 0,
    };
  }

  /*
   * =====================================================
   * Pricing
   * =====================================================
   */

  buildPricing(pricing = {}, delivery = {}) {
    const deliveryCharge = delivery.charge ?? 0;

    return {
      subtotal: pricing.subtotal ?? 0,

      deliveryCharge,

      total: pricing.total ?? (pricing.subtotal ?? 0) + deliveryCharge,

      currency: pricing.currency ?? "AED",
    };
  }

  /*
   * =====================================================
   * Summary
   * =====================================================
   */

  buildSummary(requirement = {}, pricing = {}, delivery = {}) {
    return {
      totalItems: requirement.items?.length ?? 0,

      subtotal: pricing.subtotal ?? 0,

      deliveryCharge: delivery.charge ?? 0,

      total: pricing.total ?? (pricing.subtotal ?? 0) + (delivery.charge ?? 0),

      currency: pricing.currency ?? "AED",
    };
  }

  /*
   * =====================================================
   * Review Sections
   * =====================================================
   */

  buildSections(
    requirement = {},
    pricing = {},
    delivery = {},
    recommendations = [],
  ) {
    return [
      {
        id: "ORDER_ITEMS",
        title: "Order Summary",
        items: this.buildItems(requirement.items ?? []),
      },
      {
        id: "DELIVERY",
        title: "Delivery",
        data: this.buildDelivery(delivery),
      },
      {
        id: "PRICING",
        title: "Pricing",
        data: this.buildPricing(pricing, delivery),
      },
      {
        id: "SUMMARY",
        title: "Summary",
        data: this.buildSummary(requirement, pricing, delivery),
      },
      ...(recommendations.length
        ? [
            {
              id: "RECOMMENDATIONS",
              title: "Recommended Products",
              items: recommendations,
            },
          ]
        : []),
    ];
  }
}
