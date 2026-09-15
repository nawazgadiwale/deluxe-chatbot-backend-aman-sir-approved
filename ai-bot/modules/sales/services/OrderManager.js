import crypto from "crypto";

import LiveRequirementBuilder from "../builders/LiveRequirementBuilder.js";
import SalesCatalogService from "./SalesCatalogService.js";
import COMMON_ORDER_FIELDS from "./CommonOrderFields.js";
import PricingService from "./PricingService.js";

const builder = new LiveRequirementBuilder();
const catalogService = new SalesCatalogService();
const pricingService = new PricingService();

export default class OrderManager {
  /*
   * ORDER
   */

  create(order = null) {
    if (!order) return builder.build();
    const plain = typeof order?.toObject === "function" ? order.toObject() : order;
    return plain;
  }

  createRequirement(order = null) {
    return this.create(order);
  }

  reset() {
    return builder.build();
  }

  clone(order = {}) {
    const plain = typeof order?.toObject === "function" ? order.toObject() : order;
    return structuredClone(plain);
  }

  /*
   * ITEMS
   */

  getItems(order = {}) {
    return Array.isArray(order.items) ? order.items : [];
  }

  getItemCount(order = {}) {
    return this.getItems(order).length;
  }

  hasItems(order = {}) {
    return this.getItemCount(order) > 0;
  }

  isEmpty(order = {}) {
    return !this.hasItems(order);
  }

  getCurrentItem(order = {}) {
    const items = this.getItems(order);

    if (!items.length) {
      return null;
    }

    return items[order.currentItem ?? 0] ?? null;
  }

  /*
   * ADD ITEM
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

  addEmptyItem(order = {}) {
    return this.addItem(order, {});
  }

  /*
   * PRODUCT
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
   * VARIANT / SELECTION
   */

  getSelection(order = {}) {
    return this.getCurrentItem(order)?.selection ?? null;
  }

  hasSelection(order = {}) {
    return Boolean(this.getSelection(order)?.id);
  }

  updateSelection(order = {}, selection = {}) {
    return this.updateCurrentItem(order, {
      selection,
    });
  }

  /*
   * CURRENT ITEM UPDATE
   */

  updateCurrentItem(order = {}, values = {}) {
    const items = [...this.getItems(order)];

    const index = order.currentItem ?? 0;

    if (!items[index]) {
      return order;
    }

    const current = items[index];

    items[index] = this.mergeItem(current, values);

    return {
      ...order,
      items,
    };
  }

  mergeItem(current = {}, values = {}) {
    return {
      ...current,
      ...values,

      product: this.mergeProduct(current.product, values.product),

      selection:
        values.selection !== undefined
          ? {
              ...(current.selection ?? {}),
              ...(values.selection ?? {}),
            }
          : current.selection,

      selectedProduct:
        values.selectedProduct !== undefined
          ? values.selectedProduct
          : (current.selectedProduct ?? null),

      orderStarted:
        values.orderStarted !== undefined
          ? values.orderStarted
          : (current.orderStarted ?? false),

      formMode:
        values.formMode !== undefined
          ? values.formMode
          : (current.formMode ?? false),

      /*
       * ========================================================
       * FORM DATA
       * ========================================================
       *
       * This is the canonical storage location for
       * catalog-driven order form values.
       */

      formData:
        values.formData !== undefined
          ? { ...(values.formData ?? {}) }
          : { ...(current.formData ?? {}) },

      /*
       * Backwards compatibility with the old code.
       *
       * Existing PricingService / ReviewBuilder code can
       * continue reading productData until migrated.
       */

      productData:
        values.productData !== undefined
          ? { ...(values.productData ?? {}) }
          : values.formData !== undefined
            ? { ...(values.formData ?? {}) }
            : {
                ...(current.productData ?? {}),
                ...(current.formData ?? {}),
              },

      /*
       * Legacy requirements are preserved but are NOT used
       * to drive the form anymore.
       */

      requirements:
        values.requirements !== undefined
          ? [...values.requirements]
          : [...(current.requirements ?? [])],

      /*
       * Workflow is now only workflow metadata.
       *
       * Do NOT put quantity/artwork/catalog fields here.
       */

      workflow:
        values.workflow !== undefined
          ? { ...(values.workflow ?? {}) }
          : { ...(current.workflow ?? {}) },

      pricing: {
        ...(current.pricing ?? {}),
        ...(values.pricing ?? {}),
      },

      addons: {
        ...(current.addons ?? {}),
        ...(values.addons ?? {}),

        items:
          values.addons?.items !== undefined
            ? [...values.addons.items]
            : [...(current.addons?.items ?? [])],
      },

      notes:
        values.notes !== undefined
          ? [...values.notes]
          : [...(current.notes ?? [])],

      artwork:
        values.artwork !== undefined
          ? values.artwork
          : (current.artwork ?? null),

      artworkReceived:
        values.artworkReceived !== undefined
          ? values.artworkReceived
          : (current.artworkReceived ?? Boolean(current.artwork?.received)),

      completed: values.completed ?? current.completed ?? false,
    };
  }

  mergeProduct(current = {}, incoming = {}) {
    return {
      ...(current ?? {}),
      ...(incoming ?? {}),

      id:
        incoming?.id ??
        incoming?.productId ??
        current?.id ??
        current?.productId ??
        incoming?.slug ??
        current?.slug ??
        incoming?.name ??
        current?.name ??
        null,

      name:
        incoming?.name ??
        incoming?.productName ??
        incoming?.title ??
        current?.name ??
        current?.productName ??
        current?.title ??
        incoming?.slug ??
        current?.slug ??
        null,

      slug: incoming?.slug ?? current?.slug ?? null,
    };
  }

  /*
   * CATALOG
   */

  getCatalogProduct(order = {}) {
    const product = this.getCurrentProduct(order);

    if (!product) {
      return null;
    }

    const productId = product.id ?? product.productId ?? product.slug;

    if (!productId) {
      return null;
    }

    return catalogService.getProduct(productId);
  }

  getCatalogSelection(order = {}) {
    const product = this.getCatalogProduct(order);

    const selection = this.getSelection(order);

    if (!product || !selection?.id) {
      return null;
    }

    return catalogService.getSelectionOption(product, selection.id);
  }

  /*
   * DYNAMIC FORM
   */

  isFormMode(order = {}) {
    return this.getCurrentItem(order)?.formMode === true;
  }

  setFormMode(order = {}, enabled = true) {
    return this.updateCurrentItem(order, { formMode: Boolean(enabled) });
  }

  getDynamicForm(order = {}) {
    const item = this.getCurrentItem(order);

    if (!item) {
      return null;
    }

    const product = this.getCatalogProduct(order);

    if (!product) {
      return null;
    }

    const selection = this.getCatalogSelection(order);

    /*
     * A selection can represent a category with nested concrete products.
     * The form must wait until the customer selects the concrete product.
     */
    const nestedProducts = Array.isArray(selection?.products)
      ? selection.products
      : [];

    const selectedProduct =
      item.selectedProduct ?? (nestedProducts.length === 0 ? null : null);

    if (nestedProducts.length > 0 && !selectedProduct) {
      return null;
    }

    const formProduct = selectedProduct
      ? {
          ...product,
          ...selectedProduct,
          parentProduct: product,
          selection,
        }
      : selection
        ? {
            ...product,
            selection,
          }
        : product;

    const fields = this.getFormFields(formProduct, selection, selectedProduct);

    const values = this.getEffectiveFormValues(
      order,
      formProduct,
      selection,
      selectedProduct,
    );

    return {
      id:
        item.formId ??
        `order-form-${selectedProduct?.id ?? selection?.id ?? product.id ?? product.slug}`,

      type: "FORM",

      mode: "CATALOG_DRIVEN",

      title:
        formProduct.form?.title ??
        selectedProduct?.form?.title ??
        selection?.form?.title ??
        product.form?.title ??
        `${formProduct.name ?? product.name ?? "Order"} Details`,

      description:
        formProduct.form?.description ??
        selectedProduct?.form?.description ??
        selection?.form?.description ??
        product.form?.description ??
        null,

      product: {
        id: product.id ?? product.productId ?? null,
        name: product.name ?? null,
        slug: product.slug ?? null,
      },

      category: selection
        ? {
            ...selection,
            id: selection.id ?? null,
            name: selection.name ?? selection.label ?? null,
            label: selection.label ?? null,
          }
        : null,

      selectedProduct: selectedProduct
        ? {
            ...selectedProduct,
            id: selectedProduct.id ?? selectedProduct.productId ?? null,
            name:
              selectedProduct.name ??
              selectedProduct.productName ??
              selectedProduct.title ??
              null,
            slug: selectedProduct.slug ?? null,
          }
        : null,

      variant: selection
        ? {
            ...selection,
            id: selection.id ?? null,
            name: selection.name ?? selection.label ?? null,
          }
        : null,

      fields: fields.map((field, index) =>
        this.normalizeField(field, index, values),
      ),

      values,

      submit: {
        action: "SUBMIT_ORDER_FORM",
        label:
          formProduct.form?.submit?.label ??
          selectedProduct?.form?.submit?.label ??
          product.form?.submit?.label ??
          "Continue",
      },
    };
  }

  /*
   * ============================================================
   * FORM FIELD DISCOVERY
   * ============================================================
   *
   * IMPORTANT:
   * There are NO application-level order fields here.
   *
   * Quantity, artwork, delivery, requirements, add-ons and every
   * product-specific field must come from the catalog. This makes
   * the form portable to any new catalog product without adding
   * product-specific code.
   */
  getFormFields(product = {}, selection = null, selectedProduct = null) {
    // Common order requirements are fixed by the business workflow.
    // Product-specific fields are still sourced exclusively from catalog data.
    const commonFields = COMMON_ORDER_FIELDS.map((field) => ({ ...field }));

    const sources = [
      selectedProduct?.form?.fields,
      selectedProduct?.formFields,
      selectedProduct?.fields,
      selectedProduct?.customFields,
      selectedProduct?.requirements,

      product?.form?.fields,
      product?.formFields,
      product?.fields,
      product?.customFields,
      product?.requirements,

      selection?.form?.fields,
      selection?.formFields,
      selection?.fields,
      selection?.requirements,
    ];

    let catalogFields = [];

    for (const source of sources) {
      if (!Array.isArray(source) || source.length === 0) {
        continue;
      }

      catalogFields = this.mergeFieldDefinitions(catalogFields, source);
    }

    /*
     * Some catalogs expose order fields under explicit containers.
     * Preserve them without requiring a fixed field name.
     */
    const containers = [
      selectedProduct?.orderForm,
      selectedProduct?.order,
      selectedProduct?.form,
      product?.orderForm,
      product?.order,
      product?.form,
      selection?.orderForm,
      selection?.order,
      selection?.form,
    ];

    for (const container of containers) {
      if (!container || typeof container !== "object") {
        continue;
      }

      for (const key of [
        "fields",
        "productFields",
        "orderFields",
        "requirements",
      ]) {
        if (Array.isArray(container[key])) {
          catalogFields = this.mergeFieldDefinitions(
            catalogFields,
            container[key],
          );
        }
      }
    }

    /*
     * Catalog add-ons are also dynamic. If the catalog exposes an add-on
     * section, keep its options as form metadata rather than hard-coding
     * application fields.
     */
    const addons =
      selectedProduct?.addons ?? product?.addons ?? selection?.addons ?? null;

    if (
      addons?.enabled &&
      Array.isArray(addons.options) &&
      addons.options.length
    ) {
      catalogFields = this.mergeFieldDefinitions(catalogFields, [
        {
          id: addons.id ?? "addons",
          name: addons.name ?? "addons",
          label: addons.label ?? "Add-ons",
          type: addons.selection === "multiple" ? "multiselect" : "select",
          required: addons.required === true,
          options: addons.options.map((addon) => ({
            value: addon.id,
            label: addon.name ?? addon.label ?? addon.id,
            description: addon.description ?? null,
          })),
        },
      ]);
    }

    // Merge common fields at the end so catalog-defined fields maintain their primary ordering
    catalogFields = this.mergeFieldDefinitions(catalogFields, commonFields);

    /*
     * De-duplicate by field id while preserving catalog order.
     */
    const unique = [];
    const seen = new Set();

    for (const field of catalogFields) {
      if (!field?.id || seen.has(field.id)) {
        continue;
      }

      seen.add(field.id);
      unique.push(field);
    }

    /*
     * requiredFields is still catalog data. It is used only to complete
     * the field definition when a catalog uses a separate requirement
     * manifest instead of putting required=true on every field.
     */
    const requiredFieldIds = new Set(
      [
        selectedProduct?.orderRequirements?.requiredFields,
        product?.orderRequirements?.requiredFields,
        selection?.orderRequirements?.requiredFields,
      ]
        .flatMap((value) => (Array.isArray(value) ? value : []))
        .map((value) => String(value)),
    );

    const commonById = new Map(
      COMMON_ORDER_FIELDS.map((field) => [field.id, field]),
    );

    return unique.map((field) => {
      const common = commonById.get(String(field.id));
      return {
        ...field,
        // Common requirements are mandatory for every order. If the catalog
        // supplies a richer definition (for example artwork=file), keep that
        // definition while preserving the common business rule.
        required:
          common?.required === true
            ? true
            : field.required === true || requiredFieldIds.has(String(field.id)),
        mapsTo: common?.mapsTo ?? field.mapsTo ?? null,
        conditionalRequired:
          common?.conditionalRequired === true ||
          field.conditionalRequired === true,
      };
    });
  }

  getEffectiveFormValues(
    order = {},
    product = {},
    selection = null,
    selectedProduct = null,
  ) {
    const values = { ...this.getFormData(order) };

    // A catalog selection such as "500 Cards" may already establish quantity.
    // Treat that selection as the collected common quantity rather than asking twice.
    if (
      values.quantity == null &&
      selection?.quantity &&
      Number(selection.quantity) > 0
    ) {
      values.quantity = Number(selection.quantity);
    }

    return values;
  }

  /*
   * ============================================================
   * FORM VALIDATION
   * ============================================================
   */

  validateForm(form = {}, values = {}) {
    const errors = {};

    for (const field of form.fields ?? []) {
      if (field.ui?.hidden || !this.isFieldVisible(field, values)) {
        continue;
      }

      const value = values[field.id];
      const empty = value === undefined || value === null || value === "";

      const condition = field.conditional ?? field.condition ?? null;
      const conditionActive = condition
        ? this.isFieldVisible(field, values)
        : false;
      const required =
        field.required ||
        (field.conditionalRequired === true && conditionActive);

      if (required && empty) {
        errors[field.id] = `${field.label} is required.`;
        continue;
      }

      if (empty) {
        continue;
      }

      // Number
      if (field.type === "number") {
        const number = Number(value);
        if (Number.isNaN(number)) {
          errors[field.id] = `${field.label} must be a number.`;
          continue;
        }

        if (
          field.validation?.min != null &&
          number < Number(field.validation.min)
        ) {
          errors[field.id] =
            `${field.label} must be at least ${field.validation.min}.`;
        }

        if (
          field.validation?.max != null &&
          number > Number(field.validation.max)
        ) {
          errors[field.id] =
            `${field.label} must be at most ${field.validation.max}.`;
        }
      }

      // Date
      if (["date", "datetime-local"].includes(field.type)) {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
          errors[field.id] = `${field.label} must be a valid date.`;
          continue;
        }
      }

      // String length
      if (field.validation?.minLength != null) {
        if (String(value).length < Number(field.validation.minLength)) {
          errors[field.id] = `${field.label} is too short.`;
        }
      }

      if (field.validation?.maxLength != null) {
        if (String(value).length > Number(field.validation.maxLength)) {
          errors[field.id] = `${field.label} is too long.`;
        }
      }

      // Pattern
      if (field.validation?.pattern) {
        try {
          const regex = new RegExp(field.validation.pattern);
          if (!regex.test(String(value))) {
            errors[field.id] = `${field.label} has an invalid value.`;
          }
        } catch {
          // Ignore invalid catalog regex
        }
      }

      // Select options
      if (
        Array.isArray(field.options) &&
        field.options.length &&
        ["select", "radio", "multiselect"].includes(field.type)
      ) {
        const allowed = new Set(field.options.map((option) => option.value));
        const selected =
          field.type === "multiselect"
            ? Array.isArray(value)
              ? value
              : [value]
            : [value];

        for (const selectedValue of selected) {
          if (!allowed.has(selectedValue)) {
            errors[field.id] = `${field.label} contains an invalid option.`;
            break;
          }
        }
      }
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors,
    };
  }

  isFieldVisible(field = {}, values = {}) {
    if (field.ui?.hidden || field.hidden === true) return false;

    const condition = field.conditional ?? field.condition ?? null;

    if (!condition) return true;

    if (typeof condition === "function") {
      return Boolean(condition(values));
    }

    if (typeof condition !== "object") return true;

    const fieldId = condition.field ?? condition.when ?? condition.id;

    if (!fieldId) return true;

    const actual = values[fieldId];

    if (condition.equals !== undefined) return actual === condition.equals;

    if (condition.notEquals !== undefined)
      return actual !== condition.notEquals;

    if (Array.isArray(condition.in)) return condition.in.includes(actual);
    if (Array.isArray(condition.oneOf)) return condition.oneOf.includes(actual);

    return true;
  }

  mergeFieldDefinitions(base = [], additional = []) {
    const result = [...base];

    for (const field of additional) {
      if (!field?.id) {
        continue;
      }

      const index = result.findIndex((existing) => existing.id === field.id);

      if (index === -1) {
        result.push(field);
      } else {
        result[index] = {
          ...result[index],
          ...field,
        };
      }
    }

    return result;
  }

  /*
   * FIELD NORMALIZATION
   */

  normalizeField(field = {}, index = 0, values = {}) {
    const id = field.id ?? field.fieldId ?? field.key ?? `field_${index + 1}`;

    const rawType = String(
      field.type ?? field.inputType ?? field.kind ?? "text",
    ).toLowerCase();

    const typeMap = {
      string: "text",
      text: "text",

      number: "number",
      numeric: "number",
      integer: "number",

      select: "select",
      dropdown: "select",

      radio: "radio",

      checkbox: "checkbox",
      boolean: "checkbox",

      confirmation: "confirmation",

      textarea: "textarea",

      date: "date",

      datetime: "datetime-local",

      file: "file",
      image: "file",

      multiselect: "multiselect",
    };

    const type = typeMap[rawType] ?? "text";

    const rawOptions = field.options ?? field.choices ?? field.values ?? [];

    const options = Array.isArray(rawOptions)
      ? rawOptions.map((option) => this.normalizeOption(option))
      : [];

    return {
      id,

      name: field.name ?? field.label ?? id,

      label: field.label ?? field.name ?? id,

      question: field.question ?? field.prompt ?? null,

      type,

      required: field.required === true || field.validation?.required === true,

      value: values[id] ?? field.value ?? field.defaultValue ?? null,

      placeholder: field.placeholder ?? null,

      description: field.description ?? field.helpText ?? null,

      options,

      mapsTo: field.mapsTo ?? null,

      upload: field.upload === true,

      accept: field.accept ?? field.acceptedFormats ?? null,

      conditional: field.conditional ?? null,

      conditionalRequired: field.conditionalRequired === true,

      validation: {
        min: field.min ?? field.minValue ?? null,

        max: field.max ?? field.maxValue ?? null,

        minLength: field.minLength ?? null,

        maxLength: field.maxLength ?? null,

        pattern: field.pattern ?? null,
      },

      ui: {
        order: field.order ?? index,

        width: field.width ?? "full",

        hidden: field.hidden === true,
      },

      metadata: {
        source: "CATALOG",

        catalogFieldId: id,
      },
    };
  }

  normalizeOption(option) {
    if (typeof option === "string" || typeof option === "number") {
      return {
        value: option,
        label: String(option),
      };
    }

    return {
      value: option?.value ?? option?.id ?? option?.key ?? null,

      label:
        option?.label ??
        option?.name ??
        option?.title ??
        String(option?.value ?? option?.id ?? ""),

      description: option?.description ?? null,
      aliases: Array.isArray(option?.aliases) ? option.aliases : [],
    };
  }

  /*
   * ARTWORK ATTACHMENTS
   */

  applyArtworkAttachments(order = {}, attachments = []) {
    const item = this.getCurrentItem(order);
    if (!item || !Array.isArray(attachments) || attachments.length === 0) {
      return order;
    }

    const files = attachments
      .filter(
        (attachment) =>
          attachment?.mediaId || attachment?.id || attachment?.url,
      )
      .map((attachment) => ({
        mediaId: attachment.mediaId ?? attachment.id ?? null,
        type: attachment.type ?? attachment.mediaType ?? null,
        mimeType: attachment.mimeType ?? null,
        filename: attachment.filename ?? null,
        url: attachment.url ?? null,
      }));

    if (!files.length) return order;

    const currentArtwork = this.getWorkflowField(order, "artwork");

    return this.updateWorkflow(order, {
      artwork: {
        status: "UPLOADED",
        files: [...(currentArtwork?.files ?? []), ...files],
      },
    });
  }

  /*
   * FORM DATA
   */

  getFormData(order = {}) {
    return this.getCurrentItem(order)?.formData ?? {};
  }

  getFormValue(order = {}, fieldId) {
    return this.getFormData(order)?.[fieldId];
  }

  setFormValue(order = {}, fieldId, value) {
    if (!fieldId) {
      return order;
    }

    const current = this.getFormData(order);

    return this.updateCurrentItem(order, {
      formData: {
        ...current,
        [fieldId]: value,
      },
    });
  }

  /*
   * ============================================================
   * CATALOG FIELD MAPPING
   * ============================================================
   *
   * Field identity and requiredness come from the catalog. mapsTo is
   * optional catalog metadata that lets an order field update the
   * corresponding compatibility state without hard-coding field IDs.
   */
  applyCatalogFieldMappings(order = {}, form = {}, values = {}) {
    let updated = order;

    for (const field of form.fields ?? []) {
      if (!field?.id || !field.mapsTo) {
        continue;
      }

      const value = values[field.id];

      if (value === undefined) {
        continue;
      }

      const path = String(field.mapsTo).split(".").filter(Boolean);

      if (path[0] === "delivery" && path[1]) {
        updated = this.updateDelivery(updated, {
          [path[1]]: value,
        });
        continue;
      }

      if (path[0] === "workflow" && path[1]) {
        updated = this.updateWorkflow(updated, {
          [path[1]]: value,
        });
        continue;
      }

      if (path[0] === "customer" && path[1]) {
        updated = this.updateCustomer(updated, {
          [path[1]]: value,
        });
        continue;
      }

      if (path[0] === "addons") {
        const item = this.getCurrentItem(updated);
        const currentAddons = item?.addons ?? {};

        updated = this.updateCurrentItem(updated, {
          addons: {
            ...currentAddons,
            items: Array.isArray(value) ? [...value] : [value],
            completed: true,
          },
        });
      }
    }

    return updated;
  }

  /*
   * SUBMIT FORM
   */

  submitForm(order = {}, values = {}) {
    if (!this.isFormMode(order)) {
      return {
        success: false,
        order,
        errors: { _form: "Order form is not active." },
        form: null,
      };
    }

    const form = this.getDynamicForm(order);

    if (!form) {
      return {
        success: false,
        order,
        errors: {
          _form: "Order form is not available for the selected catalog item.",
        },
        form: null,
      };
    }

    const rawValues =
      values && typeof values === "object" && !Array.isArray(values)
        ? values
        : {};

    /*
     * Accept both the canonical flat payload and the compatibility shape:
     *
     *   { quantity, material, ... }
     *
     * or
     *
     *   { formId, productId, selectionId, values: { ... } }
     */
    const submittedValues =
      rawValues.values &&
      typeof rawValues.values === "object" &&
      !Array.isArray(rawValues.values)
        ? rawValues.values
        : rawValues.form &&
            typeof rawValues.form === "object" &&
            !Array.isArray(rawValues.form)
          ? rawValues.form.values &&
            typeof rawValues.form.values === "object" &&
            !Array.isArray(rawValues.form.values)
            ? rawValues.form.values
            : rawValues.form
          : rawValues;

    const currentItem = this.getCurrentItem(order);
    const allowedIds = new Set((form.fields ?? []).map((field) => field.id));
    const sanitizedValues = Object.fromEntries(
      Object.entries(submittedValues).filter(([key]) => allowedIds.has(key)),
    );

    const existingValues = this.getEffectiveFormValues(
      order,
      this.getCatalogProduct(order) ?? {},
      this.getCatalogSelection(order),
      currentItem?.selectedProduct ?? null,
    );

    const mergedValues = { ...existingValues, ...sanitizedValues };
    const validation = this.validateForm(form, mergedValues);

    if (!validation.valid) {
      return {
        success: false,
        order,
        errors: validation.errors,
        form: { ...form, errors: validation.errors },
      };
    }

    let updated = this.updateCurrentItem(order, {
      formData: {
        ...(currentItem?.formData ?? {}),
        ...mergedValues,
      },

      // Compatibility for ReviewBuilder implementations that still
      // read item.fields / item.variant.
      fields: {
        ...(currentItem?.fields ?? {}),
        ...mergedValues,
      },

      variant: currentItem?.selection ?? null,

      productData: {
        ...(currentItem?.productData ?? {}),
        ...mergedValues,
      },
      completed: true,
    });

    /*
     * Apply catalog-declared mapsTo metadata. This keeps delivery,
     * workflow, customer and add-on mirrors synchronized without
     * making any field name mandatory in application code.
     */
    updated = this.applyCatalogFieldMappings(updated, form, mergedValues);

    // Compatibility mirrors only; formData remains canonical.
    if (mergedValues.quantity !== undefined) {
      updated = this.updateWorkflow(updated, {
        quantity: mergedValues.quantity,
      });
    }

    if (mergedValues.artwork !== undefined) {
      updated = this.updateWorkflow(updated, {
        artwork: mergedValues.artwork,
      });
    }

    /*
     * Backward-compatible aliases for older catalog files. These are not
     * used to define the form; they only keep legacy persistence readers
     * working when a catalog has not supplied mapsTo metadata yet.
     */
    const deliveryPatch = {};

    if (mergedValues.deliveryMethod !== undefined)
      deliveryPatch.method = mergedValues.deliveryMethod;

    if (mergedValues.delivery !== undefined)
      deliveryPatch.method = mergedValues.delivery;

    if (mergedValues.address !== undefined)
      deliveryPatch.address = mergedValues.address;

    if (mergedValues.deliveryAddress !== undefined)
      deliveryPatch.address = mergedValues.deliveryAddress;

    if (mergedValues.requiredDate !== undefined)
      deliveryPatch.requiredDate = mergedValues.requiredDate;

    if (Object.keys(deliveryPatch).length) {
      updated = this.updateDelivery(updated, deliveryPatch);
    }

    return {
      success: true,
      order: updated,
      errors: {},
      form: this.getDynamicForm(updated),
    };
  }

  /*
   * LEGACY PRODUCT DATA
   */

  getProductData(order = {}) {
    return (
      this.getCurrentItem(order)?.formData ??
      this.getCurrentItem(order)?.productData ??
      {}
    );
  }

  updateProductData(order = {}, values = {}) {
    return this.updateCurrentItem(order, {
      formData: {
        ...this.getFormData(order),
        ...values,
      },

      productData: {
        ...(this.getCurrentItem(order)?.productData ?? {}),
        ...values,
      },
    });
  }

  updateProductField(order = {}, fieldId, value) {
    return this.setFormValue(order, fieldId, value);
  }

  getProductField(order = {}, fieldId) {
    return this.getFormValue(order, fieldId);
  }

  hasProductField(order = {}, fieldId) {
    const value = this.getProductField(order, fieldId);

    return value !== undefined && value !== null && value !== "";
  }

  /*
   * WORKFLOW
   */

  getWorkflow(order = {}) {
    return this.getCurrentItem(order)?.workflow ?? {};
  }

  updateWorkflow(order = {}, workflow = {}) {
    return this.updateCurrentItem(order, {
      workflow: {
        ...this.getWorkflow(order),
        ...workflow,
      },
    });
  }

  updateWorkflowField(order = {}, key, value) {
    return this.updateWorkflow(order, {
      [key]: value,
    });
  }

  getWorkflowField(order = {}, key) {
    return this.getWorkflow(order)?.[key];
  }

  /*
   * DELIVERY
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
   * CUSTOMER
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
   * PRICING
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
   * NAVIGATION
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

  removeCurrentItem(order = {}) {
    const items = [...this.getItems(order)];

    if (!items.length) {
      return order;
    }

    items.splice(order.currentItem ?? 0, 1);

    return {
      ...order,

      items,

      currentItem: items.length
        ? Math.min(order.currentItem ?? 0, items.length - 1)
        : 0,
    };
  }

  /*
   * COMPLETION
   */

  completeCurrentItem(order = {}) {
    return this.updateCurrentItem(order, {
      completed: true,
    });
  }

  areAllItemsCompleted(order = {}) {
    const items = this.getItems(order);

    return items.length > 0 && items.every((item) => item.completed === true);
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
   * REVIEW
   */

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
   * CONFIRMATION
   */

  confirm(order = {}) {
    return {
      ...order,

      confirmed: true,

      status: "CONFIRMED",
    };
  }

  unconfirm(order = {}) {
    return {
      ...order,

      confirmed: false,

      status: "COLLECTING",
    };
  }

  isConfirmed(order = {}) {
    return order.confirmed === true;
  }

  /*
   * TOTALS
   */

  getTotalItems(order = {}) {
    return this.getItems(order).length;
  }

  getTotalQuantity(order = {}) {
    return this.getItems(order).reduce((total, item) => {
      const quantity =
        item.formData?.quantity ??
        item.productData?.quantity ??
        item.workflow?.quantity ??
        0;

      return total + Number(quantity || 0);
    }, 0);
  }

  calculatePricing(order = {}) {
    const pricing = pricingService.calculate(order);

    return {
      ...order,

      totalItems: this.getTotalItems(order),

      totalQuantity: this.getTotalQuantity(order),

      pricing: {
        ...(order.pricing ?? {}),

        currency: pricing.currency ?? "AED",

        subtotal: pricing.subtotal,

        delivery: pricing.deliveryCharge,

        deliveryCharge: pricing.deliveryCharge,

        totalBeforeVAT: pricing.totalBeforeVAT ?? pricing.total,

        total: pricing.total,

        quotationRequired: pricing.quotationRequired,
      },
    };
  }

  calculateTotals(order = {}) {
    return this.calculatePricing(order);
  }

  /*
   * NOTES
   */

  addOrderNote(order = {}, note = "") {
    if (!note?.trim()) {
      return order;
    }

    return {
      ...order,

      notes: [...(order.notes ?? []), note.trim()],
    };
  }

  addItemNote(order = {}, note = "") {
    if (!note?.trim()) {
      return order;
    }

    const item = this.getCurrentItem(order);

    if (!item) {
      return order;
    }

    return this.updateCurrentItem(order, {
      notes: [...(item.notes ?? []), note.trim()],
    });
  }

  /*
   * ORDER NUMBER
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
   * DRAFT / PERSISTENCE MAPPING
   */

  createDraftOrder(order = {}) {
    return this.updateDraftOrder(
      {
        status: order.confirmed ? "CONFIRMED" : "COLLECTING",

        confirmed: order.confirmed ?? false,

        customer: structuredClone(order.customer ?? {}),

        delivery: structuredClone(order.delivery ?? {}),

        pricing: structuredClone(order.pricing ?? {}),

        items: [],

        totalItems: 0,

        totalQuantity: 0,

        notes: structuredClone(order.notes ?? []),
      },
      order,
    );
  }

  updateDraftOrder(draft = {}, order = {}) {
    const rawCustomer = order.customer ?? draft.customer ?? {};
    draft.customer = structuredClone(
      typeof rawCustomer.toObject === "function"
        ? rawCustomer.toObject()
        : rawCustomer,
    );

    draft.delivery = structuredClone(order.delivery ?? draft.delivery ?? {});

    draft.pricing = structuredClone(order.pricing ?? draft.pricing ?? {});

    draft.items = this.getItems(order).map((item) => ({
      product: structuredClone(item.product ?? {}),

      selection: structuredClone(item.selection ?? {}),

      selectedProduct: structuredClone(item.selectedProduct ?? null),

      formMode: item.formMode ?? false,

      orderStarted: item.orderStarted ?? false,

      reviewCompleted: item.reviewCompleted ?? false,

      confirmClicked: item.confirmClicked ?? false,

      customer: structuredClone(
        item.customer ?? draft.customer ?? order.customer ?? {},
      ),

      /*
       * Catalog form values.
       */
      formData: structuredClone(item.formData ?? item.productData ?? {}),

      /*
       * Backwards compatibility.
       */
      productData: structuredClone(item.productData ?? item.formData ?? {}),

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

  buildOrder(order = {}, existingOrder = null) {
    const draft = existingOrder
      ? this.clone(existingOrder)
      : this.createDraftOrder(order);

    return this.updateDraftOrder(draft, order);
  }

  /*
   * READINESS
   */

  isCurrentItemReady(order = {}) {
    const item = this.getCurrentItem(order);

    if (!item) {
      return false;
    }

    const product = this.getCatalogProduct(order);

    if (!product) {
      return false;
    }

    const form = this.getDynamicForm(order);

    /*
     * No form means the catalog has no additional
     * fields after variant selection.
     */
    if (!form) {
      return this.hasSelection(order);
    }

    return this.validateForm(form, this.getFormData(order)).valid;
  }

  /*
   * LEGACY REQUIREMENT HELPERS
   */

  getRequirements(order = {}) {
    return this.getCurrentItem(order)?.requirements ?? [];
  }

  getRequirement(order = {}, requirementId) {
    return this.getRequirements(order).find(
      (item) => item.id === requirementId,
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

  hasRequirement(order = {}, requirementId) {
    return Boolean(this.getRequirement(order, requirementId));
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
}
