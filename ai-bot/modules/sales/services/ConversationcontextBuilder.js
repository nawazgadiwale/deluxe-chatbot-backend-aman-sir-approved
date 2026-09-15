import DecisionTypes from "../helpers/DecisionTypes.js";

const DISCOVERY_CLARIFICATION =
  DecisionTypes.DISCOVERY_CLARIFICATION ?? "DISCOVERY_CLARIFICATION";

export default class ConversationContextBuilder {
  build(requirement = {}, decision = {}, customerMessage = "") {
    const c = decision.context ?? {};

    const base = {
      a: decision.type,
      m: customerMessage,
    };

    switch (decision.type) {
      /*
       * LEGACY / EXPLICIT PRODUCT SELECTION
       *
       * Kept for compatibility with existing actions.
       * Natural-language discovery must not generate this decision.
       */
      case DecisionTypes.SELECT_PRODUCT:
        return {
          ...base,
          products: (c.products ?? []).map((p) => ({
            i: p.id,
            n: p.name,
          })),
        };

      /*
       * NATURAL-LANGUAGE DISCOVERY
       *
       * Used only when the catalog resolver found multiple possible
       * matches. No selectable product actions are exposed here.
       */
      case DISCOVERY_CLARIFICATION:
        return {
          ...base,
          products: (c.products ?? []).map((p) => ({
            i: p.id,
            n: p.name,
          })),
          message: c.message ?? null,
        };

      case DecisionTypes.RECOMMEND_SELECTION:
        return {
          ...base,
          p: this.product(c.product),
          r: this.recommendation(c.recommendation),
        };

      case DecisionTypes.SELECT_SELECTION:
        return {
          ...base,
          p: this.product(c.product),
          label: c.selection?.label ?? null,
          options: (c.options ?? []).map((o) => ({
            i: o.id,
            n: o.name,
            b: o.badge ?? null,
            price: o.startingPrice ?? null,
          })),
        };

      case DecisionTypes.COLLECT_PRODUCT_FIELD:
        return {
          ...base,
          p: this.product(c.product),
          field: this.field(c.field),
        };

      case DecisionTypes.COLLECT_REQUIREMENT:
        return {
          ...base,
          p: this.product(c.product),
          requirement: this.requirement(c.requirement),
        };

      case DecisionTypes.SELECT_ADDONS:
        return {
          ...base,
          p: this.product(c.product),
          addons: (c.addons?.options ?? []).map((a) => ({
            i: a.id,
            n: a.name,
          })),
        };

      case DecisionTypes.SKIP_ADDONS:
        return {
          ...base,
          p: this.product(c.product),
        };

      case DecisionTypes.COLLECT_QUANTITY:
        return {
          ...base,
          p: this.product(c.product),
          selection: c.selection?.name ?? null,
        };

      case DecisionTypes.COLLECT_ARTWORK:
        return {
          ...base,
          p: this.product(c.product),
        };

      case DecisionTypes.SELECT_DELIVERY_METHOD:
        return {
          ...base,
          options: ["Delivery", "Pickup"],
        };

      case DecisionTypes.ASK_DELIVERY_ADDRESS:
      case DecisionTypes.DELIVERY_ADDRESS:
      case DecisionTypes.ASK_DELIVERY_DATE:
      case DecisionTypes.DELIVERY_DATE:
      case DecisionTypes.ARTWORK:
        return base;

      case DecisionTypes.REVIEW_ORDER:
        return {
          ...base,
          order: this.reviewContext(c.order),
        };

      case DecisionTypes.ORDER_COMPLETED:
        return base;

      default:
        return base;
    }

  }

  product(product) {
    if (!product) return null;

    return {
      i: product.id,
      n: product.name,
    };

  }

  recommendation(recommendation) {
    if (!recommendation) return null;

    return {
      i: recommendation.id,
      n: recommendation.name,
      b: recommendation.badge ?? null,
      price: recommendation.startingPrice ?? null,
      why: recommendation.recommendationReason ?? null,
      f: (recommendation.features ?? []).slice(0, 2),
    };

  }

  field(field) {
    if (!field) return null;

    return {
      i: field.id,
      l: field.label ?? field.name,
      q: field.question,
      d: field.description ?? null,
      t: field.type,
      o: (field.options ?? []).slice(0, 8).map((o) => ({
        i: o.id,
        n: o.label ?? o.name ?? o.value,
      })),
    };

  }

  requirement(requirement) {
    if (!requirement) return null;


    return {
      i: requirement.id,
      n: requirement.name,
      d: requirement.description ?? null,
      q: requirement.instruction ?? null,
      req: requirement.required ?? false,
    };


  }

  reviewContext(order = {}) {
    if (!order) return null;


    return {
      customer: order.customer?.name ?? null,

      items: (order.items ?? []).map((item) => ({
        product: item.product?.name ?? null,
        selection: item.selection?.name ?? null,
        quantity: item.quantity ?? null,
      })),

      delivery: order.delivery
        ? {
          method: order.delivery.method ?? null,
          address: order.delivery.address ?? null,
          date: order.delivery.requiredDate ?? null,
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
