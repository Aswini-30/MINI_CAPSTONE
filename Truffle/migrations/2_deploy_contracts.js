const CarbonCreditToken = artifacts.require("CarbonCreditToken");
const CarbonProjectNFT = artifacts.require("CarbonProjectNFT");
const CarbonCreditSystem = artifacts.require("CarbonCreditSystem");

module.exports = async function (deployer, network, accounts) {
  console.log("🚀 Deploying contracts...");
  console.log("Network:", network);
  console.log("Deployer (account[0]):", accounts[0]);

  // 1. Deploy Token
  await deployer.deploy(CarbonCreditToken);
  const token = await CarbonCreditToken.deployed();
  console.log("✅ CarbonCreditToken deployed:", token.address);

  // 2. Deploy NFT
  await deployer.deploy(CarbonProjectNFT);
  const nft = await CarbonProjectNFT.deployed();
  console.log("✅ CarbonProjectNFT deployed:", nft.address);

  // 3. Deploy System
  await deployer.deploy(CarbonCreditSystem, token.address, nft.address);
  const system = await CarbonCreditSystem.deployed();
  console.log("✅ CarbonCreditSystem deployed:", system.address);

  // 4. Grant MINTER_ROLE to CarbonCreditSystem
  console.log("\n🔑 Granting MINTER_ROLE to CarbonCreditSystem...");
  
  // Grant MINTER_ROLE to system contract in Token
  await token.grantRole(await token.MINTER_ROLE(), system.address);
  console.log("✅ Token MINTER_ROLE granted to system:", system.address);

  // Grant MINTER_ROLE to system contract in NFT  
  await nft.grantRole(await nft.MINTER_ROLE(), system.address);
  console.log("✅ NFT MINTER_ROLE granted to system:", system.address);

  // 5. Verify roles
  const tokenMinterRole = await token.hasRole(await token.MINTER_ROLE(), system.address);
  const nftMinterRole = await nft.hasRole(await nft.MINTER_ROLE(), system.address);
  
  console.log("\n📊 Role Verification:");
  console.log("Token MINTER_ROLE for system:", tokenMinterRole);
  console.log("NFT MINTER_ROLE for system:", nftMinterRole);
  
  if (tokenMinterRole && nftMinterRole) {
    console.log("\n🎉 DEPLOYMENT COMPLETE - MINTER ROLES ASSIGNED!");
  } else {
    console.log("\n❌ Role assignment failed!");
  }
};

