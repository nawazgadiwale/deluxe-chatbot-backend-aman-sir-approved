import SupportAgent from "../../agents/SupportAgent.js";
import FAQAgent from "../../agents/FAQAgent.js";

const supportAgent = new SupportAgent();
const faqAgent = new FAQAgent();

export default class FAQNode {
  async execute(state = {}) {
    console.log("======================================");
    console.log("FAQ NODE EXECUTING");
    console.log("======================================");

    const execution =
      state.executionPlan?.[
      state.currentExecutionIndex ?? 0
      ];

    console.dir(execution, { depth: null });

    if (!execution) {
      throw new Error(
        "FAQNode: current execution plan item not found.",
      );
    }

    const transient =
      state.transientExecution?.active
        ? state.transientExecution
        : null;

    console.log("========== TRANSIENT CAPABILITY ==========");
    console.log("Capability:", execution.capability);

    console.log("Persistent State Before:", {
      workflow:
        transient?.persistentWorkflow ??
        state.workflow ??
        null,

      currentStep:
        transient?.persistentStep ??
        state.currentStep ??
        null,

      selectedProduct:
        transient?.persistentSelectedProduct?.name ??
        state.selectedProduct?.name ??
        null,

      hasOrder: Boolean(
        transient?.persistentOrder ??
        state.order,
      ),

      activeForm:
        (
          transient?.persistentStep ??
          state.currentStep
        ) === "ORDER_FORM",
    });

    let result;

    switch (execution.capability) {
      case "faq":
        console.log("FAQNode → FAQAgent");
        result = await faqAgent.execute(state);
        console.log("FAQNode ← FAQAgent");
        break;

      case "support":
        console.log("FAQNode → SupportAgent");
        result = await supportAgent.execute(state);
        console.log("FAQNode ← SupportAgent");
        break;

      default:
        throw new Error(
          `FAQNode: unsupported capability "${execution.capability}"`,
        );
    }

    /*
     * Restore the interrupted persistent workflow.
     *
     * FAQ/Support is transient. It must never permanently replace
     * the user's active sales/order state.
     */
    if (result && transient) {
      result.workflow =
        transient.persistentWorkflow ?? null;

      result.currentStep =
        transient.persistentStep ?? null;

      result.order =
        transient.persistentOrder ?? null;

      result.orderContext =
        transient.persistentOrderContext ??
        transient.persistentOrder ??
        null;

      result.selectedProduct =
        transient.persistentSelectedProduct ??
        null;

      result.selectedProductId =
        transient.persistentSelectedProductId ??
        result.selectedProduct?.id ??
        result.selectedProduct?.productId ??
        result.selectedProduct?.slug ??
        null;

      result.product =
        transient.persistentProduct ??
        result.selectedProduct ??
        null;

      result.productId =
        transient.persistentProductId ??
        result.selectedProductId ??
        null;

      result.selection =
        transient.persistentSelection ??
        null;

      result.selectionId =
        transient.persistentSelectionId ??
        result.selection?.id ??
        null;

      result.liveRequirement =
        transient.persistentLiveRequirement ??
        result.order ??
        null;

      result.productSales =
        transient.persistentProductSales ??
        result.order ??
        null;

      result.awaitingDecision =
        transient.persistentAwaitingDecision ??
        false;

      /*
       * The transient execution is finished.
       * Do not allow SaveSessionNode to restore it again.
       */
      result.transientExecution = null;
    }

    console.log("Persistent State After:", {
      workflow: result?.workflow ?? null,
      currentStep: result?.currentStep ?? null,
      selectedProduct:
        result?.selectedProduct?.name ?? null,
      hasOrder: Boolean(result?.order),
      activeForm:
        result?.currentStep === "ORDER_FORM",
    });

    return result;
  }
}