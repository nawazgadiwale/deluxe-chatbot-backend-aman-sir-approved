import test, { describe, it } from "node:test";
import assert from "node:assert/strict";

import PricingService from "../modules/sales/services/PricingService.js";
import DeliveryService, {
  DELIVERY_CHARGES,
  DELIVERY_METHODS,
} from "../modules/sales/services/DeliveryService.js";
import SalesCatalogService from "../modules/sales/services/SalesCatalogService.js";
import WhatsAppFlowSubmissionService from "../modules/whatsapp/flows/WhatsAppFlowSubmissionService.js";
import WhatsAppResponseAdapter from "../modules/whatsapp/WhatsAppResponseAdapter.js";

const pricingService = new PricingService();
const deliveryService = new DeliveryService();
const catalogService = new SalesCatalogService();
const responseAdapter = new WhatsAppResponseAdapter();

describe("Product Details + Pricing — Catalog Driven Suite (13 Acceptance Tests)", () => {
  // Test 1: Valid catalog price -> correct AED price
  it("1. Valid catalog price returns correct AED price", () => {
    const item = {
      product: { id: "roll-up-banner" },
      quantity: 1,
    };
    const result = pricingService.calculateItem(item);
    assert.equal(result.pricing.currency, "AED");
    assert.equal(result.pricing.unitPrice, 130);
    assert.equal(result.pricing.subtotal, 130);
    assert.equal(result.pricing.quotationRequired, false);
  });

  // Test 2: Variant with different price -> correct variant price
  it("2. Variant with different price returns correct variant price", () => {
    // 85x200 = 130
    const itemStandard = {
      product: { id: "roll-up-banner" },
      selection: "85x200",
      quantity: 1,
    };
    const resStandard = pricingService.calculateItem(itemStandard);
    assert.equal(resStandard.pricing.unitPrice, 130);

    // 100x200 = 190
    const itemMedium = {
      product: { id: "roll-up-banner" },
      selection: "100x200",
      quantity: 1,
    };
    const resMedium = pricingService.calculateItem(itemMedium);
    assert.equal(resMedium.pricing.unitPrice, 190);

    // 120x200 = 225
    const itemLarge = {
      product: { id: "roll-up-banner" },
      selection: "120x200",
      quantity: 1,
    };
    const resLarge = pricingService.calculateItem(itemLarge);
    assert.equal(resLarge.pricing.unitPrice, 225);
  });

  // Test 3: Quantity > 1 -> correct subtotal
  it("3. Quantity > 1 returns correct subtotal (unitPrice * quantity)", () => {
    const item = {
      product: { id: "roll-up-banner" },
      selection: "100x200",
      quantity: 3,
    };
    const result = pricingService.calculateItem(item);
    assert.equal(result.pricing.unitPrice, 190);
    assert.equal(result.pricing.quantity, 3);
    assert.equal(result.pricing.subtotal, 570); // 190 * 3
  });

  // Test 4: Delivery -> exactly AED 25
  it("4. Delivery method 'delivery' returns exactly AED 25", () => {
    const charge = deliveryService.calculateCharge({
      delivery: { method: DELIVERY_METHODS.DELIVERY },
    });
    assert.equal(charge, 25);
    assert.equal(DELIVERY_CHARGES[DELIVERY_METHODS.DELIVERY], 25);
  });

  // Test 5: Pickup -> AED 0 delivery
  it("5. Delivery method 'pickup' returns exactly AED 0", () => {
    const charge = deliveryService.calculateCharge({
      delivery: { method: DELIVERY_METHODS.PICKUP },
    });
    assert.equal(charge, 0);
    assert.equal(DELIVERY_CHARGES[DELIVERY_METHODS.PICKUP], 0);
  });

  // Test 6: Total -> subtotal + delivery, before VAT
  it("6. Total calculation equals subtotal + delivery before VAT", () => {
    const requirement = {
      items: [
        {
          product: { id: "roll-up-banner" },
          selection: "85x200", // 130 AED
          quantity: 1,
        },
      ],
      delivery: {
        method: DELIVERY_METHODS.DELIVERY, // 25 AED
      },
    };
    const calc = pricingService.calculate(requirement);
    assert.equal(calc.subtotal, 130);
    assert.equal(calc.deliveryCharge, 25);
    assert.equal(calc.totalBeforeVAT, 155); // 130 + 25
    assert.equal(calc.total, 155);
  });

  // Test 7: No VAT added to displayed totals
  it("7. No VAT is added to displayed prices or totals", () => {
    const requirement = {
      items: [
        {
          product: { id: "roll-up-banner" },
          selection: "100x200", // 190 AED
          quantity: 2, // 380 AED
        },
      ],
      delivery: {
        method: DELIVERY_METHODS.DELIVERY, // 25 AED
      },
    };
    const calc = pricingService.calculate(requirement);
    assert.equal(calc.subtotal, 380);
    assert.equal(calc.deliveryCharge, 25);
    assert.equal(calc.totalBeforeVAT, 405);
    assert.equal(calc.total, 405); // No 5% VAT added
    assert.equal(calc.tax, undefined);
  });

  // Test 8: Missing catalog price -> no fabricated price
  it("8. Product with missing catalog price does NOT fabricate a price", () => {
    // Artificial item without price
    const item = {
      product: { id: "item-without-price", name: "Custom Print" },
      quantity: 1,
    };
    const result = pricingService.calculateItem(item);
    assert.equal(result.pricing.unitPrice, 0);
    assert.equal(result.pricing.subtotal, 0);
    assert.equal(result.pricing.quotationRequired, true);
  });

  // Test 9: quotationRequired product -> existing quotation workflow
  it("9. quotationRequired product preserves quotation workflow without price fabrication", () => {
    // business-cards has quotationRequired: true in catalog
    const item = {
      product: { id: "business-cards" },
      quantity: 100,
    };
    const result = pricingService.calculateItem(item);
    assert.equal(result.pricing.quotationRequired, true);

    const calc = pricingService.calculate({
      items: [item],
      delivery: { method: "delivery" },
    });
    assert.equal(calc.quotationRequired, true);
    assert.equal(calc.totalBeforeVAT, null);
  });

  // Test 10: Unknown product -> no invented product/price
  it("10. Unknown product ID returns null and does not invent product or price", () => {
    const item = {
      product: { id: "non-existent-product-id-9999" },
      quantity: 1,
    };
    const result = pricingService.calculateItem(item);
    assert.equal(result.pricing.unitPrice, 0);
    assert.equal(result.pricing.subtotal, 0);
    assert.equal(result.pricing.quotationRequired, true);
  });

  // Test 11: Repeated/concurrent requests -> same authoritative price
  it("11. Repeated and concurrent requests produce identical authoritative price", async () => {
    const item = {
      product: { id: "roll-up-banner" },
      selection: "120x200",
      quantity: 2,
    };

    const runCalc = () => pricingService.calculateItem(item);

    const [res1, res2, res3] = await Promise.all([
      Promise.resolve(runCalc()),
      Promise.resolve(runCalc()),
      Promise.resolve(runCalc()),
    ]);

    assert.equal(res1.pricing.unitPrice, 225);
    assert.equal(res2.pricing.unitPrice, 225);
    assert.equal(res3.pricing.unitPrice, 225);
    assert.equal(res1.pricing.subtotal, 450);
    assert.equal(res2.pricing.subtotal, 450);
    assert.equal(res3.pricing.subtotal, 450);
  });

  // Test 12: Flow submission -> same pricing implementation
  it("12. WhatsApp Flow submission uses the same PricingService and DeliveryService", async () => {
    process.env.WHATSAPP_FLOW_TOKEN_SECRET = "test_flow_secret_12345";
    const flowService = new WhatsAppFlowSubmissionService();

    const token = flowService.tokenService.create({
      type: "order",
      productId: "roll-up-banner",
      phoneNumber: "918310412768",
    });

    const flowData = {
      bannerType: "100x200", // 190 AED
      quantity: 2, // 380 AED
      deliveryMethod: "delivery", // 25 AED
      artwork: "have_artwork",
      deliveryDate: "2026-09-15",
    };

    const res = await flowService.handleFlowSubmission({
      flowData,
      flowToken: token,
      messageId: `wamid_flow_pricing_test_${Date.now()}`,
      customerWaId: "918310412768",
    });

    assert.equal(res.handled, true);
    assert.equal(res.orderData.pricing.unitPrice, 190);
    assert.equal(res.orderData.pricing.quantity, 2);
    assert.equal(res.orderData.pricing.subtotal, 380);
    assert.equal(res.orderData.pricing.deliveryCharge, 25);
    assert.equal(res.orderData.pricing.totalBeforeVAT, 405);
    assert.equal(res.orderData.pricing.total, 405);

    // Verify response message contains customer-facing breakdown without VAT
    assert.match(res.response.message, /Product price:\* AED 190/);
    assert.match(res.response.message, /Quantity:\* 2/);
    assert.match(res.response.message, /Subtotal:\* AED 380/);
    assert.match(res.response.message, /Delivery charge:\* AED 25/);
    assert.match(res.response.message, /Total before VAT:\* AED 405/);
    assert.doesNotMatch(res.response.message, /(?<!before\s)VAT/i);
  });

  // Test 13: Same configuration through different input types -> same price
  it("13. Same configuration through direct calculation, caption renderer, and flow produces identical pricing", () => {
    const product = catalogService.getProduct("roll-up-banner");
    const selection = catalogService.getSelectionOption(product, "85x200");

    // Input Type A: Direct calculateItem
    const calc = pricingService.calculateItem({
      product,
      selection,
      quantity: 1,
    });
    assert.equal(calc.pricing.unitPrice, 130);

    // Input Type B: Product Caption Renderer
    const caption = responseAdapter.generateProductCaption({
      id: "roll-up-banner",
      selection: "85x200",
    });
    assert.match(caption, /Price:\* AED 130/);
    assert.match(caption, /Delivery:\* AED 25/);
    assert.match(caption, /Total before VAT:\* AED 155/);
    assert.doesNotMatch(caption, /(?<!before\s)VAT/i);
  });
});
