/**
 * blockchainRoutes.js - FIXED VERSION 
 * Complete router implementation for blockchain endpoints
 * Fixes SyntaxError: Unexpected end of input (truncated file)
 * Routes match all functions exported from blockchainController.js
 */

const express = require('express');
const router = express.Router();
const controller = require('../controllers/blockchainController');

// ─── Status & Health ──────────────────────────────────────────────────────────
router.get('/status', controller.getStatus);
router.get('/credits/price', controller.getCreditPrice);

// ─── Project Lifecycle ───────────────────────────────────────────────────────
router.post('/projects/create', controller.createProject);
router.post('/projects/verify-initial', controller.verifyInitial);
router.post('/projects/verify-final', controller.verifyFinal);
router.post('/projects/create-and-mint', controller.createAndMint); // Single-step convenience

// ─── Credits Marketplace ─────────────────────────────────────────────────────
router.get('/credits/available', controller.getAvailableCredits);
router.post('/purchase-credits', controller.purchaseCredits);
router.post('/credits/purchase', controller.purchaseCredits);
router.get('/credits/purchases/:buyerAddress', controller.getPurchaseHistory);

// ─── Debug/Contracts ─────────────────────────────────────────────────────────
router.get('/contracts', async (req, res) => {
  try {
    const details = await controller.getContractDetails('CarbonCreditSystem');
    res.json({ success: true, data: details });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
