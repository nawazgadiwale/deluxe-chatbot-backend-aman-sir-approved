require("dotenv").config();

const appId = "1118233270734888";
const appSecret = process.env.WHATSAPP_APP_SECRET || "5b7b042ae9854ec3dfa37abc6d019a50";
const appToken = `${appId}|${appSecret}`;
const apiVersion = process.env.WHATSAPP_GRAPH_API_VERSION || "v23.0";

async function main() {
  const url = `https://graph.facebook.com/${apiVersion}/${appId}/subscriptions?fields=object,callback_url,fields,active&access_token=${appToken}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    console.log("App Subscriptions with fields:", JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Error:", err);
  }
}

main();
