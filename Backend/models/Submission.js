const mongoose = require('mongoose');

const SUBMISSION_STATUS = {
  SUBMITTED: 'SUBMITTED',
  APPROVED: 'APPROVED',
  MINTED: 'MINTED',
  REJECTED: 'REJECTED',
  FAILED: 'FAILED'
};

const blockchainSchema = new mongoose.Schema({
  txHash: { type: String, trim: true },
  blockNumber: { type: Number },
  contractAddress: { type: String, trim: true },
  tokenId: { type: String, trim: true },
  gasUsed: { type: Number },
  mintedAt: { type: Date },
  network: { type: String, default: 'ethereum', enum: ['ethereum', 'polygon', 'bsc'] },
  projectIdOnChain: { type: Number },
  initialVerificationTx: { type: String, trim: true },
  creditsMinted: { type: Number }
}, { _id: false });

const submissionSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', index: true },
  ngoId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },

  // ✅ FIX: walletAddress + submittedBy stored directly for display
  walletAddress: { type: String, trim: true, lowercase: true },
  submittedBy: { type: String, trim: true, lowercase: true },

  // File metadata
  fileName: { type: String, required: true, trim: true, maxlength: 255 },
  fileType: { type: String, required: true, trim: true },
  fileSize: { type: Number, required: true, min: 1 },
  filePath: { type: String, trim: true },

  // IPFS
  ipfsHash: { type: String, required: true, trim: true, index: true },
  ipfsUrl: { type: String, trim: true },

  // Carbon data
  carbonAmount: { type: Number, default: 0, min: 0 },
  creditsIssued: { type: Number, default: 0, min: 0 },

  // Status
  status: {
    type: String,
    enum: Object.values(SUBMISSION_STATUS),
    default: SUBMISSION_STATUS.SUBMITTED,
    index: true
  },

  remarks: { type: String, trim: true, maxlength: 1000 },
  panchayatRemarks: { type: String, trim: true, maxlength: 1000 },

  blockchain: { type: blockchainSchema },

  // Timestamps
  submittedAt: { type: Date, default: Date.now },
  reviewedAt: { type: Date },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // Legacy
  submissionId: { type: String, unique: true, sparse: true },
  submittedDate: { type: Date },
  mintingStatus: {
    type: String,
    enum: ['Not Minted', 'Ready for Minting', 'pending', 'completed', 'failed'],
    default: 'Not Minted'
  },

  verifiedBy: { type: String, trim: true },
  verifiedAt: { type: Date },

  // Plantation fields (stored in DB, only hash goes on-chain)
  project: { type: String, trim: true, required: true, maxlength: 255 },
  state: { type: String, trim: true },
  district: { type: String, trim: true },
  panchayat: { type: String, trim: true },
  projectType: { type: String, trim: true },
  latitude: { type: Number, required: true, min: -90, max: 90 },
  longitude: { type: Number, required: true, min: -180, max: 180 },
  areaCovered: { type: Number, required: true, min: 0 },
  saplingsPlanted: { type: Number, required: true, min: 0 },
  speciesType: { type: String, trim: true, required: true, maxlength: 100 }
}, { timestamps: true });

submissionSchema.index({ projectId: 1, status: 1 });
submissionSchema.index({ ngoId: 1, createdAt: -1 });
submissionSchema.index({ walletAddress: 1, createdAt: -1 });
submissionSchema.index({ status: 1, createdAt: -1 });
submissionSchema.index({ submissionType: 1, status: 1 });

submissionSchema.virtual('gatewayUrl').get(function () {
  return this.ipfsHash ? `https://gateway.pinata.cloud/ipfs/${this.ipfsHash}` : null;
});

submissionSchema.pre('save', async function (next) {
  if (!this.submissionId) {
    const count = await mongoose.model('Submission').countDocuments();
    this.submissionId = `SUB-${Date.now()}-${count + 1}`;
  }
  if (!this.submittedDate) this.submittedDate = this.createdAt;
  if (this.ipfsHash && !this.ipfsUrl) {
    this.ipfsUrl = `https://gateway.pinata.cloud/ipfs/${this.ipfsHash}`;
  }
  next();
});

submissionSchema.set('toJSON', { virtuals: true });
submissionSchema.set('toObject', { virtuals: true });
submissionSchema.statics.getStatusEnum = () => SUBMISSION_STATUS;

submissionSchema.methods.updateStatus = async function (newStatus, reviewedBy = null) {
  if (!Object.values(SUBMISSION_STATUS).includes(newStatus)) throw new Error('Invalid status');
  this.status = newStatus;
  if ([SUBMISSION_STATUS.APPROVED, SUBMISSION_STATUS.REJECTED].includes(newStatus)) {
    this.reviewedAt = new Date();
    if (reviewedBy) this.reviewedBy = reviewedBy;
  }
  await this.save();
  return this;
};

submissionSchema.methods.storeMintingDetails = async function (blockchainData) {
  this.blockchain = {
    txHash: blockchainData.txHash,
    blockNumber: blockchainData.blockNumber,
    contractAddress: blockchainData.contractAddress,
    tokenId: blockchainData.tokenId,
    gasUsed: blockchainData.gasUsed,
    mintedAt: new Date(),
    network: blockchainData.network || 'ethereum'
  };
  this.status = SUBMISSION_STATUS.MINTED;
  this.mintingStatus = 'completed';
  await this.save();
  return this;
};

const Submission = mongoose.model('Submission', submissionSchema);
module.exports = Submission;
module.exports.SUBMISSION_STATUS = SUBMISSION_STATUS;
