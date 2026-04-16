const mongoose = require('mongoose');

const purchaseSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
    index: true
  },
  projectName: { type: String, trim: true },
  buyerAddress: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    index: true
  },
  creditsAmount: { type: Number, required: true, min: 1 },
  pricePerCredit: { type: Number, default: 0 }, // in Wei
  totalPaid: { type: Number, default: 0 },        // in Wei
  txHash: { type: String, trim: true },
  blockNumber: { type: Number },
  gasUsed: { type: Number },
  status: {
    type: String,
    enum: ['PENDING', 'COMPLETED', 'FAILED'],
    default: 'COMPLETED'
  }
}, {
  timestamps: true
});

purchaseSchema.index({ buyerAddress: 1, createdAt: -1 });

module.exports = mongoose.model('Purchase', purchaseSchema);
