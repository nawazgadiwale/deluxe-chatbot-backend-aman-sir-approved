import WhatsAppService from "../modules/whatsapp/WhatsAppService.js";
import util from "util";

async function run() {
  process.env.WHATSAPP_ACCESS_TOKEN = "mock_access_token_123";
  process.env.WHATSAPP_PHONE_NUMBER_ID = "mock_phone_number_id_456";
  process.env.WHATSAPP_ORDER_FLOW_ID = "mock_flow_id_789";

  const whatsappService = new WhatsAppService();

  // INTERCEPT OUTGOING WHATSAPP MESSAGES
  whatsappService.apiService.sendMessage = async (to, payload) => {
    console.log("\n=======================================================");
    console.log("➡️  OUTGOING WHATSAPP MESSAGE PAYLOAD (Meta Graph API)");
    console.log("=======================================================");
    console.log(`[Recipient]: ${to}`);

    if (payload.type === "interactive") {
      console.log(`[Type]: Interactive (${payload.interactive.type})`);
      console.log(`[Text]: ${payload.interactive.body.text}`);

      if (payload.interactive.type === "button") {
        console.log(`[Buttons]:`);
        payload.interactive.action.buttons.forEach((b) =>
          console.log(`  - ${b.reply.title}`),
        );
      } else if (payload.interactive.type === "list") {
        console.log(`[List Button]: ${payload.interactive.action.button}`);
        console.log(`[List Options]:`);
        payload.interactive.action.sections[0].rows.forEach((r) =>
          console.log(`  - ${r.title}`),
        );
      } else if (payload.interactive.type === "flow") {
        console.log(`[Flow JSON Payload]:`);
        console.log(
          util.inspect(payload.interactive.action, {
            depth: null,
            colors: false,
          }),
        );
      }
    } else if (payload.type === "text") {
      console.log(`[Type]: Text`);
      console.log(`[Text]: ${payload.text.body}`);
    } else {
      console.log(`[Type]: ${payload.type}`);
      console.log(util.inspect(payload, { depth: null, colors: true }));
    }
    console.log("=======================================================\n");

    return {
      messaging_product: "whatsapp",
      contacts: [{ input: to, wa_id: to }],
      messages: [{ id: "wamid.mock" }],
    };
  };

  const createWebhookPayload = (message) => ({
    object: "whatsapp_business_account",
    entry: [
      {
        id: "TEST_ACCOUNT",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { phone_number_id: "123" },
              contacts: [{ profile: { name: "Test User" }, wa_id: "9999999999" }],
              messages: [message]
            }
          }
        ]
      }
    ]
  });

  console.log("=======================================================");
  console.log("1️⃣ INCOMING: User sends 'I need business cards'");
  
  // Directly call the sendResult instead of going through AI + Mongo
  const mockResult = {
    message: "Please choose from the available options.",
    actions: [
      { id: "budget-friendly", label: "Budget-Friendly Business Cards" },
      { id: "premium", label: "Premium Business Cards" },
      { id: "luxury", label: "Luxury Business Cards" }
    ]
  };

  const incomingMessage = {
    whatsapp: {
      phoneNumber: "9999999999"
    }
  };

  whatsappService.windowPolicy.recordInboundCustomerMessage("9999999999", Date.now());
  await whatsappService.sendResult(incomingMessage, mockResult);
  
  // Mocking the Next step: Nested Products
  console.log("=======================================================");
  console.log("2️⃣ INCOMING: User selected 'Budget-Friendly Business Cards'");
  const mockResult2 = {
    message: "Please choose a product from Budget-Friendly Business Cards.",
    actions: [
      { id: "affordable", label: "Affordable Business Cards" },
      { id: "laminated", label: "Laminated Business Cards" },
      { id: "pvc-plastic", label: "PVC-Plastic Business Cards" }
    ]
  };
  whatsappService.windowPolicy.recordInboundCustomerMessage("9999999999", Date.now());
  await whatsappService.sendResult(incomingMessage, mockResult2);

  // Mocking Form
  console.log("=======================================================");
  console.log("3️⃣ INCOMING: User selected 'Affordable Business Cards'");
  const mockResult3 = {
    message: "Please complete the order details below.",
    interaction: "FORM",
    context: {
      form: {
        id: "order-form-affordable",
        title: "Affordable Business Cards Details",
        submit: { label: "Continue" },
        fields: [
          { id: "quantity", type: "select", options: [] },
          { id: "material", type: "select", options: [] }
        ],
        values: { quantity: 500 }
      }
    }
  };
  whatsappService.windowPolicy.recordInboundCustomerMessage("9999999999", Date.now());
  await whatsappService.sendResult(incomingMessage, mockResult3);
  
  process.exit(0);
}

run().catch(console.error);
