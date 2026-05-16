const nodemailer = require('nodemailer')

const transporter = nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 587,
    secure: false,
    auth: {
        user: process.env.BREVO_SMTP_USER,
        pass: process.env.BREVO_SMTP_PASS
    }
})

const sendEmail = async ({
    to,
    subject,
    html
}) => {
    try {
        const info = await transporter.sendMail({
            from: process.env.BREVO_EMAIL,
            to,
            subject,
            html
        })

        console.log('Mail sent:', info.messageId)
    } catch (error) {
        console.error('Mail sending error', error)
    }
}

module.exports = sendEmail