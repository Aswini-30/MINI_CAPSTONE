// Project Routes for Panchayat Verification
const express = require('express');
const router = express.Router();

// Import controller functions
const {
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
} = require('../controllers/projectController');

/**
 * POST /api/projects
 * Create a new project
 */
router.post('/', createProject);

/**
 * GET /api/projects/pending
 * Get all pending submissions for Panchayat verification
 * NOTE: This must come BEFORE /:walletAddress route to avoid route conflict
 */
router.get('/pending', getPendingProjects);

/**
 * GET /api/projects/pending/count
 * Get count of pending submissions
 */
router.get('/pending/count', getPendingCount);

/**
 * GET /api/projects/approved
 * Get all approved projects
 */
router.get('/approved', getApprovedProjects);

/**
 * GET /api/projects/verified  
 * Get verified/completed projects for marketplace (with blockchainProjectId)
 */
router.get('/verified', getVerifiedProjects);

/**
 * DEBUG: Get ALL projects with status/debug info
 */
router.get('/debug', async (req, res) => {
  const { projectController } = require('../controllers/projectController');
  const Project = require('../models/Project');
  const allProjects = await Project.find({}).select('status blockchainProjectId name state verifiedAt createdAt').limit(10);
  const verifiedCount = await Project.countDocuments({
    status: { $in: ['INITIAL_APPROVED', 'COMPLETED'] }
  });
  const chainedCount = await Project.countDocuments({
    status: { $in: ['INITIAL_APPROVED', 'COMPLETED'] },
    'blockchainProjectId': { $exists: true, $ne: null }
  });
  res.json({
    success: true,
    allProjectsCount: allProjects.length,
    verifiedStatusCount: verifiedCount,
    verifiedWithChainCount: chainedCount,
    sampleProjects: allProjects,
    message: 'Use /projects/approved for all approved, /verified for chain-linked'
  });
});

/**
 * GET /api/projects/rejected
 * Get all rejected projects
 */
router.get('/rejected', getRejectedProjects);

/**
 * GET /api/projects/project/:id
 * Get a single project by ID
 * NOTE: This must come BEFORE /:walletAddress route to avoid route conflict
 */
router.get('/project/:id', getProjectById);

/**
 * GET /api/projects/submissions
 * Get projects filtered by submission type for NGO dashboard
 * NOTE: This must come BEFORE /:walletAddress route to avoid route conflict
 */
router.get('/submissions', getProjectsBySubmissionType);

/**
 * GET /api/projects/:walletAddress
 * Get all projects for a wallet address
 * NOTE: This must come AFTER more specific routes
 */
router.get('/:walletAddress', getProjects);

/**
 * PUT /api/projects/:id
 * Update a project
 */
router.put('/:id', updateProject);

/**
 * PUT /api/projects/:id/approve
 * Approve a project (legacy - redirects to initial approval)
 */
router.put('/:id/approve', approveProject);

/**
 * PUT /api/projects/:id/reject
 * Reject a project (legacy - redirects to initial rejection)
 */
router.put('/:id/reject', rejectProject);

/**
 * PUT /api/projects/:id/approve-initial
 * Approve initial submission
 */
router.put('/:id/approve-initial', approveInitialSubmission);

/**
 * PUT /api/projects/:id/reject-initial
 * Reject initial submission
 */
router.put('/:id/reject-initial', rejectInitialSubmission);

/**
 * PUT /api/projects/:id/approve-final
 * Approve final submission and mint tokens
 */
router.put('/:id/approve-final', approveFinalSubmission);

/**
 * PUT /api/projects/:id/reject-final
 * Reject final submission
 */
router.put('/:id/reject-final', rejectFinalSubmission);

/**
 * DELETE /api/projects/:id
 * Delete a project
 */
router.delete('/:id', deleteProject);

// Export the router
module.exports = router;
