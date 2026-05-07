const speakeasy = require('speakeasy')
const QRCode = require('qrcode')
const sharp = require('sharp')
const path = require('path')

const setupAdmin2FA = async (req, res) => {
    const secret = speakeasy.generateSecret({
        length: 20,
        name: "CRM Admin Access"
    })

    global.ADMIN_2FA_SECRET = secret.base32

    // generate QR as buffer
    const qrBuffer = await QRCode.toBuffer(
        secret.otpauth_url,
        {
            errorCorrectionLevel: 'H',
            width: 400,
            margin: 2
        }
    )

    // Logo path
    const logoPath = path.join(__dirname, '../data/deluxe_icon.png')

    // Resize logo
    const logoBuffer = await sharp(logoPath)
        .resize(80, 80)
        .png()
        .toBuffer()

    // Composite logo into center
    const finalQR = await sharp(qrBuffer)
    .composite([
        {
            input: logoBuffer,
            gravity: 'center'
        }
    ])
    .png()
    .toBuffer()

    const qr = `data:image/png;base64,${finalQR.toString('base64')}`

    res.json({
        qr,
        secret: secret.base32
    })
}

module.exports = { setupAdmin2FA }
