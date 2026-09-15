import ConversationModes from "../helpers/ConversationModes.js";

const DEFAULT_CURRENCY = "AED";

export default class LiveRequirementBuilder {
  build(existing = {}) {
    return this.merge(
      {
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
          currency: DEFAULT_CURRENCY,
          subtotal: 0,
          delivery: 0,
          tax: 0,
          total: 0,
        },

        reviewCompleted: false,
        confirmed: false,

        status: "COLLECTING",

        notes: [],
      },
      existing,
    );
  }

  createItem(product = {}) {
    const productId = product.id ?? product.productId ?? product.slug ?? null;

    const productName =
      product.name ??
      product.productName ??
      product.title ??
      product.label ??
      product.slug ??
      null;

    const productSlug = product.slug ?? product.id ?? product.productId ?? null;

    return {
      product: {
        id: productId,
        name: productName,
        slug: productSlug,
      },

      // Parent catalog selection/category.

      selection: null,

      // Final concrete child product when
      // selection contains nested products.

      selectedProduct: null,

      orderStarted: product.orderStarted ?? false,

      // Catalog form state.

      formMode: product.formMode ?? false,

      // Only catalog-defined form values.
      formData: { ...(product.formData ?? {}) },

      // Normalized alias for compatibility.
      // Must contain the same catalog values as formData.
      productData: {
        ...(product.productData ?? {}),
        ...(product.formData ?? {}),
      },

      // Catalog requirement values.
      requirements: [],

      // Catalog workflow state.
      workflow: { ...(product.workflow ?? {}) },

      delivery: product.delivery ?? null,

      artwork: product.artwork ?? null,
      artworkReceived: product.artworkReceived ?? Boolean(product.artwork?.received),

      pricing: {
        currency: DEFAULT_CURRENCY,
        unitPrice: null,
        subtotal: 0,
        discount: 0,
        total: 0,
      },

      addons: {
        completed: false,
        items: [],
        notes: null,
        ...(product.addons ?? {}),
      },

      notes: [],

      completed: false,
    };
  }

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

    if (!Array.isArray(values.items)) {
      return merged;
    }

    merged.items = values.items.map((newItem, index) => {
      const oldItem = order.items?.[index] ?? {};

      const product = this.mergeProduct(oldItem.product, newItem.product);

      const formData = {
        ...(oldItem.formData ?? {}),
        ...(newItem.formData ?? {}),
      };

      const productData = {
        ...(oldItem.productData ?? {}),
        ...(newItem.productData ?? {}),
        ...formData,
      };

      return {
        ...oldItem,
        ...newItem,

        product,

        selection:
          newItem.selection !== undefined
            ? this.mergeNullableObject(oldItem.selection, newItem.selection)
            : (oldItem.selection ?? null),

        selectedProduct:
          newItem.selectedProduct !== undefined
            ? newItem.selectedProduct
            : (oldItem.selectedProduct ?? null),

        formMode:
          newItem.formMode !== undefined
            ? Boolean(newItem.formMode)
            : Boolean(oldItem.formMode),

        formData,

        productData,

        requirements:
          newItem.requirements !== undefined
            ? [...newItem.requirements]
            : [...(oldItem.requirements ?? [])],

        workflow: {
          ...(oldItem.workflow ?? {}),
          ...(newItem.workflow ?? {}),
        },

        pricing: {
          ...(oldItem.pricing ?? {}),
          ...(newItem.pricing ?? {}),
        },

        addons: {
          ...(oldItem.addons ?? {}),
          ...(newItem.addons ?? {}),

          items:
            newItem.addons?.items !== undefined
              ? [...newItem.addons.items]
              : [...(oldItem.addons?.items ?? [])],
        },

        notes:
          newItem.notes !== undefined
            ? [...newItem.notes]
            : [...(oldItem.notes ?? [])],

        completed: newItem.completed ?? oldItem.completed ?? false,
      };
    });

    return merged;
  }

  mergeProduct(oldProduct = {}, newProduct = {}) {
    return {
      ...(oldProduct ?? {}),
      ...(newProduct ?? {}),

      id:
        newProduct?.id ??
        newProduct?.productId ??
        oldProduct?.id ??
        oldProduct?.productId ??
        newProduct?.slug ??
        oldProduct?.slug ??
        null,

      name:
        newProduct?.name ??
        newProduct?.productName ??
        newProduct?.title ??
        oldProduct?.name ??
        oldProduct?.productName ??
        oldProduct?.title ??
        newProduct?.slug ??
        oldProduct?.slug ??
        null,

      slug:
        newProduct?.slug ??
        oldProduct?.slug ??
        newProduct?.id ??
        oldProduct?.id ??
        null,
    };
  }

  mergeNullableObject(oldValue, newValue) {
    if (newValue === null) {
      return null;
    }

    return {
      ...(oldValue ?? {}),
      ...(newValue ?? {}),
    };
  }

  reset() {
    return this.build();
  }
}
