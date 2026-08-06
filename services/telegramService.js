const axios = require('axios')

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const LEAD_CHAT_ID = process.env.TELEGRAM_LEAD_CHAT_ID

const telegramUsers = {
    Ziyad: '@ZiyadBurhan',
    Umair: '@Umair_Deluxe',
    Atif: '@Atif04',
    Nishan: '@Nishan_Lanka',
    Arif: '@Arif636',
    Misba: '@misba_02_26',
    Zohaib: '@zabiwarraich225',
    Mohsin: '@mohsinwada01',
    Junaid: '@Junaid_137',
    Sharifa: '',
    Azmat: '@AzmaturRehman',
    Nayeem: '@nayeem_momin',
    Saniya: '@SaniyaAslam',
    'Md-Kaif': '@Kaif19601',
    Muazzam: '@Muazzam_Ali',
    Rizwan: '@rizwanwada',
    MurtazaTS: '@Murtazats',
    Salman: '@mr_sallu_05',
    Admin: '@Hafsa_5_5',
    Huzaifa: '@HuzaifaVaz',
    Aliasgar: '@Aliasgarsv'
}

const sendNewLeadMessage = async (lead) => {
    try {

        const products = lead.products?.length
            ? lead.products.map(p => `• ${p.productName}`).join("\n")
            : "N/A";

        const userName =
            telegramUsers[lead.assignToSalesPerson] || "-"

        const message =
            `
        <b>🔔 New Lead Added in Fusion CRM - #${lead.refNo}</b>

<b>Company Name:</b> ${lead.companyName || "-"}
<b>Customer Name:</b> ${lead.name || '-'}
<b>Email Id:</b> ${lead.emailId || '-'}
<b>Phone Number:</b> ${lead.phoneNumber || '-'}
<b>Required Items:</b> ${products}
<b>Division:</b> ${lead.division || '-'}
<b>Lead Source:</b> ${lead.source}
<b>Sales Person:</b> ${lead.assignToSalesPerson}
<b>Username:</b>${userName}
<b>Lead Assigned By:</b> ${lead.createdBy?.name || 'Auto'}

<b>⚡Powered by Fusion CRM</b>
        `

        await axios.post(
            `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
            {
                chat_id: LEAD_CHAT_ID,
                text: message,
                parse_mode: "HTML",
            }
        )
    } catch (error) {
        console.error("Telegram Error", error.response?.data || error.message)
    }
}


module.exports = { sendNewLeadMessage }