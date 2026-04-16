const mongoose = require('mongoose');

// User Schema Definition
// This defines the structure of the User collection in MongoDB

const userSchema = new mongoose.Schema({
  // name: The name of the user
  name: {
    type: String,
    trim: true,
    default: ''
  },

  // walletAddress: The Ethereum wallet address of the user
  walletAddress: {
    type: String,
    required: [true, 'Wallet address is required'],
    unique: true,  // Each wallet address can only be stored once
    trim: true,    // Remove whitespace from both ends
    lowercase: true  // Convert to lowercase for consistency
  },
  
  // role: The role selected by the user (e.g., Farmer, Buyer, etc.)
  role: {
    type: String,
    required: [true, 'Role is required'],
    trim: true
  },
  
  // createdAt: Timestamp when the user was created
  createdAt: {
    type: Date,
    default: Date.now  // Automatically set to current date/time
  }
});


// Export the User model
// This creates a 'User' collection in MongoDB
module.exports = mongoose.model('User', userSchema);
