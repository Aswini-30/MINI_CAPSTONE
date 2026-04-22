const Purchase = require('../models/Purchase');
const Project = require('../models/Project');

/**
 * Get all purchases (for Industry dashboard)
 * GET /api/projects/purchases
 * Optional: ?buyerAddress=0x...&limit=50
 */
const getPurchases = async (req, res) => {
  try {
    const { buyerAddress, limit = 50, page = 1 } = req.query;
    const skip = (page - 1) * limit;
    
    const query = {};
    if (buyerAddress) {
      query.buyerAddress = buyerAddress.toLowerCase();
    }
    
    const purchases = await Purchase.find(query)
      .populate('projectId', 'projectName title status')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);
    
    const total = await Purchase.countDocuments(query);
    
    // Format for frontend table
    const purchasesTable = purchases.map(p => ({
      id: p._id.toString(),
      project: p.projectName || p.projectId?.projectName || p.projectId?.title || 'N/A',
      credits: p.creditsAmount.toLocaleString(),
      ethPaid: (p.totalPaid / 1e18).toFixed(4),  // Convert wei to ETH
      txHash: p.txHash ? `${p.txHash.slice(0,10)}...` : 'N/A',
      block: p.blockNumber || 'N/A', 
      date: new Date(p.createdAt).toLocaleDateString(),
      status: p.status
    }));
    
    res.json({
      success: true,
      count: purchases.length,
      total,
      data: purchasesTable
    });
  } catch (error) {
    console.error('Error fetching purchases:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching purchase history',
      error: error.message
    });
  }
};

/**
 * Get purchase stats
 * GET /api/projects/purchase-stats
 */
const getPurchaseStats = async (req, res) => {
  try {
    const { buyerAddress } = req.query;
    
    const match = buyerAddress ? { buyerAddress: buyerAddress.toLowerCase() } : {};
    
    const stats = await Purchase.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalPurchases: { $sum: 1 },
          totalCredits: { $sum: '$creditsAmount' },
          totalETH: { $sum: '$totalPaid' },
          avgCredits: { $avg: '$creditsAmount' }
        }
      }
    ]);
    
    res.json({
      success: true,
      stats: stats[0] || { totalPurchases: 0, totalCredits: 0, totalETH: 0, avgCredits: 0 }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  getPurchases,
  getPurchaseStats
};
