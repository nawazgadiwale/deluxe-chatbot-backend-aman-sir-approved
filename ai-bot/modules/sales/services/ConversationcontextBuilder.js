import DecisionTypes from "../helpers/DecisionTypes.js";

export default class ConversationContextBuilder {
  build(requirement = {}, decision = {}, customerMessage = "") {
    const context = decision.context ?? {};

    switch (decision.type) {
      case DecisionTypes.SELECT_PRODUCT:
        return {
          action: DecisionTypes.SELECT_PRODUCT,
          customerMessage,
          products: (context.products ?? []).map((product) => ({
            id: product.id,
            name: product.name,
          })),
        };

      case DecisionTypes.RECOMMEND_SELECTION:
        return {
          action: DecisionTypes.RECOMMEND_SELECTION,
          customerMessage,
          product: this.product(context.product),
          recommendation: this.recommendation(context.recommendation),
        };

      case DecisionTypes.SELECT_SELECTION:
        return {
          action: DecisionTypes.SELECT_SELECTION,
          customerMessage,
          product: this.product(context.product),
          selectionLabel: context.selection?.label ?? null,
          options: (context.options ?? []).map((option) => ({
            id: option.id,
            name: option.name,
            badge: option.badge ?? null,
            startingPrice: option.startingPrice ?? null,
          })),
        };

      case DecisionTypes.COLLECT_PRODUCT_FIELD:
        return {
          action: DecisionTypes.COLLECT_PRODUCT_FIELD,
          customerMessage,
          product: this.product(context.product),
          field: this.field(context.field),
        };

      case DecisionTypes.COLLECT_REQUIREMENT:
        return {
          action: DecisionTypes.COLLECT_REQUIREMENT,
          customerMessage,
          product: this.product(context.product),
          requirement: this.requirement(context.requirement),
        };

      case DecisionTypes.SELECT_ADDONS:
        return {
          action: DecisionTypes.SELECT_ADDONS,
          customerMessage,
          product: this.product(context.product),
          addons: (context.addons?.options ?? []).map((addon) => ({
            id: addon.id,
            name: addon.name,
          })),
        };

      case DecisionTypes.SKIP_ADDONS:
        return {
          action: DecisionTypes.SKIP_ADDONS,
          customerMessage,
          product: this.product(context.product),
        };

      case DecisionTypes.COLLECT_QUANTITY:
        return {
          action: DecisionTypes.COLLECT_QUANTITY,
          customerMessage,
          product: this.product(context.product),
          selection: context.selection?.name ?? null,
        };

      case DecisionTypes.COLLECT_ARTWORK:
        return {
          action: DecisionTypes.COLLECT_ARTWORK,
          customerMessage,
          product: this.product(context.product),
        };

      case DecisionTypes.SELECT_DELIVERY_METHOD:
        return {
          action: DecisionTypes.SELECT_DELIVERY_METHOD,
          customerMessage,
          options: ["Delivery", "Pickup"],
        };

      case DecisionTypes.ASK_DELIVERY_ADDRESS:
        return {
          action: DecisionTypes.ASK_DELIVERY_ADDRESS,
          customerMessage,
        };

      case DecisionTypes.ASK_DELIVERY_DATE:
        return {
          action: DecisionTypes.ASK_DELIVERY_DATE,
          customerMessage,
        };

      case DecisionTypes.REVIEW_ORDER:
        return {
          action: DecisionTypes.REVIEW_ORDER,
          customerMessage,
          order: this.reviewContext(context.order),
        };

      case DecisionTypes.ORDER_COMPLETED:
        return {
          action: DecisionTypes.ORDER_COMPLETED,
          customerMessage,
        };

      default:
        return {
          action: decision.type,
          customerMessage,
        };
    }
  }

  product(product) {
    if (!product) {
      return null;
    }

    return {
      id: product.id,
      name: product.name,
    };
  }

  recommendation(recommendation) {
    if (!recommendation) {
      return null;
    }

    return {
      id: recommendation.id,
      name: recommendation.name,
      badge: recommendation.badge ?? null,
      description: recommendation.description ?? null,
      startingPrice: recommendation.startingPrice ?? null,
      reason: recommendation.recommendationReason ?? null,
      features: (recommendation.features ?? []).slice(0, 3),
    };
  }

  field(field) {
    if (!field) {
      return null;
    }

    return {
      id: field.id,
      label: field.label ?? field.name,
      question: field.question,
      description: field.description ?? null,
      type: field.type,
      options: (field.options ?? []).slice(0, 10),
    };
  }

  requirement(requirement) {
    if (!requirement) {
      return null;
    }

    return {
      id: requirement.id,
      name: requirement.name,
      description: requirement.description ?? null,
      instruction: requirement.instruction ?? null,
      required: requirement.required ?? false,
    };
  }

  reviewContext(order = {}) {
    if (!order) {
      return null;
    }

    return {
      customer: order.customer
        ? {
            name: order.customer.name ?? null,
          }
        : null,

      items: (order.items ?? []).map((item) => ({
        product: item.product?.name ?? null,

        selection: item.selection?.name ?? null,

        quantity: item.quantity ?? null,
      })),

      delivery: order.delivery
        ? {
            method: order.delivery.method ?? null,
            address: order.delivery.address ?? null,
            requiredDate: order.delivery.requiredDate ?? null,
          }
        : null,

      pricing: order.pricing
        ? {
            currency: order.pricing.currency ?? "AED",
            total: order.pricing.total ?? null,
          }
        : null,
    };
  }
}
