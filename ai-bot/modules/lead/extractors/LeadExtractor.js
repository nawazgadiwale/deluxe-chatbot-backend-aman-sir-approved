import LeadConstants from "../helpers/LeadConstants.js";

export default class LeadExtractor {
  extract(state = {}) {
    console.log("========== WHATSAPP LEAD EXTRACTOR ==========");

    const whatsapp = state.whatsapp ?? {};
    const customer = state.customer ?? {};
    const leadContext = state.leadContext ?? {};

    /*
     * ==========================================================
     * ORDER
     * ==========================================================
     */

    const requirementSources = [
      state.order,
      state.orderContext,
      state.liveRequirement,
      state.productSales,
      state.salesOrder,
      state.requirement,
    ].filter(
      (source) =>
        source &&
        typeof source === "object" &&
        !Array.isArray(source),
    );

    const requirementWithItems =
      requirementSources.find(
        (source) =>
          Array.isArray(source.items) &&
          source.items.length > 0,
      );

    const requirement =
      requirementWithItems ??
      requirementSources[0] ??
      {};

    /*
     * ==========================================================
     * WHATSAPP IDENTITY
     * ==========================================================
     */

    const whatsappPhone =
      whatsapp.phoneNumber ??
      whatsapp.from ??
      state.phoneNumber ??
      "";

    /*
     * ==========================================================
     * REQUEST TYPE
     * ==========================================================
     */

    const hasOrder =
      Array.isArray(requirementWithItems?.items) &&
      requirementWithItems.items.length > 0;

    const requestType =
      leadContext.requestType ??
      state.requestType ??
      (
        hasOrder
          ? LeadConstants.REQUEST_TYPES.ORDER
          : LeadConstants.REQUEST_TYPES.EXPERT
      );

    /*
     * ==========================================================
     * ORDER PRODUCTS
     * ==========================================================
     */

    const items = Array.isArray(
      requirementWithItems?.items,
    )
      ? requirementWithItems.items
      : [];

    const orderProducts = items
      .filter((item) => item?.product)
      .map((item) => {
        const product = item.product;

        const productName =
          product.name ??
          product.productName ??
          product.title ??
          product.slug ??
          item.selectedProduct?.name ??
          item.selectedProduct?.productName ??
          item.selectedProduct?.title ??
          item.selectedProduct?.slug ??
          "";

        const productId =
          product.id ??
          product.productId ??
          product.slug ??
          item.selectedProduct?.id ??
          item.selectedProduct?.productId ??
          item.selectedProduct?.slug ??
          null;

        return {
          productName: String(productName).trim(),
          productId,
        };
      })
      .filter(
        (product) =>
          product.productName.length > 0,
      );

    /*
     * ==========================================================
     * REMOVE DUPLICATES
     * ==========================================================
     */

    const uniqueOrderProducts = [];
    const seenProducts = new Set();

    for (const product of orderProducts) {
      const key =
        product.productId !== null &&
          product.productId !== undefined
          ? `id:${String(product.productId)}`
          : `name:${product.productName.toLowerCase()}`;

      if (seenProducts.has(key)) {
        continue;
      }

      seenProducts.add(key);
      uniqueOrderProducts.push(product);
    }

    /*
     * ==========================================================
     * CONTEXT PRODUCTS
     * ==========================================================
     */

    const contextProducts =
      Array.isArray(leadContext.products)
        ? leadContext.products
          .map((product) => ({
            productName: String(
              product?.productName ??
              product?.name ??
              product?.title ??
              product?.slug ??
              "",
            ).trim(),

            productId:
              product?.productId ??
              product?.id ??
              product?.slug ??
              null,
          }))
          .filter(
            (product) =>
              product.productName.length > 0,
          )
        : [];

    /*
     * ==========================================================
     * PRODUCTS
     * ==========================================================
     */

    const products =
      requestType ===
        LeadConstants.REQUEST_TYPES.ORDER
        ? uniqueOrderProducts
        : contextProducts.length > 0
          ? contextProducts
          : uniqueOrderProducts;

    /*
     * ==========================================================
     * REQUIRED ITEM
     * ==========================================================
     */

    const requiredItem =
      requestType ===
        LeadConstants.REQUEST_TYPES.ORDER
        ? products
          .map(
            (product) =>
              product.productName,
          )
          .filter(Boolean)
          .join(", ")
        : String(
          leadContext.requiredItem ??
          products[0]?.productName ??
          "",
        ).trim();

    /*
     * ==========================================================
     * RESULT
     * ==========================================================
     */

    const result = {
      name: String(
        customer.name ?? "",
      ).trim(),

      phoneNumber: String(
        whatsappPhone,
      ).trim(),

      emailId: String(
        customer.email ?? "",
      ).trim(),

      companyName: String(
        customer.company ?? "",
      ).trim(),

      requestType,

      required_item: requiredItem,

      requestDetails: String(
        state.requestDetails ??
        leadContext.requestDetails ??
        "",
      ).trim(),

      products,

      division:
        leadContext.division ??
        state.division ??
        "N/A",

      assignToSalesPerson:
        leadContext.assignToSalesPerson ??
        "Admin",

      initialRemartks:
        leadContext.initialRemartks ??
        leadContext.initialRemarks ??
        "",

      order: requirement,
      orderContext: requirement,
    };

    console.log("========== EXTRACTED LEAD ==========");
    console.dir(result, { depth: null });

    return result;
  }
}