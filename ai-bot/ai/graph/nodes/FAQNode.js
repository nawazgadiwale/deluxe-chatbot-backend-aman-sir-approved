import SupportAgent from "../../agents/SupportAgent.js";
import FAQAgent from "../../agents/FAQAgent.js";

const supportAgent = new SupportAgent();
const faqAgent = new FAQAgent();

export default class FAQNode {
  async execute(state) {
    console.log("======================================");
    console.log("FAQ NODE EXECUTING");
    console.log("======================================");

    const execution = state.executionPlan?.[state.currentExecutionIndex ?? 0];

    console.dir(execution, {
      depth: null,
    });

    if (!execution) {
      throw new Error("FAQNode: current execution plan item not found.");
    }

    const transientBefore = {
      workflow: state.transientExecution?.persistentWorkflow ?? state.workflow,
      currentStep: state.transientExecution?.persistentStep ?? state.currentStep,
      selectedProduct:
        (state.transientExecution?.persistentSelectedProduct ?? state.selectedProduct)?.name ?? null,
      hasOrder: !!(state.transientExecution?.persistentOrder ?? state.order),
      activeForm:
        (state.transientExecution?.persistentStep ?? state.currentStep) === "ORDER_FORM",
    };

    console.log("========== TRANSIENT CAPABILITY ==========");
    console.log("Capability:", execution.capability);
    console.log("Persistent State Before:", transientBefore);

    let result;

    switch (execution.capability) {
      case "faq": {
        console.log("FAQNode → FAQAgent");

        result = await faqAgent.execute(state);

        console.log("FAQNode ← FAQAgent");

        break;
      }

      case "support": {
        console.log("FAQNode → SupportAgent");

        result = await supportAgent.execute(state);

        console.log("FAQNode ← SupportAgent");

        break;
      }

      default:
        throw new Error(
          `FAQNode: unsupported capability "${execution.capability}"`,
        );
    }

    if (result && result.transientExecution?.active) {
      result.workflow = result.transientExecution.persistentWorkflow;
      result.currentStep = result.transientExecution.persistentStep;
      result.order = result.transientExecution.persistentOrder;
      result.selectedProduct = result.transientExecution.persistentSelectedProduct;
      result.liveRequirement = result.transientExecution.persistentLiveRequirement;
      result.productSales = result.transientExecution.persistentProductSales;
      result.awaitingDecision = result.transientExecution.persistentAwaitingDecision;
    }

    console.log("Persistent State After:", {
      workflow: result?.workflow ?? null,
      currentStep: result?.currentStep ?? null,
      selectedProduct: result?.selectedProduct?.name ?? null,
      hasOrder: !!result?.order,
      activeForm: result?.currentStep === "ORDER_FORM",
    });

    return result;
  }
}
