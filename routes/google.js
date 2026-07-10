const express = require('express')
const router = express.Router()
const { getAuthUrl, getTokenFromCode } = require('../config/google')

router.get('/auth', (req, res) => {
    res.redirect(getAuthUrl())
})

router.get('/oauth2callback', async (req, res) => {
    try {
        const tokens = await getTokenFromCode(req.query.code)
        console.log('SAVE THIS REFRESH TOKEN:', tokens.refresh_token)
        res.send('Auth successful — check your server logs for the refresh token, then add it to .env as GOOGLE_REFRESH_TOKEN')
    } catch (error) {
        console.error(error)
        res.status(500).send('OAuth exchange failed')
    }
})

module.exports = router