const Project = require('../models/Project');
const { PROJECT_STATUS } = require('../models/Project');
const Submission = require('../models/Submission');
const { SUBMISSION_STATUS, SUBMISSION_TYPE } = require('../models/Submission');
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
 * Get pending submissions for Panchayat verification
 * Now returns SUBMISSIONS with status PENDING_INITIAL_VERIFICATION or PENDING_FINAL_VERIFICATION
 * GET /api/projects/pending
 */
const getPendingProjects = async (req, res) => {
  try {
    // Get pending submissions (not projects!)
    const pendingSubmissions = await Submission.find({
      status: { $in: [SUBMISSION_STATUS.PENDING_INITIAL_VERIFICATION, SUBMISSION_STATUS.PENDING_FINAL_VERIFICATION] }
    })
    .populate('projectId', 'name title projectName state district panchayat projectType type walletAddress status')
    .populate('ngoId', 'name email walletAddress')
    .sort({ createdAt: -1 });

    // Format submissions to match frontend expectations
    const formattedSubmissions = pendingSubmissions.map(submission => {
      const obj = submission.toObject();
      const projectData = obj.projectId || {};
      const ngoData = obj.ngoId || {};
      
      return {
        id: obj._id.toString(),
        projectDetails: {
          name: projectData.name || projectData.title || projectData.projectName || obj.project || 'N/A',
          state: projectData.state || obj.state || 'N/A',
          district: projectData.district || obj.district || 'N/A',
          panchayat: projectData.panchayat || obj.panchayat || 'N/A',
          projectType: projectData.projectType || projectData.type || obj.projectType || 'N/A'
        },
        ngoDetails: {
          name: ngoData.name || 'N/A',
          // FIX: fallback chain for wallet address
          walletAddress: ngoData.walletAddress || obj.walletAddress || obj.submittedBy || 'N/A'
        },
        submittedBy: ngoData.walletAddress || obj.walletAddress || obj.submittedBy || 'N/A',
        project: obj.project,
        areaCovered: obj.areaCovered,
        saplingsPlanted: obj.saplingsPlanted,
        speciesType: obj.speciesType,
        latitude: obj.latitude,
        longitude: obj.longitude,
        carbonAmount: obj.carbonAmount,
        ipfsHash: obj.ipfsHash,
        createdAt: obj.createdAt,
        submissionType: obj.submissionType,
        status: obj.status,
        fileName: obj.fileName
      };
    });

    // Group by submission type for Panchayat dashboard
    const initialSubmissions = formattedSubmissions.filter(s => s.status === SUBMISSION_STATUS.PENDING_INITIAL_VERIFICATION);
    const finalSubmissions = formattedSubmissions.filter(s => s.status === SUBMISSION_STATUS.PENDING_FINAL_VERIFICATION);
    
    res.status(200).json({
      success: true,
      count: formattedSubmissions.length,
      initialCount: initialSubmissions.length,
      finalCount: finalSubmissions.length,
      data: formattedSubmissions,
      initialSubmissions: initialSubmissions,
      finalSubmissions: finalSubmissions
    });
  } catch (error) {
    console.error('Error fetching pending submissions:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching pending submissions',
      error: error.message
    });
  }
};

/**
 * Get count of pending submissions for Panchayat
 * GET /api/projects/pending/count
 */
const getPendingCount = async (req, res) => {
  try {
    const count = await Submission.countDocuments({
      status: { $in: [SUBMISSION_STATUS.PENDING_INITIAL_VERIFICATION, SUBMISSION_STATUS.PENDING_FINAL_VERIFICATION] }
    });
    
    res.status(200).json({
      success: true,
      count: count
    });
  } catch (error) {
    console.error('Error counting pending submissions:', error);
    res.status(500).json({
      success: false,
      message: 'Error counting pending submissions',
      error: error.message
    });
  }
};

/**
 * Get all approved projects (projects with INITIAL_APPROVED status)
 * GET /api/projects/approved
 */
const getApprovedProjects = async (req, res) => {
  try {
    const projects = await Project.find({ 
      status: { $in: [PROJECT_STATUS.INITIAL_APPROVED, PROJECT_STATUS.COMPLETED] }
    }).sort({ verifiedAt: -1 });
    
    res.status(200).json({
      success: true,
      count: projects.length,
      data: projects
    });
  } catch (error) {
    console.error('Error fetching approved projects:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching approved projects',
      error: error.message
    });
  }
};

/**
 * Get verified marketplace projects - VERIFIED or COMPLETED with blockchainProjectId
 * GET /api/projects/verified - For Industry Marketplace
 */
const getVerifiedProjects = async (req, res) => {
  try {
    console.log('📥 Loading verified marketplace projects...');
    
    // DEBUG: Check all verified status projects first
    const allVerifiedStatus = await Project.find({ 
      status: { $in: [PROJECT_STATUS.INITIAL_APPROVED, PROJECT_STATUS.COMPLETED] }
    }).countDocuments();
    console.log(`DEBUG: Total INITIAL_APPROVED/COMPLETED projects: ${allVerifiedStatus}`);
    
    // TEMP FIX: Show ALL verified status projects for marketplace (no blockchainProjectId required)
    // Remove filter - user's 2 projects show immediately
    const projects = await Project.find({ 
      status: { $in: [PROJECT_STATUS.INITIAL_APPROVED, PROJECT_STATUS.COMPLETED] }
    })
    .select('title name projectName state district projectType saplingsPlanted carbonAmount creditsIssued estimatedCredits creditsAvailable status blockchainProjectId verifiedAt')
    .sort({ verifiedAt: -1 });
    
    console.log(`DEBUG: Filtered (with blockchainProjectId): ${projects.length}`);
    console.log('Sample project:', projects[0]);

    // Sum credits already purchased for each project
    const Purchase = require('../models/Purchase');
    const projectIds = projects.map(p => p._id);
    const purchaseSums = await Purchase.aggregate([
      { $match: { projectId: { $in: projectIds }, status: 'COMPLETED' } },
      { $group: { _id: '$projectId', totalPurchased: { $sum: '$creditsAmount' } } }
    ]);
    const purchasedMap = {};
    purchaseSums.forEach(r => { purchasedMap[r._id.toString()] = r.totalPurchased; });

    // Map fields for frontend compatibility (Industry dashboard expects specific fields)
    const marketplaceProjects = projects.map(project => {
      const obj = project.toObject();
      // Always derive remaining from original total minus sum of all purchases
      const originalTotal = obj.creditsIssued || obj.carbonAmount || obj.estimatedCredits || 0;
      const alreadyPurchased = purchasedMap[obj._id.toString()] || 0;
      const remainingCredits = Math.max(0, originalTotal - alreadyPurchased);
      return {
        _id: obj._id.toString(),
        projectName: obj.name || obj.projectName || obj.title || 'Unnamed Project',
        title: obj.title,
        state: obj.state || 'N/A',
        district: obj.district || 'N/A',
        projectType: obj.projectType || 'Carbon Project',
        saplingsPlanted: obj.saplingsPlanted || 0,
        creditsAvailable: remainingCredits,
        carbonCredits: originalTotal,
        status: obj.status,
        projectIdOnChain: obj.blockchainProjectId,
        verifiedAt: obj.verifiedAt,
        description: `Verified ${obj.projectType} project in ${obj.state}. ${obj.saplingsPlanted || 0} saplings planted.`
      };
    });

    // Remove projects with no credits remaining (fully purchased)
    const availableForSale = marketplaceProjects.filter(p => p.creditsAvailable > 0);
    console.log(`✅ Verified projects loaded: ${availableForSale.length} (${marketplaceProjects.length - availableForSale.length} fully sold out)`);
    marketplaceProjects.length = 0;
    availableForSale.forEach(p => marketplaceProjects.push(p));

    res.status(200).json({
      success: true,
      count: marketplaceProjects.length,
      data: marketplaceProjects
    });
  } catch (error) {
    console.error('❌ Error fetching verified projects:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching verified marketplace projects',
      error: error.message
    });
  }
};

/**
 * Get all rejected projects
 * GET /api/projects/rejected
 */
const getRejectedProjects = async (req, res) => {
  try {
    const projects = await Project.find({ 
      status: { $in: [PROJECT_STATUS.INITIAL_REJECTED] }
    }).sort({ verifiedAt: -1 });
    
    res.status(200).json({
      success: true,
      count: projects.length,
      data: projects
    });
  } catch (error) {
    console.error('Error fetching rejected projects:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching rejected projects',
      error: error.message
    });
  }
};

/**
 * Approve initial submission
 * PUT /api/projects/:id/approve-initial
 * 
 * This will:
 * 1. Call blockchain API to create project and verify initially
 * 2. Store transaction hash in MongoDB
 */
const approveInitialSubmission = async (req, res) => {
  try {
    const { id } = req.params;
    const { verifiedBy, skipBlockchain } = req.body;
    
    // Find the submission
    const submission = await Submission.findById(id);
    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found'
      });
    }

    // Allow approval from PENDING_INITIAL_VERIFICATION status
    if (submission.status !== SUBMISSION_STATUS.PENDING_INITIAL_VERIFICATION) {
      return res.status(400).json({
        success: false,
        message: `Submission is not in PENDING_INITIAL_VERIFICATION status. Current status: ${submission.status}`
      });
    }

    // Blockchain transaction results
    let blockchainResult = null;
    let blockchainError = null;

    // Try to call blockchain if not skipped
    if (!skipBlockchain) {
      try {
        console.log('🔗 Calling blockchain API to create project and verify initially...');
        
        // Use submission _id as projectId for blockchain (convert to number)
        const blockchainProjectId = parseInt(submission._id.toString().slice(-8), 16) || Date.now();
        
        // Get NGO wallet address
        let ngoWallet = '0x0000000000000000000000000000000000000000';
        if (submission.ngoId) {
          const User = require('../models/User');
          const ngo = await User.findById(submission.ngoId);
          if (ngo && ngo.walletAddress) {
            ngoWallet = ngo.walletAddress;
          }
        }
        
        // First, create project on blockchain
        const createResult = await callBlockchainAPI('/api/blockchain/create-project', {
          projectId: blockchainProjectId,
          projectName: submission.project || `Project-${blockchainProjectId}`,
          ngoDeveloper: ngoWallet,
          carbonAmount: 0, // Will be set on final verification
          ipfsHash: submission.ipfsHash || '',
          ownerPrivateKey: process.env.OWNER_PRIVATE_KEY  // FIX: read from env
        });
        
        console.log('✅ Project created on blockchain:', createResult);
        
        // Then verify initially
        const verifyResult = await callBlockchainAPI('/api/blockchain/verify-initial', {
          projectId: blockchainProjectId,
          ownerPrivateKey: process.env.OWNER_PRIVATE_KEY  // FIX: read from env
        });
        
        console.log('✅ Project verified on blockchain:', verifyResult);
        
        blockchainResult = {
          projectId: blockchainProjectId,
          createTxHash: createResult.data?.transactionHash,
          verifyTxHash: verifyResult.data?.transactionHash,
          createdAt: new Date(),
          verifiedAt: new Date()
        };
        
      } catch (blockchainErr) {
        console.error('❌ Blockchain error:', blockchainErr.message);
        blockchainError = blockchainErr.message;
        // Continue with DB update even if blockchain fails
      }
    }

    // Update submission status
    submission.status = SUBMISSION_STATUS.APPROVED;
    submission.verifiedBy = verifiedBy || req.body.walletAddress;
    submission.verifiedAt = new Date();
    
    // Store blockchain details if available
    if (blockchainResult) {
      submission.blockchain = {
        ...submission.blockchain,
        projectIdOnChain: blockchainResult.projectId,
        initialVerificationTx: blockchainResult.verifyTxHash,
        verifiedAt: blockchainResult.verifiedAt
      };
    }
    
    await submission.save();

    // Update project status to INITIAL_APPROVED
    if (submission.projectId) {
      await Project.findByIdAndUpdate(submission.projectId, {
        status: PROJECT_STATUS.INITIAL_APPROVED,
        verifiedBy: verifiedBy || req.body.walletAddress,
        verifiedAt: new Date(),
        blockchainProjectId: blockchainResult?.projectId
      });
    }

    res.status(200).json({
      success: true,
      message: blockchainResult 
        ? 'Initial submission approved and stored on blockchain successfully' 
        : 'Initial submission approved (blockchain storage failed)',
      data: submission,
      blockchain: blockchainResult,
      blockchainError: blockchainError
    });
  } catch (error) {
    console.error('Error approving initial submission:', error);
    res.status(500).json({
      success: false,
      message: 'Error approving initial submission',
      error: error.message
    });
  }
};

/**
 * Reject initial submission
 * PUT /api/projects/:id/reject-initial
 */
const rejectInitialSubmission = async (req, res) => {
  try {
    const { id } = req.params;
    const { rejectionReason, verifiedBy } = req.body;
    
    if (!rejectionReason) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required'
      });
    }

    const submission = await Submission.findById(id);
    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found'
      });
    }

    // Allow rejection from PENDING_INITIAL_VERIFICATION status
    if (submission.status !== SUBMISSION_STATUS.PENDING_INITIAL_VERIFICATION) {
      return res.status(400).json({
        success: false,
        message: `Submission is not in PENDING_INITIAL_VERIFICATION status. Current status: ${submission.status}`
      });
    }

    // Update submission status
    submission.status = SUBMISSION_STATUS.REJECTED;
    submission.panchayatRemarks = rejectionReason;
    submission.verifiedBy = verifiedBy || req.body.walletAddress;
    submission.verifiedAt = new Date();
    await submission.save();

    // Update project status to INITIAL_REJECTED
    if (submission.projectId) {
      await Project.findByIdAndUpdate(submission.projectId, {
        status: PROJECT_STATUS.INITIAL_REJECTED,
        rejectionReason: rejectionReason,
        verifiedBy: verifiedBy || req.body.walletAddress,
        verifiedAt: new Date()
      });
    }

    res.status(200).json({
      success: true,
      message: 'Initial submission rejected successfully',
      data: submission
    });
  } catch (error) {
    console.error('Error rejecting initial submission:', error);
    res.status(500).json({
      success: false,
      message: 'Error rejecting initial submission',
      error: error.message
    });
  }
};

/**
 * Approve final submission and mint tokens
 * PUT /api/projects/:id/approve-final
 * 
 * This will:
 * 1. Call blockchain API to verify and mint credits + NFT
 * 2. Store transaction hash, token ID, and contract address in MongoDB
 */
const approveFinalSubmission = async (req, res) => {
  try {
    const { id } = req.params;
    const { verifiedBy, skipBlockchain } = req.body;
    
    const submission = await Submission.findById(id);
    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found'
      });
    }

    if (submission.status !== SUBMISSION_STATUS.PENDING_FINAL_VERIFICATION) {
      return res.status(400).json({
        success: false,
        message: 'Submission is not in PENDING_FINAL_VERIFICATION status'
      });
    }

    // Calculate carbon credits: saplingsPlanted * 0.02
    const carbonCredits = (submission.saplingsPlanted || 0) * 0.02;

    // Blockchain transaction results
    let blockchainResult = null;
    let blockchainError = null;

    // Try to call blockchain if not skipped
    if (!skipBlockchain) {
      try {
        console.log('🔗 Calling blockchain API to verify and mint credits...');
        
        // Get blockchain project ID (from submission blockchain data or create new)
        let blockchainProjectId = submission.blockchain?.projectIdOnChain;
        
        if (!blockchainProjectId) {
          // Use submission _id as projectId for blockchain
          blockchainProjectId = parseInt(submission._id.toString().slice(-8), 16) || Date.now();
          
          // Get NGO wallet address
          let ngoWallet = '0x0000000000000000000000000000000000000000';
          if (submission.ngoId) {
            const User = require('../models/User');
            const ngo = await User.findById(submission.ngoId);
            if (ngo && ngo.walletAddress) {
              ngoWallet = ngo.walletAddress;
            }
          }
          
          // First, create project on blockchain if not exists
          const createResult = await callBlockchainAPI('/api/blockchain/create-project', {
            projectId: blockchainProjectId,
            projectName: submission.project || `Project-${blockchainProjectId}`,
            ngoDeveloper: ngoWallet,
            carbonAmount: carbonCredits * 10**18, // Convert to wei
            ipfsHash: submission.ipfsHash || '',
            ownerPrivateKey: process.env.OWNER_PRIVATE_KEY  // FIX: read from env
          });
          
          console.log('✅ Project created on blockchain:', createResult);
        }
        
        // Then verify and mint (this also creates NFT and mints tokens)
        const verifyResult = await callBlockchainAPI('/api/blockchain/verify-final', {
          projectId: blockchainProjectId,
          ownerPrivateKey: process.env.OWNER_PRIVATE_KEY  // FIX: read from env
        });
        
        console.log('✅ Credits minted on blockchain:', verifyResult);
        
        blockchainResult = {
          projectId: blockchainProjectId,
          txHash: verifyResult.data?.transactionHash,
          blockNumber: verifyResult.data?.blockNumber,
          creditsMinted: carbonCredits,
          mintedAt: new Date()
        };
        
      } catch (blockchainErr) {
        console.error('❌ Blockchain error:', blockchainErr.message);
        blockchainError = blockchainErr.message;
        // Continue with DB update even if blockchain fails
      }
    }

    // Update submission with blockchain details
    submission.status = SUBMISSION_STATUS.MINTED;
    submission.carbonAmount = carbonCredits;
    submission.creditsIssued = carbonCredits;
    submission.mintingStatus = 'completed';
    submission.verifiedBy = verifiedBy || req.body.walletAddress;
    submission.verifiedAt = new Date();
    
    // Store complete blockchain details
    submission.blockchain = {
      ...submission.blockchain,
      txHash: blockchainResult?.txHash || req.body.txHash,
      blockNumber: blockchainResult?.blockNumber,
      contractAddress: (await getContractDetails('CarbonCreditSystem')).address,
      tokenId: blockchainResult?.tokenId,
      network: 'ethereum',
      mintedAt: blockchainResult?.mintedAt || new Date(),
      creditsMinted: carbonCredits
    };
    
    await submission.save();

    // Update project status to COMPLETED
    if (submission.projectId) {
      await Project.findByIdAndUpdate(submission.projectId, {
        status: PROJECT_STATUS.COMPLETED,
        carbonAmount: carbonCredits,
        creditsIssued: carbonCredits,
        verifiedBy: verifiedBy || req.body.walletAddress,
        verifiedAt: new Date(),
        blockchainProjectId: blockchainResult?.projectId,
        nftTokenId: blockchainResult?.tokenId
      });
    }

    res.status(200).json({
      success: true,
      message: blockchainResult 
        ? 'Final submission approved and credits minted on blockchain successfully' 
        : 'Final submission approved (blockchain minting failed)',
      data: submission,
      carbonCredits: carbonCredits,
      blockchain: blockchainResult,
      blockchainError: blockchainError
    });
  } catch (error) {
    console.error('Error approving final submission:', error);
    res.status(500).json({
      success: false,
      message: 'Error approving final submission',
      error: error.message
    });
  }
};

/**
 * Reject final submission
 * PUT /api/projects/:id/reject-final
 */
const rejectFinalSubmission = async (req, res) => {
  try {
    const { id } = req.params;
    const { rejectionReason, verifiedBy } = req.body;
    
    if (!rejectionReason) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required'
      });
    }

    const submission = await Submission.findById(id);
    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found'
      });
    }

    if (submission.status !== SUBMISSION_STATUS.PENDING_FINAL_VERIFICATION) {
      return res.status(400).json({
        success: false,
        message: 'Submission is not in PENDING_FINAL_VERIFICATION status'
      });
    }

    // Update submission status (project goes back to INITIAL_APPROVED so NGO can resubmit)
    submission.status = SUBMISSION_STATUS.REJECTED;
    submission.panchayatRemarks = rejectionReason;
    submission.verifiedBy = verifiedBy || req.body.walletAddress;
    submission.verifiedAt = new Date();
    await submission.save();

    // Update project status back to INITIAL_APPROVED (NGO can resubmit final)
    if (submission.projectId) {
      await Project.findByIdAndUpdate(submission.projectId, {
        status: PROJECT_STATUS.INITIAL_APPROVED,
        rejectionReason: rejectionReason,
        verifiedBy: verifiedBy || req.body.walletAddress,
        verifiedAt: new Date()
      });
    }

    res.status(200).json({
      success: true,
      message: 'Final submission rejected successfully',
      data: submission
    });
  } catch (error) {
    console.error('Error rejecting final submission:', error);
    res.status(500).json({
      success: false,
      message: 'Error rejecting final submission',
      error: error.message
    });
  }
};

// Legacy function - kept for backward compatibility
const approveProject = async (req, res) => {
  // Redirect to approveInitialSubmission
  return approveInitialSubmission(req, res);
};

// Legacy function - kept for backward compatibility
const rejectProject = async (req, res) => {
  // Redirect to rejectInitialSubmission
  return rejectInitialSubmission(req, res);
};

/**
 * Get projects filtered by submission type for NGO dashboard
 * GET /api/projects/submissions?type=initial|final&walletAddress=xxx
 * 
 * - If type=initial: Returns projects WITHOUT any initial submission yet
 * - If type=final: Returns projects that have INITIAL submission but NO FINAL submission
 */
const getProjectsBySubmissionType = async (req, res) => {
  try {
    const { type, walletAddress } = req.query;
    
    console.log('📥 getProjectsBySubmissionType called with:', { type, walletAddress });
    
    // Get all projects for this wallet
    let projectQuery = {};
    if (walletAddress) {
      projectQuery.walletAddress = walletAddress;
    }
    
    const projects = await Project.find(projectQuery).sort({ createdAt: -1 });
    console.log('📊 Found projects:', projects.length);
    
    // Get all submissions for these projects
    const projectIds = projects.map(p => p._id);
    console.log('📊 Project IDs:', projectIds);
    
    let submissions = [];
    if (projectIds.length > 0) {
      submissions = await Submission.find({ 
        projectId: { $in: projectIds } 
      });
    }
    console.log('📊 Found submissions:', submissions.length);
    
    // Get projects that have INITIAL submissions
    const projectsWithInitial = new Set(
      submissions
        .filter(s => s.submissionType === 'INITIAL')
        .map(s => s.projectId ? s.projectId.toString() : null)
        .filter(id => id !== null)
    );
    
    // Get projects that have FINAL submissions
    const projectsWithFinal = new Set(
      submissions
        .filter(s => s.submissionType === 'FINAL')
        .map(s => s.projectId ? s.projectId.toString() : null)
        .filter(id => id !== null)
    );
    
    console.log('📊 Projects with initial:', Array.from(projectsWithInitial));
    console.log('📊 Projects with final:', Array.from(projectsWithFinal));
    
    let filteredProjects;
    const typeLower = type ? type.toLowerCase() : '';
    
    if (typeLower === 'initial') {
      // INITIAL: Show projects that don't have any initial submission yet
      // AND are in DRAFT status (not yet submitted)
      filteredProjects = projects.filter(p => 
        !projectsWithInitial.has(p._id.toString()) && 
        p.status === 'DRAFT'
      );
    } else if (typeLower === 'final') {
      // FINAL: Show projects that have INITIAL submission but NO FINAL submission
      // AND the project status should be INITIAL_APPROVED (after Panchayat approved initial)
      filteredProjects = projects.filter(p => 
        projectsWithInitial.has(p._id.toString()) && 
        !projectsWithFinal.has(p._id.toString()) &&
        p.status === 'INITIAL_APPROVED'
      );
    } else {
      // No type specified or empty - return DRAFT projects (for initial load)
      filteredProjects = projects.filter(p => p.status === 'DRAFT');
    }
    
    console.log('📊 Filtered projects:', filteredProjects.length);
    
    res.status(200).json({
      success: true,
      count: filteredProjects.length,
      data: filteredProjects
    });
  } catch (error) {
    console.error('Error fetching projects by submission type:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching projects',
      error: error.message
    });
  }
};

/**
 * Get all projects (existing function)
 * GET /api/projects/:walletAddress
 */
const getProjects = async (req, res) => {
  try {
    const { walletAddress } = req.params;
    const { status } = req.query;
    
    let query = {};
    
    if (walletAddress) {
      query.walletAddress = walletAddress;
    }
    
    if (status) {
      query.status = status;
    }
    
    const projects = await Project.find(query).sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      count: projects.length,
      data: projects
    });
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching projects',
      error: error.message
    });
  }
};

/**
 * Get project by ID
 * GET /api/projects/project/:id
 */
const getProjectById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const project = await Project.findById(id);
    
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: project
    });
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching project',
      error: error.message
    });
  }
};

/**
 * Create a new project
 * POST /api/projects
 */
const createProject = async (req, res) => {
  try {
    console.log('📥 Creating project with data:', req.body);
    
    // Validate required fields
    const { name, title, walletAddress } = req.body;
    
    if (!name && !title) {
      return res.status(400).json({
        success: false,
        message: 'Project name is required. Please provide either "name" or "title" field.'
      });
    }
    
    if (!walletAddress) {
      return res.status(400).json({
        success: false,
        message: 'Wallet address is required'
      });
    }

    // Map frontend field 'name' to schema field 'title'
    // This handles the mismatch between frontend (name) and schema (title)
    const { type, projectType, estimatedCredits, state, district, panchayat, startDate, completionDate, speciesType, saplingsPlanted, areaCovered, latitude, longitude, carbonAmount } = req.body;
    
    const projectData = {
      // Title mapping (schema requires 'title')
      title: title || name,
      // Also keep name for frontend display compatibility
      name: name || title,
      projectName: name || title,
      
      // Type mapping (schema has 'projectType', frontend sends 'type')
      projectType: projectType || type,
      type: type || projectType,
      
      // Other fields - pass through as-is
      state: state,
      district: district,
      panchayat: panchayat,
      startDate: startDate,
      completionDate: completionDate,
      
      // Estimated credits - ensure it's a number
      estimatedCredits: estimatedCredits ? parseFloat(estimatedCredits) : 0,
      
      // Plantation data - save all these fields
      speciesType: speciesType,
      saplingsPlanted: saplingsPlanted ? parseInt(saplingsPlanted) : 0,
      areaCovered: areaCovered ? parseFloat(areaCovered) : 0,
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      carbonAmount: carbonAmount ? parseFloat(carbonAmount) : (estimatedCredits ? parseFloat(estimatedCredits) : 0),
      
      // Set default status to DRAFT (new 3-stage workflow)
      status: PROJECT_STATUS.DRAFT,
      // Save both walletAddress and submittedBy for backward compatibility
      submittedBy: walletAddress,
      walletAddress: walletAddress
    };
    
    console.log('💾 Project data being saved:', projectData);
    
    const project = new Project(projectData);
    await project.save();
    
    console.log('✅ Project created successfully:', project._id);
    
    res.status(201).json({
      success: true,
      message: 'Project created successfully',
      data: project
    });
  } catch (error) {
    console.error('Error creating project:', error);
    
    // Handle Mongoose validation errors specifically
    if (error.name === 'ValidationError') {
      const validationErrors = Object.keys(error.errors).map(key => ({
        field: key,
        message: error.errors[key].message
      }));
      
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validationErrors
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error creating project',
      error: error.message
    });
  }
};

/**
 * Update a project
 * PUT /api/projects/:id
 */
const updateProject = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Map frontend field names to schema field names
    const { name, title, type, projectType, estimatedCredits, state, district, panchayat, startDate, completionDate } = req.body;
    
    const updateData = {};
    
    // Handle title/name mapping
    if (name || title) {
      updateData.title = title || name;
      updateData.name = name || title;
      updateData.projectName = name || title;
    }
    
    // Handle type/projectType mapping
    if (type || projectType) {
      updateData.projectType = projectType || type;
      updateData.type = type || projectType;
    }
    
    // Handle estimatedCredits - ensure it's a number
    if (estimatedCredits !== undefined) {
      updateData.estimatedCredits = parseFloat(estimatedCredits) || 0;
    }
    
    // Pass through other fields
    if (state) updateData.state = state;
    if (district) updateData.district = district;
    if (panchayat) updateData.panchayat = panchayat;
    if (startDate) updateData.startDate = startDate;
    if (completionDate) updateData.completionDate = completionDate;
    
    console.log('📥 Updating project with data:', updateData);
    
    const project = await Project.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );
    
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }
    
    console.log('✅ Project updated successfully:', project._id);
    
    res.status(200).json({
      success: true,
      message: 'Project updated successfully',
      data: project
    });
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating project',
      error: error.message
    });
  }
};

/**
 * Delete a project
 * DELETE /api/projects/:id
 */
const deleteProject = async (req, res) => {
  try {
    const { id } = req.params;
    
    const project = await Project.findByIdAndDelete(id);
    
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Project deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting project',
      error: error.message
    });
  }
};

module.exports = {
  getPendingProjects,
  getPendingCount,
  getApprovedProjects,
  getVerifiedProjects,
  getRejectedProjects,
  approveProject,
  rejectProject,
  approveInitialSubmission,
  rejectInitialSubmission,
  approveFinalSubmission,
  rejectFinalSubmission,
  getProjectsBySubmissionType,
  getProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject
};
