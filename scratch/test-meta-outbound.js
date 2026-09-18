require("dotenv").config();

const token = process.env.WHATSAPP_ACCESS_TOKEN;
const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || "735218809665742";
const recipient = "918310412768";
const apiVersion = process.env.WHATSAPP_GRAPH_API_VERSION || "v23.0";

async function main() {
  const url = `https://graph.facebook.com/${apiVersion}/${phoneId}/messages`;
  
  console.log(`Checking Meta Outbound send to ${recipient}...`);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: recipient,
      type: "text",
      text: { body: "Test connection from Deluxe Printing" },
    }),
  });
  
  const data = await res.json();
  console.log("Status:", res.status);
  console.log("Meta Response:", JSON.stringify(data, null, 2));
}

main().catch(console.error);
