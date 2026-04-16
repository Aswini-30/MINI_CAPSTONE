// User Controller
// This file handles the logic for user-related operations

const User = require('../models/User');

/**
 * connectWallet - Connect or create a user with their wallet address
 * 
 * Request Body:
 * {
 *   "walletAddress": "0x123...",
 *   "role": "Farmer"
 * }
 * 
 * Logic:
 * - If wallet already exists → return existing user
 * - If not → create new user
 * - Return success response
 */
const connectWallet = async (req, res) => {
  try {
    // Log incoming request
    console.log('🔔 connectWallet called');
    console.log('📥 Request Body:', req.body);

    // Extract walletAddress and role from request body
    const { walletAddress, role } = req.body;

    // Validate required fields
    if (!walletAddress || !role) {
      console.log('⚠️ Missing required fields');
      return res.status(400).json({
        success: false,
        message: 'Wallet address and role are required'
      });
    }

    // Normalize wallet address to lowercase for consistency
    const normalizedWalletAddress = walletAddress.toLowerCase();

    console.log(`🔍 Checking if wallet exists: ${normalizedWalletAddress}`);

    // Check if user already exists with this wallet address
    let user = await User.findOne({ walletAddress: normalizedWalletAddress });

    if (user) {
      // User already exists - check if role matches
      if (user.role !== role) {
        // Wallet exists but with different role
        console.log('⚠️ Wallet exists with different role:', user.role);
        return res.status(400).json({
          success: false,
          message: `This wallet is already registered as ${user.role}. Please select a different role.`
        });
      }
      
      // Same role - login success
      console.log('✅ User already exists with same role:', user);
      return res.status(200).json({
        success: true,
        message: 'User login successful',
        data: user
      });
    }

    // Create new user
    console.log('➕ Creating new user...');
    user = await User.create({
      walletAddress: normalizedWalletAddress,
      role: role
    });

    console.log('✅ New user created:', user);

    // Return success response with 201 status (Created)
    return res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: user
    });

  } catch (error) {
    // Handle errors
    console.error('❌ Error in connectWallet:', error.message);
    
    // Check for duplicate key error (wallet address already exists)
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Wallet address already exists'
      });
    }

    // Return server error response
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * getUser - Get user by wallet address (optional additional endpoint)
 */
const getUser = async (req, res) => {
  try {
    const { walletAddress } = req.params;

    console.log(`🔍 Finding user: ${walletAddress}`);

    const user = await User.findOne({ walletAddress: walletAddress.toLowerCase() });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: user
    });

  } catch (error) {
    console.error('❌ Error in getUser:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Export controller functions
module.exports = {
  connectWallet,
  getUser
};
