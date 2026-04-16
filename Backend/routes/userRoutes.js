// User Routes
// This file defines all the routes related to users

const express = require('express');
const router = express.Router();

// Import controller functions
const { connectWallet, getUser } = require('../controllers/userController');

/**
 * POST /api/users/connect-wallet
 * Connect or create a user with their wallet address
 * 
 * Request Body:
 * {
 *   "walletAddress": "0x123...",
 *   "role": "Farmer"
 * }
 * 
 * Response:
 * - 200: User already exists
 * - 201: New user created
 * - 400: Validation error
 * - 500: Server error
 */
router.post('/connect-wallet', connectWallet);

/**
 * GET /api/users/:walletAddress
 * Get user by wallet address (optional endpoint)
 */
router.get('/:walletAddress', getUser);

// Export the router
module.exports = router;
