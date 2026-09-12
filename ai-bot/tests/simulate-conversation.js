import SalesBrain from "../modules/sales/SalesBrain.js";
import SalesCatalogService from "../modules/sales/services/SalesCatalogService.js";
import OrderManager from "../modules/sales/services/OrderManager.js";
import util from "util";

async function run() {
  const brain = new SalesBrain();
  let state = {
    userMessage: "I need business cards",
    currentStep: "GREETING",
  };

  console.log('User: "I need business cards"');
  let result = await brain.execute(state);
  console.log("Bot:", result.message);
  if (result.actions && result.actions.length > 0) {
    console.log("Actions:", result.actions.map(a => a.label).join(", "));
  }

  // Simulate selecting product
  if (result.actions && result.actions.length > 0 && result.actions[0].id === "SELECT_PRODUCT") {
    console.log(`\nUser: (Clicks "${result.actions[0].label}")`);
    state = {
      userMessage: "",
      currentStep: result.currentStep,
      liveRequirement: result.liveRequirement,
      action: result.actions[0]
    };
    result = await brain.execute(state);
    console.log("Bot:", result.message);
    if (result.actions && result.actions.length > 0) {
      console.log("Actions:", result.actions.map(a => a.label).join(", "));
    }
  }

  // Next steps depends on form or nested product
  if (result.actions && result.actions.length > 0 && result.actions[0].id === "SELECT_SELECTION") {
    console.log(`\nUser: (Clicks "${result.actions[0].label}")`);
    state = {
      userMessage: "",
      currentStep: result.currentStep,
      liveRequirement: result.liveRequirement,
      action: result.actions[0]
    };
    result = await brain.execute(state);
    console.log("Bot:", result.message);
    if (result.actions && result.actions.length > 0) {
      console.log("Actions:", result.actions.map(a => a.label).join(", "));
    }
  }

  // Next step: Nested Product (e.g. Affordable Business Cards)
  if (result.actions && result.actions.length > 0 && result.actions[0].id === "SELECT_NESTED_PRODUCT") {
    console.log(`\nUser: (Clicks "${result.actions[0].label}")`);
    state = {
      userMessage: "",
      currentStep: result.currentStep,
      liveRequirement: result.liveRequirement,
      action: result.actions[0]
    };
    result = await brain.execute(state);
    console.log("Bot:", result.message);
    if (result.sections) {
      console.log("Sections:", JSON.stringify(result.sections.map(s => s.title)));
      console.log("Form Fields:", JSON.stringify(result.sections[0].form.fields.map(f => f.label)));
    }
  }

  // Submit form
  if (result.currentStep === "ORDER_FORM") {
    console.log("\nUser: (Submits Order Form with quantity 500, delivery but no address)");
    state = {
      userMessage: "",
      currentStep: result.currentStep,
      liveRequirement: result.liveRequirement,
      action: {
        id: "SUBMIT_ORDER_FORM",
        payload: {
          formData: {
            quantity: 500,
            artwork: "need_design",
            deliveryMethod: "delivery",
            deliveryDate: "2026-09-05",
            numberOfNames: 1,
            material: "350gsm Art Matt",
            lamination: "matt"
          }
        }
      }
    };
    result = await brain.execute(state);
    console.log("Bot:", result.message);
    
    if (result.sections && result.sections[0].errors) {
        console.log("Errors:", result.sections[0].errors);
    }
  }
}

run().catch(console.error);
