const axios = require("axios");

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

const LEAD_CHAT_ID = process.env.TELEGRAM_LEAD_CHAT_ID;
const LEAVE_CHAT_ID = process.env.TELEGRAM_LEAVE_CHAT_ID;

const countryFlags = {
    UAE: "🇦🇪",
    IND: "🇮🇳",
    PAK: "🇵🇰",
    UGA: "🇺🇬"
};

const divisionChatIds = {
    "Signage": process.env.TELEGRAM_SIGNAGE_CHAT_ID,
    "Stationery": process.env.TELEGRAM_STATIONERY_CHAT_ID,
    "Event (Digital)": process.env.TELEGRAM_EVENT_DIGITAL_CHAT_ID,
    "Event (Fashion & Fabric)": process.env.TELEGRAM_EVENT_FASHION_CHAT_ID,
    "Store Branding": process.env.TELEGRAM_STORE_BRANDING_CHAT_ID,
    "Gifts": process.env.TELEGRAM_GIFTS_CHAT_ID,
    "Gift & Stationery": process.env.TELEGRAM_GIFT_STATIONERY_CHAT_ID
};

const telegramUsers = {
    Ziyad: "@ZiyadBurhan",
    Umair: "@Umair_Deluxe",
    Atif: "@Atif04",
    Nishan: "@Nishan_Lanka",
    Arif: "@Arif636",
    Misba: "@misba_02_26",
    Zohaib: "@zabiwarraich225",
    Mohsin: "@mohsinwada01",
    Junaid: "@Junaid_137",
    Sharifa: "@sharifasherrie",
    Azmat: "@AzmaturRehman",
    Nayeem: "@nayeem_momin",
    Saniya: "@SaniyaAslam",
    "Md-Kaif": "@Kaif19601",
    Muazzam: "@Muazzam_Ali",
    Rizwan: "@rizwanwada",
    MurtazaTS: "@Murtazats",
    Salman: "@mr_sallu_05",
    Admin: "@Hafsa_5_5",
    Huzaifa: "@HuzaifaVaz",
    Aliasgar: "@Aliasgarsv"
};

const sendTelegram = async (chatId, message) => {
    if (!chatId) return;

    try {
        await axios.post(
            `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
            {
                chat_id: chatId,
                text: message,
                parse_mode: "HTML"
            }
        );
    } catch (error) {
        console.error(
            `Telegram Error (${chatId})`,
            error.response?.data || error.message
        );
    }
};

const sendNewLeadMessage = async (lead) => {
    try {
        const products = lead.products?.length
            ? lead.products.map(p => `• ${p.productName}`).join("\n")
            : "N/A";

        const userName =
            telegramUsers[lead.assignToSalesPerson] || "-";

        const message = `
<b>🔔 New Lead Added in Fusion CRM - #${lead.refNo}</b>

<b>Company Name:</b> ${lead.companyName || "-"}
<b>Customer Name:</b> ${lead.name || "-"}
<b>Email Id:</b> ${lead.emailId || "-"}
<b>Phone Number:</b> ${lead.phoneNumber || "-"}
<b>Required Items:</b>
${products}

<b>Division:</b> ${lead.division || "-"}
<b>Lead Source:</b> ${lead.source}
<b>Sales Person:</b> ${lead.assignToSalesPerson}
<b>Username:</b> ${userName}
<b>Lead Assigned By:</b> ${lead.createdBy?.name || "Auto"}

<b>⚡ Powered by Fusion CRM</b>
`;

        // Main Lead Group
        await sendTelegram(LEAD_CHAT_ID, message);

        // Division Group (except N/A)
        const divisionChatId = divisionChatIds[lead.division];

        if (divisionChatId) {
            await sendTelegram(divisionChatId, message);
        }

    } catch (error) {
        console.error("Lead Notification Error", error);
    }
};

const sendLeaveMessage = async (leave) => {
    try {
        const flag =
            countryFlags[leave.employee?.workingCountry] || "🏳️";

        const fromDate = new Date(leave.fromDate).toLocaleDateString("en-GB");
        const toDate = new Date(leave.toDate).toLocaleDateString("en-GB");

        let message = "";

        if (fromDate === toDate) {

            message =
                `<b>📅 Employee Leave Notification</b>\n\n` +
                `${flag} <b>${leave.employee?.name}</b> is on <b>${leave.type === "Half" ? "Half Day" : "Full Day"}</b> leave on <b>${fromDate}</b>.\n\n` +
                `<b>⚡ Powered by Fusion CRM</b>`;

        } else {

            message =
                `<b>📅 Employee Leave Notification</b>\n\n` +
                `${flag} <b>${leave.employee?.name}</b> is on leave from <b>${fromDate}</b> to <b>${toDate}</b> (${leave.leaveDays} day${leave.leaveDays > 1 ? "s" : ""}).\n\n` +
                `<b>⚡ Powered by Fusion CRM</b>`;

        }

        await sendTelegram(LEAVE_CHAT_ID, message);

    } catch (error) {
        console.error("Leave Notification Error", error);
    }
};

module.exports = {
    sendNewLeadMessage,
    sendLeaveMessage
};