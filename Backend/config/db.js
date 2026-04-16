// MongoDB Connection File
// This file handles the connection to MongoDB database

require('dotenv').config();
const mongoose = require('mongoose');

// Get MongoDB URI from environment variable
const MONGODB_URI = process.env.MONGODB_URI;

/**
 * Connect to MongoDB database
 * This function connects to MongoDB using Mongoose
 */
const connectDB = async () => {
  try {
    // Connect to MongoDB
    const conn = await mongoose.connect(MONGODB_URI);
    
    // Log successful connection
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📂 Database Name: ${conn.connection.name}`);
    
  } catch (error) {
    // Handle connection error
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    
    // Exit process with failure
    process.exit(1);
  }
};

// Export the connectDB function
module.exports = connectDB;
