const axios = require('axios')

const sendWhatsAppMessage = async ({
    phone,
    message
}) => {
    try {
        const url = `https://graph.facebook.com/${process.env.WHATSAPP_VERSION}`
        await axios.post(
            url,
            {
                messaging_product: 'whatsapp',
                to: phone,
                type: 'text',
                text: {
                    body: message
                }
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            }
        )

    } catch (error) {
        console.error('Whatsapp sending error', error)
    }
}

module.exports = sendWhatsAppMessage