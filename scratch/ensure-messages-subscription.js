require("dotenv").config();

const appId = "1118233270734888";
const appSecret = process.env.WHATSAPP_APP_SECRET || "5b7b042ae9854ec3dfa37abc6d019a50";
const appToken = `${appId}|${appSecret}`;
const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
const callbackUrl = "https://toll-manner-citizenship-concern.trycloudflare.com/webhooks/whatsapp";
const apiVersion = process.env.WHATSAPP_GRAPH_API_VERSION || "v23.0";

async function main() {
  console.log("=== Checking App Subscribed Fields ===");
  const getUrl = `https://graph.facebook.com/${apiVersion}/${appId}/subscriptions?access_token=${appToken}`;
  const getRes = await fetch(getUrl);
  const getData = await getRes.json();
  console.log("Current App Subscriptions:", JSON.stringify(getData, null, 2));

  // Let's ensure 'messages' field is explicitly subscribed on the App!
  console.log("\n=== Ensuring 'messages' field is subscribed via App API ===");
  const postUrl = `https://graph.facebook.com/${apiVersion}/${appId}/subscriptions`;
  const postParams = new URLSearchParams({
    object: "whatsapp_business_account",
    callback_url: callbackUrl,
    verify_token: verifyToken,
    fields: "messages",
    access_token: appToken,
  });

  const postRes = await fetch(postUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: postParams.toString(),
  });
  const postData = await postRes.json();
  console.log("POST /subscriptions result:", JSON.stringify(postData, null, 2));

  // Verify again
  const verifyRes = await fetch(getUrl);
  const verifyData = await verifyRes.json();
  console.log("Verified App Subscriptions:", JSON.stringify(verifyData, null, 2));
}

main().catch(console.error);
