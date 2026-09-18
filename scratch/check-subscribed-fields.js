require("dotenv").config();

const token = process.env.WHATSAPP_ACCESS_TOKEN;
const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || "2175260026311711";
const apiVersion = process.env.WHATSAPP_GRAPH_API_VERSION || "v23.0";

async function main() {
  const url = `https://graph.facebook.com/${apiVersion}/${wabaId}/subscribed_apps`;
  
  console.log("Checking subscribed_apps on WABA...");
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  const data = await res.json();
  console.log("POST /subscribed_apps result:", JSON.stringify(data, null, 2));

  // Check phone number webhook override
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || "735218809665742";
  const phoneUrl = `https://graph.facebook.com/${apiVersion}/${phoneId}?fields=webhook_configuration`;
  const phoneRes = await fetch(phoneUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  const phoneData = await phoneRes.json();
  console.log("Phone webhook_configuration:", JSON.stringify(phoneData, null, 2));
}

main().catch(console.error);
