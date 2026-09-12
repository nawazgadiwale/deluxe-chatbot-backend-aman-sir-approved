import assert from "node:assert/strict";
import SalesCatalogService from "../modules/sales/services/SalesCatalogService.js";
import OrderManager from "../modules/sales/services/OrderManager.js";
import SalesExtractor from "../modules/sales/extractors/SalesExtractor.js";
import FieldResolver from "../modules/sales/services/FieldResolver.js";
import WhatsappActionCodec from "../modules/whatsapp/WhatsappActionCodec.js";

const catalog = new SalesCatalogService();
const orders = new OrderManager();
const extractor = new SalesExtractor();
const fields = new FieldResolver();

assert.equal(catalog.findProducts("I need business cards").length, 1);
assert.equal(catalog.findProducts("I need cards")[0]?.slug, "business-cards");
assert.deepEqual(
  catalog.findCategoryProducts("Print & Marketing").map((p) => p.slug).sort(),
  ["business-cards", "self-ink-stamps"],
);
assert.equal(catalog.findProducts("plastic spaceship").length, 0);

const extracted = extractor.extract({ items: [], currentItem: 0 }, "I need cards");
assert.equal(extracted.products.length, 1);
assert.equal(extracted.products[0].slug, "business-cards");

let order = orders.addItem(orders.createRequirement(), { id: "business-cards" });
const product = catalog.getProduct("business-cards");
const selection = catalog.getSelectionOption(product, "budget-friendly");
const nestedProduct = selection.products.find(p => p.id === "affordable");
order = orders.updateCurrentItem(order, {
  selection,
  selectedProduct: { ...nestedProduct, parentProductId: product.id, parentSelectionId: selection.id },
  formMode: true,
});

const form = orders.getDynamicForm(order);
const ids = form.fields.map((field) => field.id);
for (const requiredId of ["quantity", "artwork", "deliveryMethod", "deliveryDate", "numberOfNames"]) {
  assert(ids.includes(requiredId), `missing ${requiredId}`);
}

let result = orders.submitForm(order, {
  quantity: 500,
  artwork: "need_design",
  deliveryMethod: "pickup",
  deliveryDate: "2026-09-05",
  numberOfNames: 2,
  material: "350gsm Art Matt",
  lamination: "matt",
});
console.dir(result.errors, { depth: null });
assert.equal(result.success, true);
assert.equal(result.order.delivery.method, "pickup");
assert.equal(result.order.delivery.requiredDate, "2026-09-05");
assert.equal(result.order.items[0].workflow.quantity, 500);

result = orders.submitForm(order, {
  quantity: 500,
  artwork: "need_design",
  deliveryMethod: "delivery",
  deliveryDate: "2026-09-05",
  numberOfNames: 2,
  material: "350gsm Art Matt",
  lamination: "matt",
});
assert.equal(result.success, false);
assert("deliveryAddress" in result.errors);

assert.equal(
  fields.resolveSelect(
    { id: "deliveryMethod", type: "select", options: [{ value: "pickup", label: "Pickup" }, { value: "delivery", label: "Delivery", aliases: ["deliver"] }] },
    "deliver it",
  ),
  "delivery",
);

const encoded = WhatsappActionCodec.encode({
  id: "SELECT_PRODUCT",
  payload: { productId: "business-cards" },
});
assert.deepEqual(WhatsappActionCodec.decode(encoded), {
  id: "SELECT_PRODUCT",
  type: "SELECT_PRODUCT",
  payload: { productId: "business-cards" },
});

console.log("catalog-driven-sales: all tests passed");
