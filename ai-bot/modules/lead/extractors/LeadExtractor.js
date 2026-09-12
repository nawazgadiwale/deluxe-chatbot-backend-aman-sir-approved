import LeadConstants from "../helpers/LeadConstants.js";
export default class LeadExtractor {
  extract(state = {}) {
    console.log("========== WHATSAPP LEAD EXTRACTOR ==========");
    const whatsapp = state.whatsapp ?? {};
    let fields = {};

    /*
     * ============================================================
     * ACTION SUBMISSION
     * ============================================================
     * Handles WhatsApp and frontend lead submissions.
     */
    if (state.action?.id === LeadConstants.ACTIONS.SUBMIT_LEAD) {
      const payload = state.action?.payload ?? {};
      fields =
        payload.values &&
        typeof payload.values === "object" &&
        !Array.isArray(payload.values)
          ? payload.values
          : payload.fields &&
              typeof payload.fields === "object" &&
              !Array.isArray(payload.fields)
            ? payload.fields
            : payload.data &&
                typeof payload.data === "object" &&
                !Array.isArray(payload.data)
              ? payload.data
              : payload;
    }
    /* * ============================================================ * NORMALIZE FIELD ALIASES * ============================================================ * * Keep the extractor compatible with different frontend / * WhatsApp Flow field names. */ fields =
      fields && typeof fields === "object" ? fields : {};
    console.log("========== LEAD FIELDS ==========");
    console.dir(fields, { depth: null });
    /* * ============================================================ * LEAD CONTEXT * ============================================================ */ const leadContext =
      state.leadContext ?? {};
    /* * ============================================================ * ORDER SOURCES * ============================================================ * * IMPORTANT: * * The completed order is NOT reconstructed from the lead form. * * SalesBrain already puts the completed order into: * * orderContext * order * liveRequirement * productSales * * after SUBMIT_ORDER_FORM. * * Prefer the source containing actual items. */ const requirementSources =
      [
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
    const requirementWithItems = requirementSources.find(
      (source) => Array.isArray(source.items) && source.items.length > 0,
    );
    const requirement = requirementWithItems ?? requirementSources[0] ?? {};
    /* * ============================================================ * CUSTOMER * ============================================================ * * Existing customer data is preserved. * * WhatsApp identity is authoritative for phone because the * customer does not need to type their WhatsApp number again. */ const existingCustomer =
      requirement.customer ?? state.customer ?? {};
    /* * WhatsApp phone sources. * * Do NOT allow a lead form value to replace the WhatsApp * identity when a verified/channel phone is available. */ const whatsappPhone =
      whatsapp.phoneNumber ??
      whatsapp.from ??
      state.phoneNumber ??
      state.visitor?.phone ??
      "";
    const customer = {
      name:
        fields.name ??
        fields.fullName ??
        fields.full_name ??
        existingCustomer.name ??
        existingCustomer.fullName ??
        "",
      phone:
        whatsappPhone ||
        fields.phoneNumber ||
        fields.phone ||
        fields.mobile ||
        existingCustomer.phoneNumber ||
        existingCustomer.phone ||
        "",
      email:
        fields.emailId ??
        fields.email ??
        fields.emailAddress ??
        existingCustomer.emailId ??
        existingCustomer.email ??
        "",
      company:
        fields.companyName ??
        fields.company ??
        fields.company_name ??
        existingCustomer.companyName ??
        existingCustomer.company ??
        "",
    };
    /* * ============================================================ * ORDER ITEMS * ============================================================ * * Order products ONLY come from the completed Sales order. */ const items =
      Array.isArray(requirementWithItems?.items)
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
        return { productName: String(productName).trim(), productId };
      })
      .filter((product) => product.productName.length > 0);
    /* * ============================================================ * REMOVE DUPLICATES * ============================================================ */ const uniqueOrderProducts =
      [];
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
    /* * ============================================================ * CONTEXT PRODUCTS * ============================================================ * * Used for expert/general leads where there may be no completed * order. */ const contextProducts =
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
                product?.productId ?? product?.id ?? product?.slug ?? null,
            }))
            .filter((product) => product.productName.length > 0)
        : [];
    /* * ============================================================ * REQUEST TYPE * ============================================================ */ const hasOrder =
      items.length > 0;
    const requestType =
      leadContext.requestType ??
      state.requestType ??
      (hasOrder
        ? LeadConstants.REQUEST_TYPES.ORDER
        : LeadConstants.REQUEST_TYPES.EXPERT);
    /* * ============================================================ * PRODUCTS * ============================================================ * * ORDER: * completed Sales order products * * EXPERT: * lead context products first * otherwise completed order products */ const products =
      requestType === LeadConstants.REQUEST_TYPES.ORDER
        ? uniqueOrderProducts
        : contextProducts.length > 0
          ? contextProducts
          : uniqueOrderProducts;
    /* * ============================================================ * REQUIRED ITEM * ============================================================ */ let requiredItem =
      "";
    if (requestType === LeadConstants.REQUEST_TYPES.ORDER) {
      requiredItem = products
        .map((product) => product.productName)
        .filter(Boolean)
        .join(", ");
    } else {
      requiredItem = String(
        fields.requiredItem ??
          fields.requirement ??
          fields.product ??
          leadContext.requiredItem ??
          products[0]?.productName ??
          "",
      ).trim();
    }
    /* * ============================================================ * REQUEST DETAILS * ============================================================ */ const requestDetails =
      fields.requestDetails ??
      fields.details ??
      fields.message ??
      fields.notes ??
      leadContext.requestDetails ??
      state.requestDetails ??
      "";
    /* * ============================================================ * RESULT * ============================================================ * * This object remains compatible with the existing * LeadValidator / LeadBuilder / LeadService pipeline. */ const result =
      {
        name: String(customer.name ?? "").trim(),
        phoneNumber: String(customer.phone ?? "").trim(),
        emailId: String(customer.email ?? "").trim(),
        companyName: String(customer.company ?? "").trim(),
        requestType,
        required_item: requiredItem,
        requestDetails: String(requestDetails).trim(),
        products,
        division: leadContext.division ?? state.division ?? "N/A",
        assignToSalesPerson: leadContext.assignToSalesPerson ?? "Admin",
        initialRemartks:
          leadContext.initialRemartks ?? leadContext.initialRemarks ?? "",
        /* * Keep the completed order available to the downstream * LeadEngine without mixing it into customer fields. */ order:
          requirement,
        orderContext: requirement,
      };
    console.log("========== EXTRACTED LEAD ==========");
    console.dir(result, { depth: null });
    return result;
  }
}
