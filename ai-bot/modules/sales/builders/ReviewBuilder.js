export default class ReviewBuilder {
  build(requirement = {}, pricing = {}, delivery = {}, recommendations = []) {
    const items = this.buildItems(requirement.items ?? []);

    const deliveryData = this.buildDelivery(delivery);

    const pricingData = this.buildPricing(pricing, delivery);

    const summary = this.buildSummary(requirement, pricing, delivery);

    return {
      items,

      delivery: deliveryData,

      pricing: pricingData,

      recommendations,

      summary,

      sections: this.buildSections(
        items,
        deliveryData,
        pricingData,
        summary,
        recommendations,
      ),
    };
  }

  buildItems(items = []) {
    return items.map((item) => {
      const fields = {
        ...(item.formData ?? {}),
        ...(item.productData ?? {}),
      };

      return {
        product: item.selectedProduct ?? item.product ?? null,

        parentProduct: item.product ?? null,

        selection: item.selection ?? item.variant ?? null,

        selectedProduct: item.selectedProduct ?? null,

        fields,

        formData: fields,

        pricing: item.pricing ?? {},

        addons: item.addons?.items ?? [],

        notes: item.notes ?? [],

        completed: Boolean(item.completed),
      };
    });
  }

  buildDelivery(delivery = {}) {
    return {
      method: delivery.method ?? delivery.type ?? null,

      address: delivery.address ?? null,

      requiredDate: delivery.requiredDate ?? null,

      charge: Number(delivery.charge ?? 0),
    };
  }

  buildPricing(pricing = {}, delivery = {}) {
    const subtotal = Number(pricing.subtotal ?? 0);

    const deliveryCharge = Number(delivery.charge ?? pricing.delivery ?? pricing.deliveryCharge ?? 0);

    const totalBeforeVAT = Number(pricing.totalBeforeVAT ?? pricing.total ?? subtotal + deliveryCharge);

    return {
      subtotal,

      deliveryCharge,

      tax: 0,

      totalBeforeVAT,

      total: totalBeforeVAT,

      currency: pricing.currency ?? "AED",
    };
  }

  buildSummary(requirement = {}, pricing = {}, delivery = {}) {
    const subtotal = Number(pricing.subtotal ?? 0);

    const deliveryCharge = Number(delivery.charge ?? pricing.deliveryCharge ?? pricing.delivery ?? 0);

    const totalBeforeVAT = Number(pricing.totalBeforeVAT ?? pricing.total ?? subtotal + deliveryCharge);

    return {
      totalItems: Array.isArray(requirement.items)
        ? requirement.items.length
        : 0,

      subtotal,

      deliveryCharge,

      totalBeforeVAT,

      total: totalBeforeVAT,

      currency: pricing.currency ?? "AED",
    };
  }

  buildSections(items, delivery, pricing, summary, recommendations = []) {
    const sections = [
      {
        id: "ORDER_ITEMS",
        title: "Order Summary",
        items,
      },

      {
        id: "DELIVERY",
        title: "Delivery",
        data: delivery,
      },

      {
        id: "PRICING",
        title: "Pricing",
        data: pricing,
      },

      {
        id: "SUMMARY",
        title: "Summary",
        data: summary,
      },
    ];

    if (recommendations.length > 0) {
      sections.push({
        id: "RECOMMENDATIONS",
        title: "Recommended Products",
        items: recommendations,
      });
    }

    return sections;
  }
}
