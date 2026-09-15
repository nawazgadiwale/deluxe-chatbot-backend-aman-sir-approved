
import DiscoveryService from "../../../modules/discovery/DiscoveryService.js";
import ResponseBuilder from "../../../core/responses/Apiresponse.js";

const discoveryService = new DiscoveryService();
const responseBuilder = new ResponseBuilder();

export default class DiscoveryNode {
  async execute(state) {
    console.log("========== DISCOVERY NODE ==========");
    console.log("Query:", state.userMessage ?? "");

    const result = await discoveryService.generate(state);

    state.discovery = {
      type: result.type,
      match: result.match ?? null,
      products: result.products ?? [],
      totalProducts: result.products?.length ?? 0,
      generatedAt: new Date(),
    };

    state.persistence.conversation = {
      ...state.persistence.conversation,
      dirty: true,
      updatedAt: new Date(),
    };

    state.response = responseBuilder.success({
      type: "discovery",
      data: {
        type: result.type,
        product: result.match ?? null,
      },
    });

    return state;
  }
}

