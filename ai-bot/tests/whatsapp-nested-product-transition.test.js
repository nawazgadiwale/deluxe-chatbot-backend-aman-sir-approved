import test from "node:test";
import assert from "node:assert/strict";

import SalesBrain from "../modules/sales/SalesBrain.js";
import DecisionTypes from "../modules/sales/helpers/DecisionTypes.js";

test("SELECT_PRODUCT -> SELECT_SELECTION -> SELECT_NESTED_PRODUCT transitions to next required field without resetting", async () => {
  const salesBrain = new SalesBrain();

  // 1. SELECT_PRODUCT business-cards
  let state = {
    action: {
      id: "SELECT_PRODUCT",
      payload: { productId: "business-cards" },
    },
  };
  let res = await salesBrain.execute(state);
  assert.equal(res.currentStep, DecisionTypes.SELECT_SELECTION);
  assert.ok(
    res.response?.message?.includes("Please select the style/category for Business Cards:"),
  );

  // 2. SELECT_SELECTION budget-friendly
  state = {
    ...res,
    action: {
      id: "SELECT_SELECTION",
      payload: { productId: "business-cards", selectionId: "budget-friendly" },
    },
  };
  res = await salesBrain.execute(state);
  assert.equal(res.currentStep, "SELECT_NESTED_PRODUCT");
  assert.equal(res.selectionId, "budget-friendly");

  // 3. SELECT_NESTED_PRODUCT affordable (with button text label)
  state = {
    ...res,
    userMessage: "Affordable Business Cards",
    action: {
      id: "SELECT_NESTED_PRODUCT",
      payload: {
        productId: "business-cards",
        selectionId: "budget-friendly",
        nestedProductId: "affordable",
      },
    },
  };
  res = await salesBrain.execute(state);

  // 4. Must transition to next required catalog field (e.g. quantity / COLLECT_PRODUCT_FIELD)
  assert.equal(res.currentStep, DecisionTypes.COLLECT_PRODUCT_FIELD);
  assert.equal(res.response?.context?.field?.id, "quantity");

  // Response must NOT contain style/category prompt
  const message = res.response?.message || "";
  assert.ok(
    !message.includes("Please select the style/category for Business Cards:"),
    "Response must NOT ask for category again",
  );

  // Verify persisted state invariants
  assert.equal(res.productId, "business-cards");
  assert.equal(res.selectionId, "budget-friendly");
  assert.equal(res.selectedProductId, "affordable");

  const currentItem = res.liveRequirement?.items?.[res.liveRequirement?.currentItem ?? 0];
  assert.ok(currentItem, "Current item must exist");
  assert.equal(currentItem.productId, "business-cards");
  assert.equal(currentItem.product?.id, "affordable");
  assert.equal(currentItem.product?.parentProductId, "business-cards");
  assert.equal(currentItem.selectionId, "budget-friendly");
  assert.equal(currentItem.selection?.id, "budget-friendly");
  assert.equal(currentItem.selectedProductId, "affordable");
  assert.equal(currentItem.selectedProduct?.id, "affordable");
  assert.equal(currentItem.orderStarted, true);

  // Verify final persisted state no longer has null selection/selectedProduct or SELECT_NESTED_PRODUCT
  assert.notEqual(res.selectedProduct, null, "selectedProduct must not be null");
  assert.notEqual(res.selection, null, "selection must not be null");
  assert.notEqual(res.currentStep, "SELECT_NESTED_PRODUCT", "currentStep must not be SELECT_NESTED_PRODUCT");
  assert.notEqual(currentItem.selectedProduct, null, "currentItem.selectedProduct must not be null");
  assert.notEqual(currentItem.selection, null, "currentItem.selection must not be null");
});
