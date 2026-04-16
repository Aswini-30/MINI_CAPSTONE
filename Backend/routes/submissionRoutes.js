const express = require('express');
const router = express.Router();
const { upload, handleMulterError } = require('../config/multer');
const {
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
} = require('../controllers/submissionController');

/**
 * POST /api/submissions
 * Upload a new submission with file to IPFS
 * 
 * Content-Type: multipart/form-data
 * 
 * Request Body:
 * - file: File (required) - PDF, DOC, or image files
 * - ngoId: String (required) - MongoDB ObjectId of the NGO/User
 * - projectId: String (required) - MongoDB ObjectId of the project
 * - carbonAmount: Number (optional) - Amount of carbon credits
 * - description: String (optional) - Submission description
 * 
 * Response (201):
 * {
 *   "success": true,
 *   "data": { ... },
 *   "message": "Submission uploaded successfully"
 * }
 */
router.post(
  '/',
  upload.single('file'),
  handleMulterError,
  uploadSubmission
);

/**
 * GET /api/submissions
 * Get all submissions with filters and pagination
 * 
 * Query Parameters:
 * - status: Filter by status
 * - ngoId: Filter by NGO
 * - projectId: Filter by project
 * - startDate: Filter by start date
 * - endDate: Filter by end date
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20)
 */
router.get('/', getAllSubmissions);

/**
 * GET /api/submissions/stats
 * Get submission statistics
 */
router.get('/stats', getSubmissionStats);

/**
 * GET /api/submissions/carbon-credits
 * Get carbon credits statistics
 */
router.get('/carbon-credits', getCarbonCreditsStats);

/**
 * GET /api/submissions/pending
 * Get pending submissions for Panchayat verification
 */
router.get('/pending', getPendingSubmissions);

/**
 * PUT /api/submissions/:id/verify
 * Verify a submission (Approve or Reject)
 */
router.put('/:id/verify', verifySubmission);

/**
 * GET /api/submissions/project/:projectId
 * Get all submissions for a specific project
 */
router.get('/project/:projectId', getSubmissionsByProject);

/**
 * GET /api/submissions/ngo/:ngoId
 * Get all submissions for a specific NGO
 */
router.get('/ngo/:ngoId', getSubmissionsByNgo);

/**
 * GET /api/submissions/:id
 * Get a single submission by ID
 */
router.get('/:id', getSubmissionById);

/**
 * PUT /api/submissions/:id/status
 * Update submission status (for Panchayat approval)
 * 
 * Request Body:
 * - status: String (required) - SUBMITTED, UNDER_REVIEW, APPROVED, REJECTED, MINTED, FAILED
 * - remarks: String (optional) - Notes about the status change
 * - reviewedBy: String (optional) - ID of reviewer
 */
router.put('/:id/status', updateSubmissionStatus);

/**
 * PUT /api/submissions/:id/mint
 * Store blockchain minting details after successful transaction
 * 
 * Request Body:
 * - txHash: String (required) - Ethereum transaction hash
 * - blockNumber: Number (optional) - Block number
 * - contractAddress: String (optional) - Contract address
 * - tokenId: String (optional) - Token ID
 * - gasUsed: Number (optional) - Gas used
 * - network: String (optional) - Network (ethereum, polygon, bsc)
 * - carbonAmount: Number (optional) - Carbon amount
 * - creditsIssued: Number (optional) - Credits issued
 */
router.put('/:id/mint', storeMintingDetails);

/**
 * PUT /api/submissions/:id/credits
 * Update carbon credits amount
 * 
 * Request Body:
 * - carbonAmount: Number (optional)
 * - creditsIssued: Number (optional)
 */
router.put('/:id/credits', updateCreditsIssued);

/**
 * DELETE /api/submissions/:id
 * Delete a submission
 */
router.delete('/:id', deleteSubmission);

module.exports = router;
