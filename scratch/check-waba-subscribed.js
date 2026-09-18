require("dotenv").config();

const token = process.env.WHATSAPP_ACCESS_TOKEN;
const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || "2175260026311711";
const apiVersion = process.env.WHATSAPP_GRAPH_API_VERSION || "v23.0";

async function main() {
  const url = `https://graph.facebook.com/${apiVersion}/${wabaId}/subscribed_apps`;
  
  // Re-subscribe on WABA to be 100% sure
  const postRes = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  console.log("WABA POST subscribed_apps:", await postRes.json());

  // GET subscribed_apps
  const getRes = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log("WABA GET subscribed_apps:", JSON.stringify(await getRes.json(), null, 2));
}

main().catch(console.error);
