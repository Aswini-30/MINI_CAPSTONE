require('dotenv').config();

const axios = require('axios');
const FormData = require('form-data');

/**
 * Pinata IPFS Configuration
 * Handles file uploads to IPFS using Pinata API with JWT authentication
 */

const PINATA_API_URL = 'https://api.pinata.cloud';
const PINATA_GATEWAY_URL = 'https://gateway.pinata.cloud/ipfs/';

// Debug: Check if dotenv loaded correctly
console.log('🔍 Debug - dotenv config loaded:', !!process.env.PINATA_JWT_TOKEN);
console.log('🔍 Debug - PINATA_JWT_TOKEN exists:', !!process.env.PINATA_JWT_TOKEN);
console.log('🔍 Debug - PINATA_JWT_TOKEN value:', process.env.PINATA_JWT_TOKEN ? 'Token exists (hidden)' : 'Token is undefined');

/**
 * Check if Pinata JWT is properly configured
 * @returns {boolean}
 */
const isPinataConfigured = () => {
  const token = process.env.PINATA_JWT_TOKEN;
  
  // Check if token exists
  if (!token) {
    console.log('❌ PINATA_JWT_TOKEN is not defined in .env file');
    return false;
  }
  
  // Check if it's a placeholder value
  const placeholderValues = [
    'your_pinata_jwt_token_here',
    'your_jwt_token_here',
    'REPLACE_WITH_YOUR_PINATA_JWT',
    '',
    'undefined'
  ];
  
  if (placeholderValues.includes(token)) {
    console.log('❌ PINATA_JWT_TOKEN is a placeholder value');
    return false;
  }
  
  console.log('✅ PINATA_JWT_TOKEN is properly configured');
  return true;
};

/**
 * Get the JWT token (for debugging purposes)
 * @returns {string|null}
 */
const getPinataToken = () => {
  return process.env.PINATA_JWT_TOKEN || null;
};

/**
 * Upload a file to IPFS using Pinata
 * @param {Buffer} fileBuffer - The file buffer to upload
 * @param {string} fileName - The original file name
 * @returns {Object} - Contains ipfsHash and pinSize
 */
const uploadToIPFS = async (fileBuffer, fileName) => {
  try {
    // Check if Pinata is configured first
    if (!isPinataConfigured()) {
      throw new Error('Pinata JWT token is not configured. Please add PINATA_JWT_TOKEN to your .env file.');
    }

    const token = process.env.PINATA_JWT_TOKEN;
    
    console.log('📤 Starting IPFS upload...');
    console.log('📄 File name:', fileName);
    console.log('📦 Buffer size:', fileBuffer.length, 'bytes');

    const formData = new FormData();
    
    // Create a buffer from the file
    const buffer = Buffer.from(fileBuffer);
    
    // Append the file to form data
    formData.append('file', buffer, {
      filename: fileName,
      contentType: 'application/octet-stream'
    });

    // Prepare metadata
    const metadata = JSON.stringify({
      name: fileName,
      keyvalues: {
        uploadedAt: new Date().toISOString()
      }
    });
    formData.append('pinataMetadata', metadata);

    // Log the request details (without exposing full token)
    console.log('🌐 Making request to:', `${PINATA_API_URL}/pinning/pinFileToIPFS`);
    console.log('🔐 Authorization header:', `Bearer ${token.substring(0, 10)}...`);

    const response = await axios.post(
      `${PINATA_API_URL}/pinning/pinFileToIPFS`,
      formData,
      {
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        headers: {
          ...formData.getHeaders(),
          Authorization: `Bearer ${token}`
        },
        timeout: 60000 // 60 second timeout
      }
    );

    // Log successful response
    console.log('✅ IPFS upload successful!');
    console.log('🔗 IpfsHash (CID):', response.data.IpfsHash);
    console.log('📏 Pin size:', response.data.PinSize, 'bytes');
    console.log('⏰ Timestamp:', response.data.Timestamp);

    return {
      ipfsHash: response.data.IpfsHash,
      pinSize: response.data.PinSize,
      timestamp: response.data.Timestamp
    };
  } catch (error) {
    // Handle specific error types
    if (error.response) {
      // Server responded with error status
      const status = error.response.status;
      const data = error.response.data;
      
      console.error('❌ Pinata API Error Response:');
      console.error('   Status:', status);
      console.error('   Data:', JSON.stringify(data));
      
      if (status === 401) {
        console.error('   → 401 Unauthorized: Your JWT token is invalid or expired');
        throw new Error('Pinata authentication failed. Please check your JWT token.');
      } else if (status === 403) {
        console.error('   → 403 Forbidden: You do not have permission to upload');
        throw new Error('Pinata permission denied. Please check your API key permissions.');
      } else if (status === 429) {
        console.error('   → 429 Too Many Requests: Rate limit exceeded');
        throw new Error('Pinata rate limit exceeded. Please try again later.');
      } else {
        throw new Error(data.error || `Pinata API error: ${status}`);
      }
    } else if (error.request) {
      // Request was made but no response received
      console.error('❌ Network Error:');
      console.error('   → No response received from Pinata');
      console.error('   → Error message:', error.message);
      throw new Error('Network error: Unable to reach Pinata. Please check your internet connection.');
    } else {
      // Something else happened
      console.error('❌ Error setting up request:');
      console.error('   →', error.message);
      throw new Error(error.message || 'Failed to upload to IPFS');
    }
  }
};

/**
 * Get the full IPFS gateway URL from hash
 * @param {string} ipfsHash - The IPFS hash (CID)
 * @returns {string} - Full gateway URL
 */
const getGatewayURL = (ipfsHash) => {
  return `${PINATA_GATEWAY_URL}${ipfsHash}`;
};

/**
 * Test Pinata connection
 * @returns {Promise<boolean>}
 */
const testConnection = async () => {
  try {
    console.log('🧪 Testing Pinata connection...');
    
    if (!isPinataConfigured()) {
      console.log('❌ Pinata not configured');
      return false;
    }
    
    const response = await axios.get(
      `${PINATA_API_URL}/data/userPinnedFilesTotal`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PINATA_JWT_TOKEN}`
        }
      }
    );
    
    console.log('✅ Pinata connection test successful!');
    console.log('📊 Total pinned files:', response.data.count);
    return true;
  } catch (error) {
    console.error('❌ Pinata connection test failed:');
    console.error('   →', error.message);
    return false;
  }
};

module.exports = {
  uploadToIPFS,
  getGatewayURL,
  isPinataConfigured,
  testConnection,
  getPinataToken,
  PINATA_API_URL,
  PINATA_GATEWAY_URL
};
