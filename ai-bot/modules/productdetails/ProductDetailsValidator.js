export default class ProductDetailsValidator {
  validate(result) {
    if (!result) {
      return {
        type: "product_details",
        summary: "Sorry, I couldn't find that product.",
        context: null,
        actions: [],
      };
    }

    const { context } = result;
    console.log(context);

    return {
      type: "product_details",

      summary: context.product.shortDescription ?? "",

      context,

      actions: [
        {
          id: "START_ORDER",
          label: "Start Order",
          payload: {
            productId: context.product.id,
            context,
          },
        },
        {
          id: "CONTACT_SALES",
          label: "Talk to Expert",
          payload: {
            productId: context.product.id,
          },
        },
      ],
    };
  }
}
