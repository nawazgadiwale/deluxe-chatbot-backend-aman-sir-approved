require("dotenv").config();

const token = process.env.WHATSAPP_ACCESS_TOKEN;
const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || "735218809665742";
const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || "2175260026311711";
const apiVersion = process.env.WHATSAPP_GRAPH_API_VERSION || "v23.0";

async function queryMeta(endpoint) {
  const url = `https://graph.facebook.com/${apiVersion}/${endpoint}`;
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    const data = await res.json();
    return { status: res.status, ok: res.ok, data };
  } catch (err) {
    return { status: 500, ok: false, error: err.message };
  }
}

async function main() {
  console.log("\n--- Querying detailed phone number status ---");
  const phoneDetails = await queryMeta(
    `${phoneId}?fields=id,status,name_status,new_name_status,quality_rating,verified_name,is_pin_enabled,account_mode,certificate,eligibility_for_api_business_global_search,is_official_business_account,messaging_limit_tier`
  );
  console.log(JSON.stringify(phoneDetails.data, null, 2));

  console.log("\n--- Querying WABA Subscribed Apps with fields ---");
  const subApps = await queryMeta(`${wabaId}/subscribed_apps?fields=whatsapp_business_api_data`);
  console.log(JSON.stringify(subApps.data, null, 2));

  console.log("\n--- Checking App 1118233270734888 subscriptions ---");
  const appSub = await queryMeta(`1118233270734888/subscriptions`);
  console.log("App Subscriptions:", JSON.stringify(appSub.data, null, 2));
}

main().catch(console.error);
