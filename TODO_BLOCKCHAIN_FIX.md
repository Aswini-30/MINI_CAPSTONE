# 🔧 BLOCKCHAIN + MARKETPLACE ROOT FIX PLAN
## Root Cause: No `blockchainProjectId` in Projects (missing schema + wrong field name)

### Phase 1: Schema Fix (Immediate)
### 1.1 Add field to Model ✅ PRIORITY
**Backend/models/Project.js**
```
blockchainProjectId: {
  type: Number,
  default: null
},
blockchain: {
  projectId: Number,
  txHash: String,
  mintedAt: Date
}
```
**Add index**: `projectSchema.index({ status: 1, blockchainProjectId: 1 });`

### 2. Backend Route Fix (Marketplace)
**Backend/controllers/projectController.js getVerifiedProjects()**
```
const projects = await Project.find({ 
  status: { $in: [PROJECT_STATUS.INITIAL_APPROVED, PROJECT_STATUS.COMPLETED] },
  blockchainProjectId: { $ne: null }
}).sort({ verifiedAt: -1 });
```

### 3. ROOT MINTING FIX
**Backend/controllers/blockchainController.js createProjectAndMint** 
```
// Parse EVENT for projectId (contract emits ProjectCreatedAndMinted)
const receipt = await contract.methods.createProjectAndMint(...).send(...);
const event = receipt.events.ProjectCreatedAndMinted.returnValues;
const blockchainProjectId = event.projectId;
```
**submissionController.js verifySubmission** 
```
submission.blockchain.projectId = blockchainResult.projectId; // NOT projectIdOnChain
if (submission.projectId) {
  await Project.findByIdAndUpdate(submission.projectId, {
    blockchainProjectId: blockchainResult.projectId
  });
}
```

### Phase 2: Temporary Data Fix
```
cd Backend && mongo
db.projects.updateMany({}, { $set: { blockchainProjectId: 1, blockchain: { projectId: 1 } } })
```

### Phase 3: Test
1. Marketplace shows projects
2. Panchayat approve → sets blockchainProjectId
3. GET /api/projects/debug shows counts > 0

**Execute Phase 1 now**

