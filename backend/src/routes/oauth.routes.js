const router = require('express').Router();
const { authenticate } = require('../middleware/auth.middleware');
const { initiateInstagramOAuth, handleInstagramCallback } = require('../controllers/oauth.controller');

// Initiate: frontend calls this (authenticated), gets back oauthUrl
router.get('/instagram', authenticate, initiateInstagramOAuth);

// Callback: Meta redirects here — no JWT, validated via state param
router.get('/instagram/callback', handleInstagramCallback);

module.exports = router;
