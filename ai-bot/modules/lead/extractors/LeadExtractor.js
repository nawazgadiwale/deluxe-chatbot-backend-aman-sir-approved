import LeadConstants from "../helpers/LeadConstants.js";

export default class LeadExtractor {
  extract(state = {}) {
    console.log("========== LEAD EXTRACTOR ==========");

    /*
     * =====================================================
     * ACTION PAYLOAD
     * =====================================================
     */

    const payload = state.action?.payload ?? {};

    /*
     * Supports:
     *
     * payload: {
     *   fields: {...}
     * }
     *
     * AND:
     *
     * payload: {
     *   name: "...",
     *   phoneNumber: "..."
     * }
     */

    const fields = payload.fields ?? payload;

    console.log("Lead Payload:");
    console.dir(payload, { depth: null });

    console.log("Lead Fields:");
    console.dir(fields, { depth: null });

    /*
     * =====================================================
     * LEAD CONTEXT
     * =====================================================
     */

    const leadContext = state.leadContext ?? {};

    /*
     * =====================================================
     * REQUIREMENT / ORDER SOURCES
     * =====================================================
     *
     * IMPORTANT:
     *
     * Do NOT use:
     *
     * state.orderContext ??
     * state.order ??
     * state.liveRequirement ??
     * state.productSales
     *
     * because the first object may exist but contain
     * no items.
     *
     * Search all possible sources for the actual order.
     */

    const requirementSources = [
      state.orderContext,
      state.order,
      state.liveRequirement,
      state.productSales,
      state.salesOrder,
      state.requirement,
    ].filter(
      (source) =>
        source && typeof source === "object" && !Array.isArray(source),
    );

    /*
     * =====================================================
     * ORDER
     * =====================================================
     *
     * Prefer the source which actually contains items.
     */

    const requirementWithItems = requirementSources.find(
      (source) => Array.isArray(source.items) && source.items.length > 0,
    );

    const requirement = requirementWithItems ?? requirementSources[0] ?? {};

    /*
     * =====================================================
     * CUSTOMER
     * =====================================================
     */

    const existingCustomer = requirement.customer ?? state.customer ?? {};

    const customer = {
      name: fields.name ?? existingCustomer.name ?? "",

      phone:
        fields.phoneNumber ??
        fields.phone ??
        existingCustomer.phone ??
        existingCustomer.phoneNumber ??
        "",

      email:
        fields.emailId ??
        fields.email ??
        existingCustomer.email ??
        existingCustomer.emailId ??
        "",

      company:
        fields.companyName ??
        fields.company ??
        existingCustomer.company ??
        existingCustomer.companyName ??
        "",
    };

    /*
     * =====================================================
     * ORDER ITEMS
     * =====================================================
     *
     * IMPORTANT:
     *
     * Find the actual items from whichever state object
     * contains them.
     */

    const items = requirementWithItems?.items ?? [];

    console.log("========== ORDER ITEMS ==========");

    console.dir(items, {
      depth: null,
    });

    /*
     * =====================================================
     * ORDER PRODUCTS
     * =====================================================
     *
     * ORDER PRODUCTS ARE THE SOURCE OF TRUTH.
     *
     * Supports:
     *
     * product.id = number
     * product.id = string
     * product.productId = number
     * product.productId = string
     *
     * Product name is preserved independently.
     */

    const orderProducts = items
      .filter((item) => item?.product)
      .map((item) => {
        const product = item.product;

        const productName =
          product.name ??
          product.productName ??
          product.title ??
          product.slug ??
          "";

        const productId =
          product.id ?? product.productId ?? product.slug ?? null;

        return {
          productName:
            typeof productName === "string"
              ? productName.trim()
              : String(productName ?? "").trim(),

          productId,
        };
      })
      .filter((product) => product.productName.length > 0);

    /*
     * =====================================================
     * REMOVE DUPLICATE PRODUCTS
     * =====================================================
     *
     * Prevent the same product from being sent twice
     * if the order contains duplicate item references.
     */

    const uniqueOrderProducts = [];

    const seenProducts = new Set();

    for (const product of orderProducts) {
      const key =
        product.productId !== null && product.productId !== undefined
          ? `id:${String(product.productId)}`
          : `name:${product.productName.toLowerCase()}`;

      if (seenProducts.has(key)) {
        continue;
      }

      seenProducts.add(key);

      uniqueOrderProducts.push(product);
    }

    /*
     * =====================================================
     * LEAD CONTEXT PRODUCTS
     * =====================================================
     *
     * Used for:
     *
     * QUOTATION
     * EXPERT
     * CONTACT_SALES
     *
     * when another workflow already supplied
     * product information.
     */

    const contextProducts = Array.isArray(leadContext.products)
      ? leadContext.products
          .map((product) => {
            const productName =
              product?.productName ??
              product?.name ??
              product?.title ??
              product?.slug ??
              "";

            const productId =
              product?.productId ?? product?.id ?? product?.slug ?? null;

            return {
              productName:
                typeof productName === "string"
                  ? productName.trim()
                  : String(productName ?? "").trim(),

              productId,
            };
          })
          .filter((product) => product.productName.length > 0)
      : [];

    /*
     * =====================================================
     * HAS ORDER
     * =====================================================
     */

    const hasOrder = items.length > 0;

    /*
     * =====================================================
     * REQUEST TYPE
     * =====================================================
     *
     * Priority:
     *
     * 1. leadContext.requestType
     * 2. state.requestType
     * 3. Existing order
     * 4. EXPERT
     */

    const requestType =
      leadContext.requestType ??
      state.requestType ??
      (hasOrder
        ? LeadConstants.REQUEST_TYPES.ORDER
        : LeadConstants.REQUEST_TYPES.EXPERT);

    /*
     * =====================================================
     * FINAL PRODUCTS
     * =====================================================
     *
     * ORDER:
     *     Actual order is ALWAYS authoritative.
     *
     * NON-ORDER:
     *     Lead context first.
     */

    const products =
      requestType === LeadConstants.REQUEST_TYPES.ORDER
        ? uniqueOrderProducts
        : contextProducts.length > 0
          ? contextProducts
          : uniqueOrderProducts;

    /*
     * =====================================================
     * REQUIRED ITEM
     * =====================================================
     *
     * ORDER:
     *
     * NEVER ask the customer for requiredItem.
     *
     * Automatically derive it from the actual order.
     *
     * Multiple products:
     *
     * "Business Cards, Roll-Up Banner"
     *
     * Single product:
     *
     * "Roll-Up Banner"
     *
     * NON-ORDER:
     *
     * 1. Submitted form
     * 2. Lead context
     * 3. Product
     */

    let requiredItem = "";

    if (requestType === LeadConstants.REQUEST_TYPES.ORDER) {
      requiredItem = products
        .map((product) => product.productName)
        .filter(Boolean)
        .join(", ");
    } else {
      const submittedRequiredItem =
        typeof fields.requiredItem === "string"
          ? fields.requiredItem.trim()
          : "";

      const contextRequiredItem =
        typeof leadContext.requiredItem === "string"
          ? leadContext.requiredItem.trim()
          : "";

      const productRequiredItem = products[0]?.productName?.trim() ?? "";

      requiredItem =
        submittedRequiredItem || contextRequiredItem || productRequiredItem;
    }

    /*
     * =====================================================
     * REQUEST DETAILS
     * =====================================================
     */

    const requestDetails =
      fields.requestDetails ??
      fields.details ??
      leadContext.requestDetails ??
      state.requestDetails ??
      "";

    /*
     * =====================================================
     * RESULT
     * =====================================================
     */

    const result = {
      /*
       * Customer
       */

      name:
        typeof customer.name === "string"
          ? customer.name.trim()
          : String(customer.name ?? "").trim(),

      phoneNumber:
        typeof customer.phone === "string"
          ? customer.phone.trim()
          : String(customer.phone ?? "").trim(),

      emailId:
        typeof customer.email === "string"
          ? customer.email.trim()
          : String(customer.email ?? "").trim(),

      companyName:
        typeof customer.company === "string"
          ? customer.company.trim()
          : String(customer.company ?? "").trim(),

      /*
       * Lead Intent
       */

      requestType,

      required_item: requiredItem,

      requestDetails: String(requestDetails).trim(),

      /*
       * Products
       */

      products,

      /*
       * CRM
       */

      division: leadContext.division ?? state.division ?? "N/A",

      assignToSalesPerson: leadContext.assignToSalesPerson ?? "Admin",

      initialRemartks: leadContext.initialRemartks ?? "",
    };

    /*
     * =====================================================
     * DEBUG
     * =====================================================
     */

    console.log("========== LEAD CONTEXT ==========");

    console.dir(leadContext, {
      depth: null,
    });

    console.log("========== REQUIREMENT SOURCES ==========");

    console.dir(
      requirementSources.map((source) => ({
        hasItems: Array.isArray(source.items),
        itemCount: Array.isArray(source.items) ? source.items.length : 0,
      })),
      {
        depth: null,
      },
    );

    console.log("========== ORDER PRODUCTS ==========");

    console.dir(uniqueOrderProducts, {
      depth: null,
    });

    console.log("========== FINAL PRODUCTS ==========");

    console.dir(products, {
      depth: null,
    });

    console.log("========== REQUIRED ITEM ==========");

    console.log(requiredItem);

    console.log("========== FINAL LEAD ==========");

    console.dir(result, {
      depth: null,
    });

    return result;
  }
}
