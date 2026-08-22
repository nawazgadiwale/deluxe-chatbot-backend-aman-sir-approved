import ResponseBuilder from "../../../core/responses/Apiresponse.js";

const responseBuilder = new ResponseBuilder();

export default class OutOfScopeNode {
  async execute(state) {
    state.response = responseBuilder.outOfScope({
      title: "Deluxe Printing Assistant",

      message:
        "I'm here to help with Deluxe Printing products and services. I can assist with product recommendations, product comparisons, quotations, printing solutions, order support, delivery, artwork, and related questions.",

      suggestions: [
        "Recommend Products",
        "Compare Products",
        "Product Details",
        "Request Quotation",
      ],

      actions: [
        {
          id: "START_RECOMMENDATION",
          label: "Recommend Products",
          payload: {},
        },
        {
          id: "CONTACT_SALES",
          label: "Talk to Expert",
          payload: {},
        },
      ],
    });

    return state;
  }
}
