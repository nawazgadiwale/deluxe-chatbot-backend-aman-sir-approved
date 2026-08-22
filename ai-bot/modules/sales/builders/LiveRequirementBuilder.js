import ConversationModes from "../helpers/ConversationModes.js";

export default class LiveRequirementBuilder {
  /*
   * =====================================================
   * Live Order
   * =====================================================
   */

  build() {
    return {
      mode: ConversationModes.DISCOVERY,

      currentItem: 0,

      items: [],

      customer: {
        name: null,
        company: null,
        phone: null,
        email: null,
      },

      delivery: {
        method: null,
        address: null,
        requiredDate: null,
      },

      editing: {
        active: false,
        step: null,
      },

      pricing: {
        currency: "AED",
        subtotal: 0,
        delivery: 0,
        tax: 0,
        total: 0,
      },

      reviewCompleted: false,

      confirmed: false,

      status: "COLLECTING",

      notes: [],
    };
  }

  /*
   * =====================================================
   * Order Item
   * =====================================================
   */

  createItem(product = {}) {
    /*
     * -----------------------------------------------------
     * Product Identity
     * -----------------------------------------------------
     *
     * ID can be:
     *
     * number
     * string
     *
     * Never force it to a specific type.
     */

    const productId =
      product.id ??
      product.productId ??
      product.slug ??
      product.name ??
      product.title ??
      null;

    /*
     * -----------------------------------------------------
     * Product Name
     * -----------------------------------------------------
     *
     * IMPORTANT:
     *
     * Never create:
     *
     * name: null
     *
     * when another valid product name exists.
     */

    const productName =
      product.name ??
      product.productName ??
      product.title ??
      product.label ??
      product.slug ??
      null;

    /*
     * -----------------------------------------------------
     * Product Slug
     * -----------------------------------------------------
     */

    const productSlug = product.slug ?? product.id ?? product.productId ?? null;

    return {
      product: {
        id: productId,

        name: productName,

        slug: productSlug,
      },

      selection: null,

      productData: {},

      requirements: [],

      workflow: {
        quantity: null,

        artwork: {
          status: null,
          reference: null,
        },
      },

      pricing: {
        currency: "AED",

        unitPrice: null,

        subtotal: 0,

        discount: 0,

        total: 0,
      },

      addons: {
        completed: false,

        items: [],

        notes: null,
      },

      notes: [],

      completed: false,
    };
  }

  /*
   * =====================================================
   * Merge
   * =====================================================
   */

  merge(order = {}, values = {}) {
    const merged = {
      ...order,

      ...values,

      customer: {
        ...(order.customer ?? {}),
        ...(values.customer ?? {}),
      },

      delivery: {
        ...(order.delivery ?? {}),
        ...(values.delivery ?? {}),
      },

      pricing: {
        ...(order.pricing ?? {}),
        ...(values.pricing ?? {}),
      },

      notes:
        values.notes !== undefined
          ? [...values.notes]
          : [...(order.notes ?? [])],
    };

    /*
     * ===================================================
     * IMPORTANT: PRESERVE ORDER ITEMS
     * ===================================================
     *
     * A partial update must NEVER replace the complete
     * product object with:
     *
     * {
     *   id: "...",
     *   name: null,
     *   slug: null
     * }
     *
     * Merge every item independently.
     */

    if (Array.isArray(values.items)) {
      merged.items = values.items.map((newItem, index) => {
        const oldItem = order.items?.[index] ?? {};

        return {
          ...oldItem,

          ...newItem,

          /*
           * Product must be merged, not replaced.
           */

          product: {
            ...(oldItem.product ?? {}),
            ...(newItem.product ?? {}),

            id: newItem.product?.id ?? oldItem.product?.id ?? null,

            name:
              newItem.product?.name ??
              newItem.product?.productName ??
              newItem.product?.title ??
              oldItem.product?.name ??
              oldItem.product?.productName ??
              oldItem.product?.title ??
              oldItem.product?.slug ??
              null,

            slug:
              newItem.product?.slug ??
              oldItem.product?.slug ??
              newItem.product?.id ??
              oldItem.product?.id ??
              null,
          },

          /*
           * Selection
           */

          selection: {
            ...(oldItem.selection ?? {}),
            ...(newItem.selection ?? {}),
          },

          /*
           * Product data
           */

          productData: {
            ...(oldItem.productData ?? {}),
            ...(newItem.productData ?? {}),
          },

          /*
           * Workflow
           */

          workflow: {
            ...(oldItem.workflow ?? {}),
            ...(newItem.workflow ?? {}),

            artwork: {
              ...(oldItem.workflow?.artwork ?? {}),
              ...(newItem.workflow?.artwork ?? {}),
            },
          },

          /*
           * Pricing
           */

          pricing: {
            ...(oldItem.pricing ?? {}),
            ...(newItem.pricing ?? {}),
          },

          /*
           * Addons
           */

          addons: {
            ...(oldItem.addons ?? {}),
            ...(newItem.addons ?? {}),

            items: newItem.addons?.items ?? oldItem.addons?.items ?? [],
          },

          /*
           * Notes
           */

          notes:
            newItem.notes !== undefined
              ? [...newItem.notes]
              : [...(oldItem.notes ?? [])],
        };
      });
    }

    return merged;
  }

  /*
   * =====================================================
   * Reset
   * =====================================================
   */

  reset() {
    return this.build();
  }
}
