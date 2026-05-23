const nodemailer = require('nodemailer')

const isProduction =
    process.env.NODE_ENV === 'production'

const transporter = nodemailer.createTransport({

    host: 'smtp-relay.brevo.com',

    port: 587,

    secure: false,

    auth: {
        user: process.env.BREVO_SMTP_USER,
        pass: process.env.BREVO_SMTP_PASS
    },

    pool: true,

    maxConnections: 5,

    maxMessages: 100,

    connectionTimeout: 10000,

    greetingTimeout: 10000,

    socketTimeout: 10000,

    tls: {

        rejectUnauthorized: isProduction
    }
})

// VERIFY SMTP CONNECTION
transporter.verify((error) => {

    if (error) {

        console.error(
            'SMTP Connection Error:',
            error.message
        )

    } 
})

const sendEmail = async ({
    to,
    subject,
    html
}) => {

    try {

        const info = await transporter.sendMail({

            from: `DLX Fusion <${process.env.BREVO_EMAIL}>`,

            to,

            subject,

            html
        })

        console.log(
            `Mail sent to ${to}: ${info.messageId}`
        )

        return {
            success: true,
            messageId: info.messageId
        }

    } catch (error) {

        console.error(
            `Mail sending error for ${to}:`,
            error.message
        )

        return {
            success: false,
            error: error.message
        }
    }
}

module.exports = sendEmail