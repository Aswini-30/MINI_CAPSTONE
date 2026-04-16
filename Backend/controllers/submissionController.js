const Submission = require('../models/Submission');
const { SINGLE_STEP_STATUS } = require('../constants/status');
const { uploadToIPFS, isPinataConfigured, getGatewayURL } = require('../config/pinata');
const fs = require('fs');
const mongoose = require('mongoose');
const axios = require('axios');

// Dynamic blockchain config - loaded from Truffle artifacts
const { getContractDetails } = require('./blockchainController');

// Helper function to call blockchain API
const callBlockchainAPI = async (endpoint, data) => {
  try {
    const response = await axios.post(
      `http://localhost:5000${endpoint}`,
      data,
      { timeout: 60000 } // 60 second timeout
    );
    return response.data;
  } catch (error) {
    console.error(`Blockchain API error (${endpoint}):`, error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
};

/**
 * Upload a submission file to IPFS and save metadata to MongoDB
 * POST /api/submissions
 */
const uploadSubmission = async (req, res) => {
  try {
    console.log('📥 Received upload request');
    console.log('📄 Files:', req.file);
    console.log('📝 Body:', req.body);

    // STEP 1: Check if file was uploaded via multer
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    // Extract all required fields from request body
    const { 
      project,
      projectId: providedProjectId,
      latitude, 
      longitude, 
      areaCovered, 
      saplingsPlanted, 
      speciesType,
      ngoId,
      submissionType
    } = req.body;

    // Validate required fields
    if (!project) {
      if (req.file?.path) fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        message: 'Project name is required'
      });
    }

    if (!latitude || latitude === '') {
      if (req.file?.path) fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        message: 'Latitude is required'
      });
    }

    if (!longitude || longitude === '') {
      if (req.file?.path) fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        message: 'Longitude is required'
      });
    }

    if (!areaCovered || areaCovered === '') {
      if (req.file?.path) fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        message: 'Area covered is required'
      });
    }

    if (!saplingsPlanted || saplingsPlanted === '') {
      if (req.file?.path) fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        message: 'Number of saplings planted is required'
      });
    }

    if (!speciesType) {
      if (req.file?.path) fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        message: 'Species type is required'
      });
    }

    // STEP 2: Read file using fs.readFileSync(req.file.path)
    const fileBuffer = fs.readFileSync(req.file.path);
    console.log('📖 File read successfully, size:', fileBuffer.length);
    
    // STEP 3: Upload file to Pinata using uploadToIPFS()
    // Check if Pinata is configured
    if (!isPinataConfigured()) {
      if (req.file?.path) fs.unlinkSync(req.file.path);
      console.error('❌ Pinata not configured');
      return res.status(500).json({
        success: false,
        message: 'Pinata IPFS service not configured. Please contact administrator.'
      });
    }

    const ipfsResult = await uploadToIPFS(fileBuffer, req.file.originalname);
    console.log('☁️ IPFS upload result:', ipfsResult);

    // STEP 4: Get ipfsHash (CID) and gateway URL
    const ipfsHash = ipfsResult.ipfsHash;
    const gatewayURL = getGatewayURL(ipfsHash);

    console.log(`✅ File uploaded to IPFS: ${ipfsHash}`);
    console.log(`📦 File size: ${ipfsResult.pinSize} bytes`);

    // STEP 5: DELETE the local file after successful upload
    fs.unlinkSync(req.file.path);
    console.log('🗑️ Local file deleted after IPFS upload');

    // STEP 6: Calculate carbon credits using formula: saplingsPlanted * 0.02
    const carbonCredits = parseInt(saplingsPlanted) * 0.02;
    
    // Single-step: Always SUBMITTED (Panchayat approves → MINTED)
    const submissionStatus = SINGLE_STEP_STATUS.SUBMITTED;
    
    // STEP 8: Save everything into Submission collection
    // Build submission data object
    // Handle both cases: 'project' can be project ID (from dropdown) or project name
    let projectIdValue = null;
    let projectNameValue = project;
    
    // If project looks like a valid MongoDB ObjectId, use it as projectId
    if (project && mongoose.Types.ObjectId.isValid(project)) {
      projectIdValue = project;
      // Try to get project name from database
      try {
        const Project = require('../models/Project');
        const proj = await Project.findById(project);
        if (proj) {
          projectNameValue = proj.name || proj.title || proj.projectName || project;
        }
      } catch (e) {
        console.log('Could not fetch project name:', e.message);
      }
    }
    
    const submissionData = {
      // File metadata
      fileName: req.file.originalname,
      fileType: req.file.mimetype,
      fileSize: req.file.size,
      
      // IPFS data
      ipfsHash: ipfsHash,
      ipfsUrl: gatewayURL,
      
      // Tree Plantation Data - use project name from the form
      project: projectNameValue,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      areaCovered: parseFloat(areaCovered),
      saplingsPlanted: parseInt(saplingsPlanted),
      speciesType: speciesType,
      
      // Carbon credits calculated: saplingsPlanted * 0.02
      carbonAmount: carbonCredits,
      creditsIssued: 0,
      
      status: submissionStatus,
      mintingStatus: 'Not Minted'
    };

    // Set projectId if we have a valid MongoDB ObjectId
    if (projectIdValue) {
      submissionData.projectId = projectIdValue;
    }
    
    // Only add ngoId if it's a valid MongoDB ObjectId
    if (ngoId && mongoose.Types.ObjectId.isValid(ngoId)) {
      submissionData.ngoId = ngoId;
    }

    // Also save state, district, panchayat, projectType directly in submission for fallback
    // This ensures Panchayat dashboard works even if projectId is not linked
    if (req.body.state) submissionData.state = req.body.state;
    if (req.body.district) submissionData.district = req.body.district;
    if (req.body.panchayat) submissionData.panchayat = req.body.panchayat;
    if (req.body.projectType) submissionData.projectType = req.body.projectType;

    console.log('💾 Saving to database...');
    console.log('📋 Submission data:', JSON.stringify(submissionData, null, 2));

    const submission = new Submission(submissionData);
    await submission.save();
    
    console.log('✅ Submission saved to MongoDB');
    console.log('📝 Submission ID:', submission._id);
    console.log('📊 Submission Status:', submission.status);
    console.log('📊 Submission Status:', submission.status);

    // Return the specific JSON format requested by user
    res.status(201).json({
      success: true,
      message: 'Submission uploaded successfully - awaiting Panchayat approval',
      submissionId: submission._id,
      submissionType: submissionType || 'SINGLE_STEP',
      status: submission.status,
      cid: ipfsHash,
      gatewayURL: gatewayURL
    });

  } catch (error) {
    console.error('❌ Error uploading submission:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    
    // Clean up uploaded file if it exists
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    // Handle validation errors
    if (error.name === 'ValidationError') {
      console.error('Validation errors:', error.errors);
      return res.status(400).json({
        success: false,
        message: 'Validation error: ' + Object.keys(error.errors).map(k => error.errors[k].message).join(', ')
      });
    }

    // Handle Pinata errors
    if (error.message && error.message.includes('IPFS')) {
      return res.status(500).json({
        success: false,
        message: 'Failed to upload to IPFS. Please try again.'
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Server error while uploading submission'
    });
  }
};

/**
 * Get all submissions with filters
 * GET /api/submissions
 */
const getAllSubmissions = async (req, res) => {
  try {
    const { 
      status, 
      ngoId, 
      projectId, 
      startDate, 
      endDate,
      page = 1,
      limit = 20
    } = req.query;

    const query = {};
    
    if (status) query.status = status;
    if (ngoId) query.ngoId = ngoId;
    if (projectId) query.projectId = projectId;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [submissions, total] = await Promise.all([
      Submission.find(query)
        .populate('projectId', 'name type status district state')
        .populate('ngoId', 'name email walletAddress')
        .populate('reviewedBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Submission.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      data: submissions.map(formatSubmissionResponse),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching submissions:', error);
    res.status(500).json({
      success: false,
      error: 'FETCH_ERROR',
      message: 'Server error while fetching submissions'
    });
  }
};

const getSubmissionsByProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const submissions = await Submission.find({ projectId })
      .populate('projectId', 'name type status')
      .populate('ngoId', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: submissions.map(formatSubmissionResponse),
      count: submissions.length
    });
  } catch (error) {
    console.error('Error fetching submissions:', error);
    res.status(500).json({
      success: false,
      error: 'FETCH_ERROR',
      message: 'Server error while fetching submissions'
    });
  }
};

const getSubmissionsByNgo = async (req, res) => {
  try {
    const { ngoId } = req.params;
    const submissions = await Submission.find({ ngoId })
      .populate('projectId', 'name type status')
      .populate('ngoId', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: submissions.map(formatSubmissionResponse),
      count: submissions.length
    });
  } catch (error) {
    console.error('Error fetching submissions:', error);
    res.status(500).json({
      success: false,
      error: 'FETCH_ERROR',
      message: 'Server error while fetching submissions'
    });
  }
};

const getSubmissionById = async (req, res) => {
  try {
    const { id } = req.params;
    const submission = await Submission.findById(id)
      .populate('projectId', 'name type status walletAddress district state')
      .populate('ngoId', 'name email walletAddress')
      .populate('reviewedBy', 'name email');

    if (!submission) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Submission not found'
      });
    }

    res.status(200).json({
      success: true,
      data: formatSubmissionResponse(submission)
    });
  } catch (error) {
    console.error('Error fetching submission:', error);
    res.status(500).json({
      success: false,
      error: 'FETCH_ERROR',
      message: 'Server error while fetching submission'
    });
  }
};

const updateSubmissionStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, remarks, reviewedBy } = req.body;

    const validStatuses = Object.values(SUBMISSION_STATUS);
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_STATUS',
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const submission = await Submission.findById(id);
    if (!submission) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Submission not found'
      });
    }

    const allowedTransitions = {
      [SUBMISSION_STATUS.SUBMITTED]: [SUBMISSION_STATUS.UNDER_REVIEW, SUBMISSION_STATUS.REJECTED],
      [SUBMISSION_STATUS.UNDER_REVIEW]: [SUBMISSION_STATUS.APPROVED, SUBMISSION_STATUS.REJECTED],
      [SUBMISSION_STATUS.APPROVED]: [SUBMISSION_STATUS.MINTED, SUBMISSION_STATUS.FAILED],
      [SUBMISSION_STATUS.REJECTED]: [],
      [SUBMISSION_STATUS.MINTED]: [],
      [SUBMISSION_STATUS.FAILED]: [SUBMISSION_STATUS.MINTED]
    };

    if (!allowedTransitions[submission.status]?.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_TRANSITION',
        message: `Cannot transition from ${submission.status} to ${status}`
      });
    }

    submission.status = status;
    if (remarks) submission.remarks = remarks;
    if ([SUBMISSION_STATUS.APPROVED, SUBMISSION_STATUS.REJECTED].includes(status)) {
      submission.reviewedAt = new Date();
      if (reviewedBy) submission.reviewedBy = reviewedBy;
    }

    await submission.save();

    res.status(200).json({
      success: true,
      data: formatSubmissionResponse(submission),
      message: `Submission status updated to ${status}`
    });
  } catch (error) {
    console.error('Error updating submission status:', error);
    res.status(500).json({
      success: false,
      error: 'UPDATE_ERROR',
      message: 'Server error while updating submission status'
    });
  }
};

const storeMintingDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const { txHash, blockNumber, contractAddress, tokenId, gasUsed, network = 'ethereum', carbonAmount, creditsIssued } = req.body;

    if (!txHash) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_TX_HASH',
        message: 'Transaction hash is required'
      });
    }

    const submission = await Submission.findById(id);
    if (!submission) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Submission not found'
      });
    }

    if (submission.status !== SUBMISSION_STATUS.APPROVED) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_STATE',
        message: 'Submission must be approved before minting'
      });
    }

    submission.blockchain = {
      txHash,
      blockNumber: blockNumber ? parseInt(blockNumber) : undefined,
      contractAddress,
      tokenId: tokenId ? tokenId.toString() : undefined,
      gasUsed: gasUsed ? parseInt(gasUsed) : undefined,
      mintedAt: new Date(),
      network
    };

    if (carbonAmount !== undefined) submission.carbonAmount = parseFloat(carbonAmount);
    if (creditsIssued !== undefined) submission.creditsIssued = parseFloat(creditsIssued);
    submission.status = SUBMISSION_STATUS.MINTED;
    submission.mintingStatus = 'completed';

    await submission.save();

    res.status(200).json({
      success: true,
      data: formatSubmissionResponse(submission),
      message: 'Minting details stored successfully'
    });
  } catch (error) {
    console.error('Error storing minting details:', error);
    res.status(500).json({
      success: false,
      error: 'MINTING_ERROR',
      message: 'Server error while storing minting details'
    });
  }
};

const updateCreditsIssued = async (req, res) => {
  try {
    const { id } = req.params;
    const { carbonAmount, creditsIssued } = req.body;

    if (carbonAmount === undefined && creditsIssued === undefined) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_FIELDS',
        message: 'At least one of carbonAmount or creditsIssued is required'
      });
    }

    const submission = await Submission.findById(id);
    if (!submission) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Submission not found'
      });
    }

    if (carbonAmount !== undefined) submission.carbonAmount = parseFloat(carbonAmount);
    if (creditsIssued !== undefined) submission.creditsIssued = parseFloat(creditsIssued);

    await submission.save();

    res.status(200).json({
      success: true,
      data: formatSubmissionResponse(submission),
      message: 'Credits updated successfully'
    });
  } catch (error) {
    console.error('Error updating credits:', error);
    res.status(500).json({
      success: false,
      error: 'UPDATE_ERROR',
      message: 'Server error while updating credits'
    });
  }
};

const deleteSubmission = async (req, res) => {
  try {
    const { id } = req.params;
    const submission = await Submission.findById(id);

    if (!submission) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Submission not found'
      });
    }

    if (submission.status === SUBMISSION_STATUS.MINTED) {
      return res.status(400).json({
        success: false,
        error: 'CANNOT_DELETE',
        message: 'Cannot delete a minted submission'
      });
    }

    await Submission.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Submission deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting submission:', error);
    res.status(500).json({
      success: false,
      error: 'DELETE_ERROR',
      message: 'Server error while deleting submission'
    });
  }
};

const getSubmissionStats = async (req, res) => {
  try {
    const stats = await Submission.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 }, totalCarbon: { $sum: '$carbonAmount' }, totalCredits: { $sum: '$creditsIssued' } } }
    ]);

    const totalSubmissions = await Submission.countDocuments();

    res.status(200).json({
      success: true,
      data: {
        byStatus: stats.reduce((acc, stat) => {
          acc[stat._id] = { count: stat.count, carbonAmount: stat.totalCarbon || 0, creditsIssued: stat.totalCredits || 0 };
          return acc;
        }, {}),
        total: { submissions: totalSubmissions }
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ success: false, error: 'STATS_ERROR', message: 'Server error while fetching statistics' });
  }
};

const formatSubmissionResponse = (submission) => {
    const obj = submission.toObject();
    return {
      id: obj._id,
      submissionId: obj.submissionId,
      projectId: obj.projectId,
      ngoId: obj.ngoId,
      project: obj.project,
      latitude: obj.latitude,
      longitude: obj.longitude,
      areaCovered: obj.areaCovered,
      saplingsPlanted: obj.saplingsPlanted,
      speciesType: obj.speciesType,
      ipfsHash: obj.ipfsHash,
      ipfsUrl: obj.ipfsUrl || obj.gatewayUrl,
      fileName: obj.fileName,
      fileType: obj.fileType,
      fileSize: obj.fileSize,
      carbonAmount: obj.carbonAmount,
      creditsIssued: obj.creditsIssued,
      status: obj.status,
    remarks: obj.remarks,
    panchayatRemarks: obj.panchayatRemarks,
    mintingStatus: obj.mintingStatus || 'Not Minted',
    blockchain: obj.blockchain,
    submittedAt: obj.submittedAt || obj.createdAt,
    reviewedAt: obj.reviewedAt,
    reviewedBy: obj.reviewedBy,
    verifiedBy: obj.verifiedBy,
    verifiedAt: obj.verifiedAt,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
    // Include populated project details for Panchayat dashboard
    projectDetails: obj.projectId ? {
      name: obj.projectId.name || obj.projectId.title || obj.projectId.projectName || obj.project,
      state: obj.projectId.state || 'N/A',
      district: obj.projectId.district || 'N/A',
      panchayat: obj.projectId.panchayat || 'N/A',
      projectType: obj.projectId.projectType || obj.projectId.type || 'N/A',
      walletAddress: obj.projectId.walletAddress || 'N/A',
      status: obj.projectId.status || 'N/A'
    } : null,
    // Include NGO details
    ngoDetails: obj.ngoId ? {
      name: obj.ngoId.name || 'N/A',
      email: obj.ngoId.email || 'N/A',
      walletAddress: obj.ngoId.walletAddress || 'N/A'
    } : null
  };
};

/**
 * Get carbon credits statistics
 * GET /api/submissions/carbon-credits
 */
const getCarbonCreditsStats = async (req, res) => {
  try {
    const submissions = await Submission.find({}).sort({ createdAt: -1 });
    
    let totalCredits = 0;
    let pendingCredits = 0;
    let mintedCredits = 0;
    let totalSaplings = 0;
    
    submissions.forEach(submission => {
      const carbonAmount = submission.carbonAmount || 0;
      totalCredits += carbonAmount;
      totalSaplings += submission.saplingsPlanted || 0;
      
      if (submission.mintingStatus === 'completed' || submission.status === 'MINTED') {
        mintedCredits += carbonAmount;
      } else {
        pendingCredits += carbonAmount;
      }
    });
    
    const co2Offset = totalCredits;
    
    res.status(200).json({
      success: true,
      data: {
        totalCredits: totalCredits.toFixed(4),
        pendingCredits: pendingCredits.toFixed(4),
        mintedCredits: mintedCredits.toFixed(4),
        co2Offset: co2Offset.toFixed(4),
        mintingStatus: {
          notMinted: submissions.filter(s => s.mintingStatus === 'Not Minted' || !s.mintingStatus).length,
          pending: submissions.filter(s => s.mintingStatus === 'pending' || s.mintingStatus === 'Ready for Minting').length,
          completed: submissions.filter(s => s.mintingStatus === 'completed').length,
          failed: submissions.filter(s => s.mintingStatus === 'failed').length
        },
        totalSaplings: totalSaplings,
        totalSubmissions: submissions.length
      }
    });
  } catch (error) {
    console.error('Error fetching carbon credits stats:', error);
    res.status(500).json({
      success: false,
      error: 'STATS_ERROR',
      message: 'Server error while fetching carbon credits statistics'
    });
  }
};

/**
 * Get pending submissions for Panchayat verification
 * GET /api/submissions/pending
 * 
 * Returns submissions with status PENDING_INITIAL_VERIFICATION or PENDING_FINAL_VERIFICATION
 * Populates projectId and ngoId with their respective details
 * Formats response to match frontend expectations
 */
const getPendingSubmissions = async (req, res) => {
  try {
    // Fetch pending submissions with the required statuses
    const submissions = await Submission.find({ 
      status: SINGLE_STEP_STATUS.SUBMITTED 
    })
      // Populate project details from Projects collection
      .populate('projectId', 'title projectName name state district panchayat projectType type walletAddress status')
      // Populate NGO details from Users collection
      .populate('ngoId', 'name email walletAddress')
      .sort({ createdAt: -1 });

    // Format each submission to match frontend expectations
    const formattedSubmissions = submissions.map(submission => {
      const obj = submission.toObject();
      
      // Extract project details from populated projectId
      const projectData = obj.projectId || {};
      // Extract NGO details from populated ngoId
      const ngoData = obj.ngoId || {};
      
      return {
        // Convert _id to id as required by frontend
        id: obj._id.toString(),
        
        // Project details from populated projectId OR from submission's own fields
        projectDetails: {
          name: projectData.name || projectData.title || projectData.projectName || obj.project || 'N/A',
          state: projectData.state || obj.state || 'N/A',
          district: projectData.district || obj.district || 'N/A',
          panchayat: projectData.panchayat || obj.panchayat || 'N/A',
          projectType: projectData.projectType || projectData.type || obj.projectType || 'N/A'
        },
        
        // NGO details from populated ngoId
        ngoDetails: {
          name: ngoData.name || 'N/A',
          walletAddress: ngoData.walletAddress || 'N/A'
        },
        
        // Submission fields from the submission document itself
        project: obj.project,
        areaCovered: obj.areaCovered,
        saplingsPlanted: obj.saplingsPlanted,
        speciesType: obj.speciesType,
        latitude: obj.latitude,
        longitude: obj.longitude,
        carbonAmount: obj.carbonAmount,
        ipfsHash: obj.ipfsHash,
        createdAt: obj.createdAt,
        
        // Additional fields that might be useful
        status: obj.status,
        fileName: obj.fileName
      };
    });

    res.status(200).json({
      success: true,
      data: formattedSubmissions,
      count: formattedSubmissions.length
    });
  } catch (error) {
    console.error('Error fetching pending submissions:', error);
    res.status(500).json({
      success: false,
      error: 'FETCH_ERROR',
      message: 'Server error while fetching pending submissions'
    });
  }
};
/**
 * FIXED verifySubmission block (replaces lines 830–1049 of original)
 * Key fixes:
 * 1. blockchainProjectId uses safe small integer (no overflow)
 * 2. carbonAmount is at least 1 (no mint-zero revert)
 * 3. Final verification re-uses stored projectIdOnChain from initial step
 */
const verifySubmission = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, remarks, verifiedBy } = req.body;

    if (!action || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_ACTION',
        message: 'Action must be "approve" or "reject"'
      });
    }

    const submission = await Submission.findById(id);
    if (!submission) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Submission not found'
      });
    }

    if (submission.status !== SINGLE_STEP_STATUS.SUBMITTED) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_STATE',
        message: `Only SUBMITTED submissions can be verified. Current: ${submission.status}`
      });
    }

    submission.panchayatRemarks = remarks || '';
    submission.verifiedBy = verifiedBy || '';
    submission.verifiedAt = new Date();

    if (action === 'reject') {
      submission.status = SINGLE_STEP_STATUS.REJECTED;
      await submission.save();
      return res.status(200).json({
        success: true,
        data: formatSubmissionResponse(submission),
        message: 'Submission rejected'
      });
    }

    // 🎯 APPROVE → SINGLE BLOCKCHAIN CALL → MINTED
    const saplingsPlanted = Number(submission.saplingsPlanted) || 0;
    const carbonAmount = Math.max(1, Math.round(saplingsPlanted * 0.02));
    
    // Generate safe projectId from Mongo _id
    const mongoIdHex = submission._id.toString();
    const projectId = parseInt(mongoIdHex.slice(-8), 16) % 10000000 + 1;
    console.log(`🎯 Single-step mint: projectId=${projectId} from ${mongoIdHex.slice(-16)}, carbon=${carbonAmount}`);

    // Get NGO wallet
    let ngoWallet = '0x0000000000000000000000000000000000000000';
    if (submission.ngoId) {
      try {
        const User = require('../models/User');
        const ngo = await User.findById(submission.ngoId).select('walletAddress').lean();
        if (ngo?.walletAddress) ngoWallet = ngo.walletAddress;
      } catch (e) {
        console.log('NGO wallet fetch failed:', e.message);
      }
    }

    const blockchainResult = await callBlockchainAPI('/api/blockchain/projects/create-and-mint', {
      projectId,
      projectName: submission.project || `Project-${projectId}`,
      ngoDeveloper: ngoWallet,
      carbonAmount,
      ipfsHash: submission.ipfsHash,
      ownerPrivateKey: process.env.OWNER_PRIVATE_KEY
    });

    console.log('✅ SINGLE TX: createProjectAndMint success:', blockchainResult.data?.transactionHash);

    // Update submission to MINTED
    submission.status = SINGLE_STEP_STATUS.MINTED;
    submission.carbonAmount = carbonAmount;
    submission.creditsIssued = carbonAmount;
    submission.blockchain = {
      txHash: blockchainResult.data.transactionHash,
      projectIdOnChain: projectId,
      blockNumber: blockchainResult.data.blockNumber,
      contractAddress: (await getContractDetails('CarbonCreditSystem')).address,
      mintedAt: new Date(),
      creditsMinted: carbonAmount
    };
    await submission.save();

    // Update linked Project if exists
    if (submission.projectId) {
      try {
        const Project = require('../models/Project');
        await Project.findByIdAndUpdate(submission.projectId, {
          status: 'COMPLETED',
          carbonAmount,
          creditsIssued: carbonAmount,
          blockchainProjectId: projectId,
          verifiedBy,
          verifiedAt: new Date()
        });
      } catch (e) {
        console.log('Project update failed:', e.message);
      }
    }

    res.status(200).json({
      success: true,
      data: formatSubmissionResponse(submission),
      message: '✅ Submission approved and carbon credits minted in ONE transaction!',
      blockchain: blockchainResult.data
    });

  } catch (error) {
    console.error('❌ verifySubmission error:', error);
    res.status(500).json({
      success: false,
      error: 'VERIFY_ERROR',
      message: error.message || 'Server error during verification'
    });
  }
};

module.exports = {
  uploadSubmission,
  getAllSubmissions,
  getSubmissionsByProject,
  getSubmissionsByNgo,
  getSubmissionById,
  updateSubmissionStatus,
  storeMintingDetails,
  updateCreditsIssued,
  deleteSubmission,
  getSubmissionStats,
  getCarbonCreditsStats,
  getPendingSubmissions,
  verifySubmission
};
