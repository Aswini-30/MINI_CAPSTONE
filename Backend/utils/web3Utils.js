const Web3 = require('web3');

/**
 * Enhanced transaction sender with revert reason capture
 * Fixes gas estimation by calling static first, then catching exact revert
 */
const sendTxWithRevertReason = async (web3, contractMethod, privateKey, label, valueWei = null) => {
  const account = web3.eth.accounts.privateKeyToAccount(privateKey);
  const from = account.address;
  
  console.log(`📤 [${label}] from: ${from}`);

  // 1. Static call first to capture revert reason
  try {
    await contractMethod.call({ from, value: valueWei });
    console.log(`✅ [${label}] static call succeeded`);
  } catch (staticErr) {
    throw new Error(`[${label}] Revert reason (static call): ${staticErr.message}`);
  }

  // 2. Gas estimation with detailed error
  const estimateOpts = { from, value: valueWei };
  let gas;
  try {
    const est = await contractMethod.estimateGas(estimateOpts);
    gas = Math.floor(Number(est) * 1.3);
    console.log(`⛽ [${label}] gas estimated: ${est.toLocaleString()}, using: ${gas.toLocaleString()}`);
  } catch (gasErr) {
    console.error(`💥 [${label}] Gas estimation FAILED:`, gasErr.message);
    
    // Parse common Solidity errors
    if (gasErr.message.includes('execution reverted')) {
      const reasonMatch = gasErr.message.match(/execution reverted: (.*?)'/);
      const reason = reasonMatch ? reasonMatch[1] : 'Unknown reason';
      throw new Error(`[${label}] REVERT: ${reason}`);
    }
    
    throw new Error(`[${label}] Gas estimation failed: ${gasErr.message}`);
  }

  // 3. Send transaction
  const gasPrice = await web3.eth.getGasPrice();
  const txOpts = { from, gas, gasPrice };
  if (valueWei) txOpts.value = valueWei;

  try {
    const receipt = await contractMethod.send(txOpts);
    console.log(`✅ [${label}] SUCCESS tx: ${receipt.transactionHash}`);
    return {
      transactionHash: receipt.transactionHash,
      blockNumber: Number(receipt.blockNumber),
      gasUsed: Number(receipt.gasUsed),
      from: receipt.from
    };
  } catch (txErr) {
    console.error(`💥 [${label}] Transaction FAILED:`, txErr.message);
    throw new Error(`[${label}] Tx failed: ${txErr.message}`);
  }
};

module.exports = { sendTxWithRevertReason };

