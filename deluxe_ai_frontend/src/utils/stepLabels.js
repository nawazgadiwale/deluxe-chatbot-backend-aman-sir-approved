// =====================================================
// STEP LABELS
// =====================================================
//
// Maps raw backend `currentStep` enum values to
// human-readable text for display in the UI.
//
// NEVER show raw step names like "COLLECT_CUSTOMER"
// or "SELECT_SELECTION" to the end user.
//
// =====================================================

export const STEP_LABELS = {
  // ---------------------------------------------------
  // Lead / Quotation
  // ---------------------------------------------------
  COLLECT_CUSTOMER: "Customer details",

  // ---------------------------------------------------
  // Sales
  // ---------------------------------------------------
  RECOMMEND_SELECTION: "Product recommendation",
  SELECT_SELECTION: "Product selection",
  COLLECT_PRODUCT_FIELD: "Product details",
  COLLECT_REQUIREMENT: "Requirements",
  COLLECT_QUANTITY: "Quantity",
  COLLECT_ARTWORK: "Artwork upload",
  SELECT_ADDONS: "Finishing options",
  SKIP_ADDONS: "Finishing options",

  // ---------------------------------------------------
  // Delivery
  // ---------------------------------------------------
  SELECT_DELIVERY_METHOD: "Delivery method",
  ASK_DELIVERY_ADDRESS: "Delivery address",
  ASK_DELIVERY_DATE: "Delivery date",

  // ---------------------------------------------------
  // Review / Confirm
  // ---------------------------------------------------
  REVIEW_ORDER: "Order review",
  CONFIRM_ORDER: "Order confirmation",
  CANCEL_ORDER: "Cancellation",

  // ---------------------------------------------------
  // Completed (should not show a continue card)
  // ---------------------------------------------------
  ORDER_COMPLETED: "Completed",
  LEAD_COMPLETED: "Completed",
};

/**
 * Returns the human-readable label for a given `currentStep`.
 *
 * @param {string|null} step - Raw backend step value
 * @returns {string} - Human-readable label, or "In progress" as a safe fallback
 */
export function getStepLabel(step) {
  if (!step) return "In progress";
  return STEP_LABELS[step] ?? "In progress";
}

/**
 * Workflow display names used in the unfinished-workflow card header.
 *
 * @param {string|null} workflow - "SALES" | "LEAD" | "NONE" | null
 * @returns {string}
 */
export function getWorkflowLabel(workflow) {
  switch (workflow) {
    case "SALES":
      return "Printing order";
    case "LEAD":
      return "Quote / expert request";
    default:
      return "Request";
  }
}

/**
 * Returns true when the given step is a terminal state.
 * Terminal steps should NOT show a "Continue" card.
 *
 * @param {string|null} step
 * @returns {boolean}
 */
export function isTerminalStep(step) {
  return step === "ORDER_COMPLETED" || step === "LEAD_COMPLETED";
}
