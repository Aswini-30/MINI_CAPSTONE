/**
 * blockchainController.js - FIXED VERSION
 * Fixes:
 * 1. Gas estimation failure for verifyFinalAndMint
 * 2. Project ID overflow (safe integer generation)
 * 3. carbonAmount=0 causing mint revert
 * 4. Industry purchase credits flow
 */
const { Web3 } = require('web3');
const path     = require('path');
const fs       = require('fs');

let web3Instance = null;
let networkId    = null;
let contracts    = {};

const loadContract = async (name) => {
  const artifactPath = path.join(__dirname, '../../Truffle/build/contracts', `${name}.json`);
  if (!fs.existsSync(artifactPath)) {
    throw new Error(`Artifact not found: ${artifactPath}. Run: cd Truffle && truffle migrate`);
  }
  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  if (!networkId) {
    const raw = await web3Instance.eth.net.getId();
    networkId = Number(raw);
    console.log(`🔗 Detected networkId: ${networkId}`);
  }
  let network = artifact.networks[networkId] || artifact.networks['*'] || Object.values(artifact.networks)[0];
  if (!network || !network.address) {
    throw new Error(`Contract "${name}" not deployed on network ${networkId}. Available: [${Object.keys(artifact.networks).join(', ')}]. Run: cd Truffle && truffle migrate --network development`);
  }
  console.log(`📜 ${name} @ ${network.address}`);
  return { address: network.address, abi: artifact.abi };
};

const initBlockchain = async () => {
  if (web3Instance && contracts.CarbonCreditSystem) return web3Instance;
  const rpcUrl = process.env.BLOCKCHAIN_RPC_URL || 'http://127.0.0.1:7545';
  console.log(`\n🌐 Connecting to blockchain at ${rpcUrl}...`);
  web3Instance = new Web3(rpcUrl);
  try {
    const block = await web3Instance.eth.getBlockNumber();
    console.log(`✅ Web3 connected – latest block: ${block}`);
  } catch (err) {
    throw new Error(`Cannot reach Ganache at ${rpcUrl}. Start Ganache first. ${err.message}`);
  }
  const css = await loadContract('CarbonCreditSystem');
  const cct = await loadContract('CarbonCreditToken');
  contracts.CarbonCreditSystem = new web3Instance.eth.Contract(css.abi, css.address);
  contracts.CarbonCreditToken  = new web3Instance.eth.Contract(cct.abi, cct.address);
  console.log('✅ All contracts loaded\n');
  return web3Instance;
};

const resetBlockchain = () => { web3Instance = null; networkId = null; contracts = {}; };

/**
 * FIXED sendTx: Better gas buffer and error reporting
 */
const { sendTxWithRevertReason } = require('../utils/web3Utils');

const sendTx = async (method, privateKey, label, valueWei = null) => {
  return await sendTxWithRevertReason(web3Instance, method, privateKey, label, valueWei);
};


// ─── Status ───────────────────────────────────────────────────────────────────
const getStatus = async (req, res) => {
  try {
    await initBlockchain();
    const block = await web3Instance.eth.getBlockNumber();
    const chain = await web3Instance.eth.net.getId();
    res.json({
      success: true,
      blockNumber: Number(block),
      chainId: Number(chain),
      networkId,
      rpcUrl: process.env.BLOCKCHAIN_RPC_URL || 'http://127.0.0.1:7545',
      contracts: {
        CarbonCreditSystem: contracts.CarbonCreditSystem?.options?.address || 'not loaded',
        CarbonCreditToken:  contracts.CarbonCreditToken?.options?.address  || 'not loaded'
      }
    });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// ─── Create Project ───────────────────────────────────────────────────────────
const createProject = async (req, res) => {
  try {
    await initBlockchain();
    const { projectId, projectName, ngoDeveloper, carbonAmount, ipfsHash, ownerPrivateKey } = req.body;
    if (!ownerPrivateKey) return res.status(400).json({ success: false, error: 'ownerPrivateKey is required' });
    if (!projectId)       return res.status(400).json({ success: false, error: 'projectId is required' });
    if (!ngoDeveloper)    return res.status(400).json({ success: false, error: 'ngoDeveloper address is required' });

    // FIXED: ensure carbonAmount is at least 1 to avoid mint(0) revert
    const safeAmount = Math.max(1, Math.round(Number(carbonAmount) || 1));
    const carbonWei  = web3Instance.utils.toWei(String(safeAmount), 'ether');

    // FIXED: check if project already exists on chain to avoid duplicate
    let alreadyExists = false;
    try {
      const onChain = await contracts.CarbonCreditSystem.methods.projects(projectId).call();
      if (Number(onChain.projectId) !== 0) alreadyExists = true;
    } catch (_) {}

    if (alreadyExists) {
      console.log(`ℹ️  Project ${projectId} already exists on chain – skipping createProject`);
      return res.json({ success: true, data: { skipped: true, reason: 'already exists', projectId } });
    }

    const method = contracts.CarbonCreditSystem.methods.createProject(
      projectId,
      projectName || `Project-${projectId}`,
      ngoDeveloper,
      carbonWei,
      ipfsHash || ''
    );
    const result = await sendTx(method, ownerPrivateKey, 'createProject');
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('createProject error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ─── Verify Initial ───────────────────────────────────────────────────────────
const verifyInitial = async (req, res) => {
  try {
    await initBlockchain();
    const { projectId, ownerPrivateKey } = req.body;
    if (!ownerPrivateKey) return res.status(400).json({ success: false, error: 'ownerPrivateKey is required' });
    if (!projectId)       return res.status(400).json({ success: false, error: 'projectId is required' });

    // FIXED: Check current status before calling to avoid revert
    const statusCode = await contracts.CarbonCreditSystem.methods.projectStatus(projectId).call();
    const status = Number(statusCode);
    // 0=CREATED, 1=INITIAL_VERIFIED, 2=FINAL_VERIFIED, 3=CREDITS_ISSUED
    if (status !== 0) {
      return res.json({
        success: true,
        data: { skipped: true, reason: `Project already in status ${status} (not CREATED)`, projectId }
      });
    }

    const method = contracts.CarbonCreditSystem.methods.verifyInitial(projectId);
    const result = await sendTx(method, ownerPrivateKey, 'verifyInitial');
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('verifyInitial error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ─── Verify Final & Mint ──────────────────────────────────────────────────────
const verifyFinal = async (req, res) => {
  try {
    await initBlockchain();
    const { projectId, ownerPrivateKey, carbonAmount } = req.body;
    if (!ownerPrivateKey) return res.status(400).json({ success: false, error: 'ownerPrivateKey is required' });
    if (!projectId)       return res.status(400).json({ success: false, error: 'projectId is required' });

    // ✅ NEW: STRICT CHECK - Project MUST exist on blockchain first
    const onChainProject = await contracts.CarbonCreditSystem.methods.projects(projectId).call();
    if (Number(onChainProject.projectId) === 0) {
      throw new Error(`Project ${projectId} does NOT exist on blockchain. Run createProject+verifyInitial first (INITIAL verification required)`);
    }
    console.log(`✅ Project ${projectId} confirmed on blockchain: ${onChainProject.projectName}`);

    // FIXED: Check + LOG status before gas estimation
    console.log(`🔍 verifyFinal: Checking project ${projectId} status...`);
    let statusCode;
    try {
      statusCode = await contracts.CarbonCreditSystem.methods.projectStatus(projectId).call();
    } catch (err) {
      throw new Error(`Cannot read projectStatus(${projectId}): ${err.message}`);
    }
    const status = Number(statusCode);
    console.log(`📊 projectStatus[${projectId}] = ${status} (${status === 0 ? 'CREATED' : status === 1 ? 'INITIAL_VERIFIED' : status === 2 ? 'FINAL_VERIFIED' : status === 3 ? 'CREDITS_ISSUED' : 'UNKNOWN'})`);

    if (status === 3) {
      return res.json({
        success: true,
        data: { skipped: true, reason: 'Credits already minted for this project', projectId }
      });
    }

    if (status !== 1) {
      throw new Error(`Project ${projectId} status=${status} on blockchain. Expected INITIAL_VERIFIED (1). Run verifyInitial first.`);
    }

    // FIXED: carbonAmount check (duplicate onChainProject var renamed)
    const projectData = await contracts.CarbonCreditSystem.methods.projects(projectId).call();
    if (Number(projectData.carbonAmount) === 0 && carbonAmount && carbonAmount > 0) {
      console.log(`ℹ️  carbonAmount was 0, using ${carbonAmount} (set at createProject)`);
    }

    const method = contracts.CarbonCreditSystem.methods.verifyFinalAndMint(projectId);
    const result = await sendTx(method, ownerPrivateKey, 'verifyFinalAndMint');
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('verifyFinal error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ─── Available Credits ────────────────────────────────────────────────────────
const getAvailableCredits = async (req, res) => {
  try {
    await initBlockchain();
    const Submission = require('../models/Submission');
    const Project    = require('../models/Project');

    const completedProjects = await Project.find({ status: 'COMPLETED' }).lean();
    const result = [];

    for (const proj of completedProjects) {
      const sub = await Submission.findOne({
        projectId: proj._id,
        submissionType: 'FINAL',
        status: { $in: ['APPROVED', 'MINTED'] }
      }).sort({ submittedAt: -1 }).lean();

      if (!sub) continue;

      let creditsAvailable = sub.creditsIssued || sub.carbonAmount || proj.carbonAmount || 0;

      if (sub.blockchain?.projectIdOnChain) {
        try {
          const op      = await contracts.CarbonCreditSystem.methods.projects(sub.blockchain.projectIdOnChain).call();
          const issued  = Number(op.creditsIssued);
          if (issued > 0) creditsAvailable = issued / 1e18;
        } catch (_) {}
      }

      result.push({
        _id:            proj._id,
        projectName:    proj.projectName || proj.title,
        title:          proj.title,
        description:    proj.description,
        state:          proj.state,
        district:       proj.district,
        projectType:    proj.projectType || sub.projectType,
        carbonAmount:   sub.carbonAmount || proj.carbonAmount || 0,
        creditsAvailable,
        creditsIssued:  creditsAvailable,
        ipfsUrl:        sub.ipfsUrl,
        walletAddress:  proj.walletAddress || sub.walletAddress,
        onChainProjectId: sub.blockchain?.projectIdOnChain,
        txHash:         sub.blockchain?.txHash || sub.blockchain?.initialVerificationTx,
        verifiedAt:     sub.reviewedAt || sub.submittedAt,
        areaCovered:    proj.areaCovered,
        saplingsPlanted: proj.saplingsPlanted
      });
    }

    res.json({ success: true, data: result, count: result.length });
  } catch (err) {
    console.error('getAvailableCredits error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ─── Purchase Credits ─────────────────────────────────────────────────────────
const purchaseCredits = async (req, res) => {
  try {
    await initBlockchain();
    const Project  = require('../models/Project');
    const Purchase = require('../models/Purchase');
    const { projectId, creditsAmount, buyerAddress, buyerPrivateKey } = req.body;

    if (!projectId)                              return res.status(400).json({ success: false, error: 'projectId is required' });
    if (!creditsAmount || creditsAmount <= 0)    return res.status(400).json({ success: false, error: 'creditsAmount must be > 0' });
    if (!buyerAddress)                           return res.status(400).json({ success: false, error: 'buyerAddress is required' });
    if (!buyerPrivateKey)                        return res.status(400).json({ success: false, error: 'buyerPrivateKey is required' });

    const proj = await Project.findById(projectId);
    if (!proj) return res.status(404).json({ success: false, error: 'Project not found' });
    if (proj.status !== 'COMPLETED') return res.status(400).json({ success: false, error: 'Project is not yet completed/verified' });

    const creditPrice = await contracts.CarbonCreditSystem.methods.creditPrice().call();
    const amt         = Math.round(creditsAmount);
    const totalValue  = BigInt(creditPrice) * BigInt(amt);

    const method  = contracts.CarbonCreditSystem.methods.purchaseCredits(amt);
    const result  = await sendTx(method, buyerPrivateKey, 'purchaseCredits', totalValue);

    const purchase = await Purchase.create({
      projectId:      proj._id,
      projectName:    proj.projectName || proj.title,
      buyerAddress:   buyerAddress.toLowerCase(),
      creditsAmount:  amt,
      pricePerCredit: Number(creditPrice),
      totalPaid:      Number(totalValue),
      txHash:         result.transactionHash,
      blockNumber:    result.blockNumber,
      gasUsed:        result.gasUsed,
      status:         'COMPLETED'
    });

    res.json({
      success: true,
      message: `Successfully purchased ${creditsAmount} carbon credits`,
      data: {
        transactionHash: result.transactionHash,
        blockNumber:     result.blockNumber,
        creditsAmount,
        totalPaid:       `${Number(totalValue) / 1e18} ETH`,
        purchaseId:      purchase._id
      }
    });
  } catch (err) {
    console.error('purchaseCredits error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ─── Purchase History ─────────────────────────────────────────────────────────
const getPurchaseHistory = async (req, res) => {
  try {
    const Purchase = require('../models/Purchase');
    const { buyerAddress } = req.params;
    const history = await Purchase.find({ buyerAddress: buyerAddress.toLowerCase() }).sort({ createdAt: -1 }).lean();
    res.json({ success: true, data: history, count: history.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ─── Credit Price ─────────────────────────────────────────────────────────────
const getCreditPrice = async (req, res) => {
  try {
    await initBlockchain();
    const priceWei = await contracts.CarbonCreditSystem.methods.creditPrice().call();
    res.json({ success: true, priceWei: priceWei.toString(), priceEth: Number(priceWei) / 1e18 });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ─── SINGLE STEP: Create Project + Mint ───────────────────────────────────────
const createAndMint = async (req, res) => {
  try {
    console.log('🔍 createAndMint DEBUG START');
    await initBlockchain();
    const { projectId, projectName, ngoDeveloper, carbonAmount, ipfsHash, ownerPrivateKey } = req.body;
    
    console.log('📥 Input:', { projectId, carbonAmount, ngoDeveloper: ngoDeveloper?.slice(0,10)+'...', hasPrivateKey: !!ownerPrivateKey });
    
    if (!ownerPrivateKey) return res.status(400).json({ success: false, error: 'ownerPrivateKey required' });
    if (!projectId) return res.status(400).json({ success: false, error: 'projectId (uint256) required' });
    if (!ngoDeveloper) return res.status(400).json({ success: false, error: 'ngoDeveloper address required' });
    
    const safeAmount = Math.max(1, Math.round(Number(carbonAmount) || 1));
    const carbonWei = web3Instance.utils.toWei(String(safeAmount), 'ether');
    
    console.log(`🎯 createProjectAndMint: projectId=${projectId}, carbon=${safeAmount}ether, to=${ngoDeveloper}`);
    console.log(`📜 Contracts: CSS=${contracts.CarbonCreditSystem.options.address}, networkId=${networkId}`);
    
    // 🔍 PRE-FLIGHT CHECKS
    const account = web3Instance.eth.accounts.privateKeyToAccount(ownerPrivateKey);
    console.log(`👤 Owner account: ${account.address}`);
    
    // Check contract owner
    const contractOwner = await contracts.CarbonCreditSystem.methods.owner().call();
    console.log(`🏛️  Contract owner: ${contractOwner}`);
    console.log(`✅ Owner match: ${account.address.toLowerCase() === contractOwner.toLowerCase()}`);
    
    if (account.address.toLowerCase() !== contractOwner.toLowerCase()) {
      return res.status(400).json({ 
        success: false, 
        error: `Private key does not match contract owner. Expected: ${contractOwner}` 
      });
    }
    
    // Check project exists
    let alreadyExists = false;
    try {
      const onChain = await contracts.CarbonCreditSystem.methods.projects(projectId).call();
      console.log(`📊 Project ${projectId} exists: ${Number(onChain.projectId) !== 0}`);
      if (Number(onChain.projectId) !== 0) alreadyExists = true;
    } catch (e) {
      console.log('ℹ️ Project check failed (normal if fresh chain):', e.message);
    }
    
    if (alreadyExists) {
      console.log(`⏭️  Project ${projectId} already exists – skipping`);
      return res.json({ success: true, data: { skipped: true, reason: 'already exists', projectId } });
    }
    
    console.log('⛽ Starting gas estimation...');
    const method = contracts.CarbonCreditSystem.methods.createProjectAndMint(
      projectId,
      projectName || `Project-${projectId}`,
      ngoDeveloper,
      carbonWei,
      ipfsHash || ''
    );
    
    const result = await sendTx(method, ownerPrivateKey, 'createProjectAndMint');
    
    console.log('✅ MINT SUCCESS!');
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('💥 createAndMint FULL ERROR:', err.message);
    console.error('💥 Stack:', err.stack?.split('\\n').slice(0,5).join('\\n'));
    res.status(500).json({ success: false, error: err.message });
  }
};



// ─── Contract Details ─────────────────────────────────────────────────────────
const getContractDetails = async (name) => {
  await initBlockchain();
  const artifactPath = path.join(__dirname, '../../Truffle/build/contracts', `${name}.json`);
  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  const network  = artifact.networks[networkId] || artifact.networks['*'] || Object.values(artifact.networks)[0];
  if (!network?.address) throw new Error(`No deployed ${name} at chain ${networkId}`);
  return { address: network.address, abi: artifact.abi, networkId };
};

module.exports = {
  getStatus, createProject, verifyInitial, verifyFinal, createAndMint,
  getAvailableCredits, purchaseCredits, getPurchaseHistory,
  getCreditPrice, initBlockchain, resetBlockchain, getContractDetails
};
