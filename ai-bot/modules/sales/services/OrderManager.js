import crypto from "crypto";

import LiveRequirementBuilder from "../builders/LiveRequirementBuilder.js";

const builder = new LiveRequirementBuilder();

export default class OrderManager {
  /*
   * =====================================================
   * Order
   * =====================================================
   */

  create(order = null) {
    return order ?? builder.build();
  }

  clone(order = {}) {
    return structuredClone(
      typeof order?.toObject === "function" ? order.toObject() : order,
    );
  }

  reset() {
    return builder.build();
  }

  /*
   * =====================================================
   * Items
   * =====================================================
   */

  getItems(order = {}) {
    return order.items ?? [];
  }

  hasItems(order = {}) {
    return this.getItems(order).length > 0;
  }

  isEmpty(order = {}) {
    return !this.hasItems(order);
  }

  getItemCount(order = {}) {
    return this.getItems(order).length;
  }

  getCurrentItem(order = {}) {
    const items = this.getItems(order);

    if (!items.length) {
      return null;
    }

    return items[order.currentItem ?? 0] ?? null;
  }

  /*
   * =====================================================
   * Product
   * =====================================================
   */

  getCurrentProduct(order = {}) {
    return this.getCurrentItem(order)?.product ?? null;
  }

  updateProduct(order = {}, product = {}) {
    return this.updateCurrentItem(order, {
      product,
    });
  }

  /*
   * =====================================================
   * Selection
   * =====================================================
   */

  getSelection(order = {}) {
    return this.getCurrentItem(order)?.selection ?? null;
  }

  updateSelection(order = {}, selection = {}) {
    return this.updateCurrentItem(order, {
      selection,
    });
  }

  /*
   * =====================================================
   * Product Data
   * =====================================================
   */

  getProductData(order = {}) {
    return this.getCurrentItem(order)?.productData ?? {};
  }

  updateProductData(order = {}, values = {}) {
    return this.updateCurrentItem(order, {
      productData: values,
    });
  }

  updateProductField(order = {}, fieldId, value) {
    if (!fieldId) {
      return order;
    }

    const current = this.getProductData(order);

    return this.updateProductData(order, {
      ...current,
      [fieldId]: value,
    });
  }

  getProductField(order = {}, fieldId) {
    return this.getProductData(order)?.[fieldId];
  }

  /*
   * =====================================================
   * Requirements
   * =====================================================
   */

  getRequirements(order = {}) {
    return this.getCurrentItem(order)?.requirements ?? [];
  }

  getRequirement(order = {}, requirementId) {
    return this.getRequirements(order).find(
      (requirement) => requirement.id === requirementId,
    );
  }

  updateRequirement(order = {}, requirement = {}) {
    const item = this.getCurrentItem(order);

    if (!item) {
      return order;
    }

    const requirements = [...(item.requirements ?? [])];

    const index = requirements.findIndex(
      (existing) => existing.id === requirement.id,
    );

    if (index === -1) {
      requirements.push(requirement);
    } else {
      requirements[index] = {
        ...requirements[index],
        ...requirement,
      };
    }

    return this.updateCurrentItem(order, {
      requirements,
    });
  }

  /*
   * =====================================================
   * Workflow
   * =====================================================
   */

  getWorkflow(order = {}) {
    return this.getCurrentItem(order)?.workflow ?? {};
  }

  updateWorkflow(order = {}, workflow = {}) {
    return this.updateCurrentItem(order, {
      workflow,
    });
  }

  updateWorkflowField(order = {}, key, value) {
    if (!key) {
      return order;
    }

    return this.updateWorkflow(order, {
      ...this.getWorkflow(order),
      [key]: value,
    });
  }

  getWorkflowField(order = {}, key) {
    return this.getWorkflow(order)?.[key];
  }

  /*
   * =====================================================
   * Item Management
   * =====================================================
   */

  addItem(order = {}, product = {}) {
    const item = builder.createItem(product);

    const items = [...this.getItems(order), item];

    return {
      ...order,

      items,

      currentItem: items.length - 1,
    };
  }

  updateCurrentItem(order = {}, values = {}) {
    const items = [...this.getItems(order)];

    const index = order.currentItem ?? 0;

    /*
     * =====================================================
     * NORMALIZE PRODUCT
     * =====================================================
     */

    const incomingProduct = values.product ?? {};

    const normalizedProduct = {
      id:
        incomingProduct.id ??
        incomingProduct.productId ??
        incomingProduct.slug ??
        incomingProduct.name ??
        null,

      name:
        incomingProduct.name ??
        incomingProduct.productName ??
        incomingProduct.title ??
        incomingProduct.slug ??
        null,

      slug: incomingProduct.slug ?? null,
    };

    /*
     * =====================================================
     * CREATE ITEM IF MISSING
     * =====================================================
     *
     * Do NOT require product.id specifically.
     *
     * A product can legitimately be identified by:
     *
     * - numeric id
     * - string id
     * - productId
     * - slug
     * - name
     */

    if (!items[index]) {
      if (!normalizedProduct.id && !normalizedProduct.name) {
        return order;
      }

      items.push(builder.createItem(normalizedProduct));

      order = {
        ...order,

        items,

        currentItem: items.length - 1,
      };
    }

    /*
     * =====================================================
     * CURRENT ITEM
     * =====================================================
     */

    const currentIndex = order.currentItem ?? 0;

    const current = items[currentIndex];

    /*
     * =====================================================
     * MERGE ITEM
     * =====================================================
     */

    items[currentIndex] = {
      ...current,

      ...values,

      /*
       * Product
       */

      product: {
        ...(current.product ?? {}),

        ...(values.product ?? {}),

        id:
          values.product?.id ??
          values.product?.productId ??
          current.product?.id ??
          current.product?.productId ??
          values.product?.slug ??
          values.product?.name ??
          current.product?.slug ??
          current.product?.name ??
          null,

        name:
          values.product?.name ??
          values.product?.productName ??
          values.product?.title ??
          current.product?.name ??
          null,

        slug: values.product?.slug ?? current.product?.slug ?? null,
      },

      /*
       * Selection
       */

      selection:
        values.selection !== undefined
          ? {
              ...(current.selection ?? {}),
              ...values.selection,
            }
          : current.selection,

      /*
       * Product Data
       */

      productData: {
        ...(current.productData ?? {}),
        ...(values.productData ?? {}),
      },

      /*
       * Workflow
       */

      workflow: {
        ...(current.workflow ?? {}),
        ...(values.workflow ?? {}),

        artwork: {
          ...(current.workflow?.artwork ?? {}),
          ...(values.workflow?.artwork ?? {}),
        },
      },

      /*
       * Requirements
       */

      requirements:
        values.requirements !== undefined
          ? [...values.requirements]
          : [...(current.requirements ?? [])],

      /*
       * Pricing
       */

      pricing: {
        ...(current.pricing ?? {}),
        ...(values.pricing ?? {}),
      },

      /*
       * Addons
       */

      addons: {
        completed:
          values.addons?.completed ?? current.addons?.completed ?? false,

        items:
          values.addons?.items !== undefined
            ? [...values.addons.items]
            : [...(current.addons?.items ?? [])],

        notes: values.addons?.notes ?? current.addons?.notes ?? null,
      },

      /*
       * Notes
       */

      notes:
        values.notes !== undefined
          ? [...values.notes]
          : [...(current.notes ?? [])],
    };

    return {
      ...order,
      items,
    };
  }

  /*
   * =====================================================
   * Item Status
   * =====================================================
   */

  completeCurrentItem(order = {}) {
    return this.updateCurrentItem(order, {
      completed: true,
    });
  }

  removeCurrentItem(order = {}) {
    const items = [...this.getItems(order)];

    if (!items.length) {
      return order;
    }

    items.splice(order.currentItem ?? 0, 1);

    return {
      ...order,

      items,

      currentItem: Math.max(
        0,
        Math.min(order.currentItem ?? 0, items.length - 1),
      ),
    };
  }

  /*
   * =====================================================
   * Customer
   * =====================================================
   */

  getCustomer(order = {}) {
    return order.customer ?? {};
  }

  updateCustomer(order = {}, customer = {}) {
    return {
      ...order,

      customer: {
        ...(order.customer ?? {}),
        ...customer,
      },
    };
  }

  /*
   * =====================================================
   * Delivery
   * =====================================================
   */

  getDelivery(order = {}) {
    return order.delivery ?? {};
  }

  updateDelivery(order = {}, delivery = {}) {
    return {
      ...order,

      delivery: {
        ...(order.delivery ?? {}),
        ...delivery,
      },
    };
  }

  /*
   * =====================================================
   * Pricing
   * =====================================================
   */

  getPricing(order = {}) {
    return order.pricing ?? {};
  }

  updatePricing(order = {}, pricing = {}) {
    return {
      ...order,

      pricing: {
        ...(order.pricing ?? {}),
        ...pricing,
      },
    };
  }
  /*
   * =====================================================
   * Pricing Totals
   * =====================================================
   */

  calculatePricing(order = {}) {
    const items = this.getItems(order);

    /*
     * =====================================================
     * Subtotal
     * =====================================================
     *
     * PricingService is responsible for calculating
     * each item's pricing.
     *
     * OrderManager only aggregates those values.
     */

    const subtotal = items.reduce((total, item) => {
      return total + Number(item?.pricing?.total ?? 0);
    }, 0);

    /*
     * =====================================================
     * Existing Delivery / Tax
     * =====================================================
     */

    const delivery = Number(order?.pricing?.delivery ?? 0);

    const tax = Number(order?.pricing?.tax ?? 0);

    /*
     * =====================================================
     * Final Order Total
     * =====================================================
     */

    const total = subtotal + delivery + tax;

    return {
      ...order,

      pricing: {
        ...(order.pricing ?? {}),

        currency: order?.pricing?.currency ?? "AED",

        subtotal,

        delivery,

        tax,

        total,
      },
    };
  }

  /*
   * =====================================================
   * Order Totals
   * =====================================================
   */

  calculateTotals(order = {}) {
    order.totalItems = this.getTotalItems(order);

    order.totalQuantity = this.getTotalQuantity(order);

    return this.calculatePricing(order);
  }

  /*
   * =====================================================
   * Review
   * =====================================================
   */

  setMode(order = {}, mode = "COLLECTING") {
    return {
      ...order,
      mode,
    };
  }

  markReviewed(order = {}) {
    return {
      ...order,
      reviewCompleted: true,
    };
  }

  hasBeenReviewed(order = {}) {
    return order.reviewCompleted === true;
  }

  /*
   * =====================================================
   * Confirmation
   * =====================================================
   */

  confirm(order = {}) {
    return {
      ...order,
      confirmed: true,
    };
  }

  unconfirm(order = {}) {
    return {
      ...order,
      confirmed: false,
    };
  }

  isConfirmed(order = {}) {
    return order.confirmed === true;
  }

  /*
   * =====================================================
   * Totals
   * =====================================================
   */

  getTotalQuantity(order = {}) {
    return this.getItems(order).reduce((total, item) => {
      return total + Number(item.workflow?.quantity ?? 0);
    }, 0);
  }

  getTotalItems(order = {}) {
    return this.getItems(order).length;
  }

  calculateTotals(order = {}) {
    order.totalItems = this.getTotalItems(order);

    order.totalQuantity = this.getTotalQuantity(order);

    return this.calculatePricing(order);
  }

  /*
   * =====================================================
   * Conversation Memory
   * =====================================================
   */

  buildConversationMemory(order = {}) {
    return {
      order: this.clone(order),

      updatedAt: new Date(),
    };
  }

  /*
   * =====================================================
   * Order Number
   * =====================================================
   */

  generateOrderNumber(order = {}) {
    if (order.orderNumber) {
      return order;
    }

    const now = new Date();

    const date =
      now.getFullYear().toString() +
      String(now.getMonth() + 1).padStart(2, "0") +
      String(now.getDate()).padStart(2, "0");

    const random = crypto.randomBytes(4).toString("hex").toUpperCase();

    return {
      ...order,
      orderNumber: `ORD-${date}-${random}`,
    };
  }

  /*
   * =====================================================
   * Draft Order
   * =====================================================
   */

  createDraftOrder(order = {}) {
    const draft = {
      status: order.confirmed ? "CONFIRMED" : "COLLECTING",

      confirmed: order.confirmed ?? false,

      customer: structuredClone(order.customer ?? {}),

      delivery: structuredClone(order.delivery ?? {}),

      pricing: structuredClone(order.pricing ?? {}),

      items: [],

      totalItems: 0,

      totalQuantity: 0,

      notes: structuredClone(order.notes ?? []),
    };

    return this.updateDraftOrder(draft, order);
  }

  updateDraftOrder(draft = {}, order = {}) {
    const incomingCustomer = order.customer ?? {};

    const hasCustomerData =
      incomingCustomer.name ||
      incomingCustomer.phone ||
      incomingCustomer.email ||
      incomingCustomer.company;

    draft.customer = hasCustomerData
      ? {
          ...(draft.customer ?? {}),
          ...structuredClone(incomingCustomer),
        }
      : structuredClone(draft.customer ?? {});
    draft.delivery = structuredClone(order.delivery ?? {});

    draft.pricing = structuredClone(order.pricing ?? {});

    draft.items = this.getItems(order).map((item) => ({
      product: structuredClone(item.product ?? {}),

      selection: structuredClone(item.selection ?? {}),

      productData: structuredClone(item.productData ?? {}),

      requirements: structuredClone(item.requirements ?? []),

      workflow: structuredClone(item.workflow ?? {}),

      pricing: structuredClone(item.pricing ?? {}),

      addons: structuredClone(
        item.addons ?? {
          completed: false,
          items: [],
          notes: null,
        },
      ),

      notes: structuredClone(item.notes ?? []),

      completed: item.completed ?? false,
    }));

    draft.confirmed = order.confirmed ?? false;

    draft.status = draft.confirmed ? "CONFIRMED" : "COLLECTING";

    return this.calculateTotals(draft);
  }

  /*
   * =====================================================
   * Order Status
   * =====================================================
   */

  confirmOrder(order = {}) {
    const confirmedOrder = this.generateOrderNumber({
      ...order,
      confirmed: true,
      status: "CONFIRMED",
    });

    return this.calculateTotals(confirmedOrder);
  }

  cancelOrder(order = {}) {
    return {
      ...order,
      confirmed: false,
      status: "CANCELLED",
    };
  }

  /*
   * =====================================================
   * Order Mapping
   * =====================================================
   */

  buildOrder(order = {}, existingOrder = null) {
    const draft = existingOrder
      ? this.clone(existingOrder)
      : this.createDraftOrder(order);

    return this.updateDraftOrder(draft, order);
  }

  /*
   * =====================================================
   * Helpers
   * =====================================================
   */

  hasSelection(order = {}) {
    return !!this.getSelection(order)?.id;
  }

  hasWorkflowField(order = {}, key) {
    return (
      this.getWorkflowField(order, key) !== undefined &&
      this.getWorkflowField(order, key) !== null
    );
  }

  hasProductField(order = {}, key) {
    return (
      this.getProductField(order, key) !== undefined &&
      this.getProductField(order, key) !== null
    );
  }

  hasProductFieldValue(item = {}, key = "") {
    const value = item.productData?.[key];

    return value !== undefined && value !== null;
  }

  hasRequirement(order = {}, requirementId) {
    return !!this.getRequirement(order, requirementId);
  }

  isRequirementCompleted(order = {}, requirementId) {
    const requirement = this.getRequirement(order, requirementId);

    if (!requirement) {
      return false;
    }

    return (
      requirement.status === "RECEIVED" || requirement.status === "VERIFIED"
    );
  }

  areRequirementsCompleted(order = {}) {
    return this.getRequirements(order).every((requirement) => {
      if (!requirement.required) {
        return true;
      }

      return (
        requirement.status === "RECEIVED" || requirement.status === "VERIFIED"
      );
    });
  }

  /*
   * =====================================================
   * Item Navigation
   * =====================================================
   */

  setCurrentItem(order = {}, index = 0) {
    const items = this.getItems(order);

    if (!items.length) {
      return order;
    }

    return {
      ...order,

      currentItem: Math.max(0, Math.min(index, items.length - 1)),
    };
  }

  nextItem(order = {}) {
    return this.setCurrentItem(order, (order.currentItem ?? 0) + 1);
  }

  previousItem(order = {}) {
    return this.setCurrentItem(order, (order.currentItem ?? 0) - 1);
  }

  /*
   * =====================================================
   * Completion
   * =====================================================
   */

  areAllItemsCompleted(order = {}) {
    return this.getItems(order).every((item) => item.completed === true);
  }

  markAllItemsCompleted(order = {}) {
    return {
      ...order,

      items: this.getItems(order).map((item) => ({
        ...item,

        completed: true,
      })),
    };
  }

  /*
   * =====================================================
   * Notes
   * =====================================================
   */

  addOrderNote(order = {}, note = "") {
    if (!note) {
      return order;
    }

    return {
      ...order,

      notes: [...(order.notes ?? []), note],
    };
  }

  addItemNote(order = {}, note = "") {
    if (!note) {
      return order;
    }

    const item = this.getCurrentItem(order);

    if (!item) {
      return order;
    }

    return this.updateCurrentItem(order, {
      notes: [...(item.notes ?? []), note],
    });
  }

  /*
   * =====================================================
   * Reset
   * =====================================================
   */

  clearSelection(order = {}) {
    return this.updateCurrentItem(order, {
      selection: {},
    });
  }

  clearProductData(order = {}) {
    return this.updateCurrentItem(order, {
      productData: {},
    });
  }

  clearRequirements(order = {}) {
    return this.updateCurrentItem(order, {
      requirements: [],
    });
  }

  clearWorkflow(order = {}) {
    return this.updateCurrentItem(order, {
      workflow: {},
    });
  }

  createRequirement(order = null) {
    return this.create(order);
  }

  /*
   * =====================================================
   * Validation
   * =====================================================
   */

  isCurrentItemReady(order = {}) {
    const item = this.getCurrentItem(order);

    if (!item) {
      return false;
    }

    const productIdentity =
      item.product?.id ??
      item.product?.productId ??
      item.product?.slug ??
      item.product?.name;

    if (!productIdentity) {
      return false;
    }

    return this.areRequirementsCompleted(order);
  }
}
