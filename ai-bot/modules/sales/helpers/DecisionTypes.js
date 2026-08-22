const DecisionTypes = Object.freeze({
  START_ORDER: "START_ORDER",

  /*
   * =====================================================
   * Product Selection
   * =====================================================
   */

  SELECT_PRODUCT: "SELECT_PRODUCT",

  RECOMMEND_SELECTION: "RECOMMEND_SELECTION",

  SHOW_SELECTIONS: "SHOW_SELECTIONS",

  SELECT_SELECTION: "SELECT_SELECTION",

  /*
   * =====================================================
   * Product Information
   * =====================================================
   */

  COLLECT_PRODUCT_FIELD: "COLLECT_PRODUCT_FIELD",

  COLLECT_REQUIREMENT: "COLLECT_REQUIREMENT",

  SELECT_ADDONS: "SELECT_ADDONS",

  SKIP_ADDONS: "SKIP_ADDONS",

  /*
   * =====================================================
   * Workflow
   * =====================================================
   */

  COLLECT_QUANTITY: "COLLECT_QUANTITY",

  COLLECT_ARTWORK: "COLLECT_ARTWORK",

  SELECT_DELIVERY_METHOD: "SELECT_DELIVERY_METHOD",

  ASK_DELIVERY_ADDRESS: "ASK_DELIVERY_ADDRESS",

  ASK_DELIVERY_DATE: "ASK_DELIVERY_DATE",

  /*
   * =====================================================
   * Edit Order
   * =====================================================
   */

  EDIT_ORDER: "EDIT_ORDER",
  /*
   * =====================================================
   * Review & Confirmation
   * =====================================================
   *
   * */

  REVIEW_ORDER: "REVIEW_ORDER",

  COMPLETE_ORDER: "COMPLETE_ORDER",

  CONFIRM_ORDER: "CONFIRM_ORDER",

  CANCEL_ORDER: "CANCEL_ORDER",

  COLLECT_CUSTOMER: "COLLECT_CUSTOMER",

  /*
   * =====================================================
   * Completion
   * =====================================================
   */

  ORDER_COMPLETED: "ORDER_COMPLETED",
});

export default DecisionTypes;
