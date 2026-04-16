// Project Model for Panchayat Verification
// With 3-Stage Verification Workflow + BLOCKCHAIN FIELDS FIXED

/**
 * Project Status Enum
 * DRAFT - Initial state, only visible to NGO
 * INITIAL_SUBMITTED - Initial data submitted, pending Panchayat verification
 * INITIAL_APPROVED - Panchayat approved initial submission, NGO can submit final data
 * INITIAL_REJECTED - Panchayat rejected initial submission, NGO can resubmit
 * FINAL_SUBMITTED - Final data submitted, pending Panchayat verification
 * COMPLETED - Final verification complete, tokens minted, credits can be sold
 */
const PROJECT_STATUS = {
  DRAFT: 'DRAFT',
  INITIAL_SUBMITTED: 'INITIAL_SUBMITTED',
  INITIAL_APPROVED: 'INITIAL_APPROVED',
  INITIAL_REJECTED: 'INITIAL_REJECTED',
  FINAL_SUBMITTED: 'FINAL_SUBMITTED',
  COMPLETED: 'COMPLETED'
};

const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  ipfsHash: {
    type: String,
    trim: true
  },
  submittedBy: {
    type: String,
    required: true,
    trim: true
  },
  // Updated status with new enum values for 3-stage verification
  status: {
    type: String,
    enum: Object.values(PROJECT_STATUS),
    default: PROJECT_STATUS.DRAFT
  },
  // Current submission type tracking (INITIAL or FINAL)
  currentSubmissionType: {
    type: String,
    enum: ['INITIAL', 'FINAL', null],
    default: null
  },
  rejectionReason: {
    type: String,
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  // Additional fields for tree plantation tracking
  projectName: String,
  state: String,
  district: String,
  panchayat: String,
  projectType: String,
  startDate: Date,
  completionDate: Date,
  estimatedCredits: Number,
  walletAddress: String,
  speciesType: String,
  saplingsPlanted: Number,
  areaCovered: Number,
  latitude: Number,
  longitude: Number,
  fileName: String,
  fileType: String,
  fileSize: Number,
  ipfsUrl: String,
  carbonAmount: Number,
  verifiedBy: String,
  verifiedAt: Date,
  
  // 🔧 BLOCKCHAIN FIELDS - FIXED FOR MARKETPLACE
  blockchainProjectId: {
    type: Number,
    default: null,
    index: true
  },
  blockchain: {
    projectId: Number,
    txHash: String,
    blockNumber: Number,
    mintedAt: Date,
    nftTokenId: String,
    contractAddress: String
  }
});

// Compound indexes for efficient queries + MARKETPLACE
projectSchema.index({ walletAddress: 1, status: 1 });
projectSchema.index({ status: 1, createdAt: -1 });
projectSchema.index({ status: 1, blockchainProjectId: 1 });

// Static method to get status enum
projectSchema.statics.getStatusEnum = () => PROJECT_STATUS;

// Instance method to update project status
projectSchema.methods.updateStatus = async function(newStatus) {
  if (!Object.values(PROJECT_STATUS).includes(newStatus)) {
    throw new Error('Invalid status');
  }
  this.status = newStatus;
  await this.save();
  return this;
};

// Virtual for display status
projectSchema.virtual('displayStatus').get(function() {
  const statusMap = {
    'DRAFT': 'Draft',
    'INITIAL_SUBMITTED': 'Initial Submitted',
    'INITIAL_APPROVED': 'Initial Approved',
    'INITIAL_REJECTED': 'Initial Rejected',
    'FINAL_SUBMITTED': 'Final Submitted',
    'COMPLETED': 'Completed'
  };
  return statusMap[this.status] || this.status;
});

// Ensure virtuals are included in JSON
projectSchema.set('toJSON', { virtuals: true });
projectSchema.set('toObject', { virtuals: true });

const Project = mongoose.model('Project', projectSchema);

module.exports = Project;
module.exports.PROJECT_STATUS = PROJECT_STATUS;

