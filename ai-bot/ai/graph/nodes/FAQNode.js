import SupportAgent from "../../agents/SupportAgent.js";
import FAQAgent from "../../agents/FAQAgent.js";

const supportAgent = new SupportAgent();
const faqAgent = new FAQAgent();

export default class FAQNode {
  async execute(state) {
    const capability =
      state.executionPlan[
        state.currentExecutionIndex
      ]?.capability;

    if (capability === "support") {
      return supportAgent.execute(state);
    }

    return faqAgent.execute(state);
  }
}