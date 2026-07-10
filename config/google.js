const { google } = require('googleapis')

const {
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI,
    GOOGLE_REFRESH_TOKEN
} = process.env

const SCOPES = [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/documents'
]

const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
)

// If you already have a long-lived refresh token, set it once here
if (GOOGLE_REFRESH_TOKEN) {
    oauth2Client.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN })
}

// Generates the URL the user visits to grant consent
const getAuthUrl = () => {
    return oauth2Client.generateAuthUrl({
        access_type: 'offline', // required to get a refresh_token
        prompt: 'consent',      // forces refresh_token on repeat auth too
        scope: SCOPES
    })
}

// Exchanges the ?code=... query param (from the redirect) for tokens
const getTokenFromCode = async (code) => {
    const { tokens } = await oauth2Client.getToken(code)
    oauth2Client.setCredentials(tokens)
    return tokens // contains access_token, refresh_token, expiry_date...
}

const getDriveClient = () => google.drive({ version: 'v3', auth: oauth2Client })
const getSheetsClient = () => google.sheets({ version: 'v4', auth: oauth2Client })
const getDocsClient = () => google.docs({ version: 'v1', auth: oauth2Client })

const verifyGoogleAuth = async () => {
    try {
        await oauth2Client.getAccessToken()
        console.log('Google OAuth2 client authenticated successfully!')
    } catch (error) {
        console.error('Google OAuth2 authentication failed:', error.message)
        throw error
    }
}

module.exports = {
    oauth2Client,
    getAuthUrl,
    getTokenFromCode,
    getDriveClient,
    getSheetsClient,
    getDocsClient,
    verifyGoogleAuth
}