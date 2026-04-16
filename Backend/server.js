require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

// Import routes
const userRoutes = require('./routes/userRoutes');
const projectRoutes = require('./routes/projectRoutes');
const submissionRoutes = require('./routes/submissionRoutes');
const blockchainRoutes = require('./routes/blockchainRoutes');

// Initialize express app
const app = express();

// Middleware
// Enable CORS (Cross-Origin Resource Sharing) for frontend communication
app.use(cors());

// Parse JSON request bodies
app.use(express.json());

// Parse URL-encoded request bodies
app.use(express.urlencoded({ extended: true }));

// Routes
// Mount user routes at /api/users
app.use('/api/users', userRoutes);

// Mount project routes at /api/projects
app.use('/api/projects', projectRoutes);

// Mount submission routes at /api/submissions
app.use('/api/submissions', submissionRoutes);

// Mount blockchain routes at /api/blockchain
app.use('/api/blockchain', blockchainRoutes);

// Debug: blockchain status at startup
const { initBlockchain } = require('./controllers/blockchainController');
setTimeout(async () => {
  try {
    await initBlockchain();
    console.log('✅ Blockchain initialized on startup');
  } catch (err) {
    console.warn('⚠️  Blockchain not available on startup:', err.message);
    console.warn('   → Make sure Ganache is running and truffle migrate has been executed');
  }
}, 2000);

// Serve uploaded files statically (for development only)
const path = require('path');
const uploadDir = process.env.UPLOAD_DIR || 'uploads';
app.use('/uploads', express.static(path.join(__dirname, uploadDir)));

// Health check route
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'DApp Backend API is running',
    endpoints: {
      connectWallet: 'POST /api/users/connect-wallet',
      getUser: 'GET /api/users/:walletAddress'
    }
  });
});

// Pinata configuration check route (for debugging)
app.get('/debug/pinata', (req, res) => {
  const { isPinataConfigured, testConnection } = require('./config/pinata');
  
  const token = process.env.PINATA_JWT_TOKEN;
  const isConfigured = isPinataConfigured();
  
  res.json({
    success: true,
    data: {
      tokenExists: !!token,
      tokenPreview: token ? `${token.substring(0, 10)}...` : 'N/A',
      isConfigured: isConfigured,
      apiUrl: 'https://api.pinata.cloud',
      gatewayUrl: 'https://gateway.pinata.cloud/ipfs/'
    }
  });
});

// 404 handler for undefined routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err.stack);
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
});

// Define port
const PORT = process.env.PORT || 5000;

// Start server and connect to database
const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();

    // Start the server
    app.listen(PORT, () => {
      console.log(`\n🚀 Server is running on port ${PORT}`);
      console.log(`📍 Local: http://localhost:${PORT}`);
      console.log(`📍 API: http://localhost:${PORT}/api/users`);
      console.log(`\n✅ Backend is ready to accept connections!\n`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
};

// Start the server
startServer();
