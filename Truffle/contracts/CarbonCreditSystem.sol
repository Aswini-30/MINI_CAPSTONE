// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./CarbonCreditToken.sol";
import "./CarbonProjectNFT.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract CarbonCreditSystem is Ownable, ReentrancyGuard {

    CarbonCreditToken public carbonToken;
    CarbonProjectNFT  public projectNFT;

    uint256 public creditPrice = 0.001 ether;

    struct Project {
        uint256 projectId;
        string  projectName;
        address ngoDeveloper;
        uint256 carbonAmount;
        uint256 creditsIssued;
        string  ipfsHash;
        uint256 mintedAt;
        uint256 nftTokenId;
    }

    mapping(uint256 => Project) public projects;
    mapping(address => uint256[]) public ngoProjects;

    event ProjectCreatedAndMinted(uint256 indexed projectId, address indexed ngo, uint256 credits, uint256 nftTokenId);

    constructor(address _token, address _nft) {
        carbonToken = CarbonCreditToken(_token);
        projectNFT  = CarbonProjectNFT(_nft);
    }

    /**
     * 🎯 SINGLE STEP: Create project + mint credits + NFT in ONE transaction
     * No multi-step verification needed
     */
function createProjectAndMint(
        uint256 _projectId,
        string memory _projectName,
        address _ngoDeveloper,
        uint256 _carbonAmount,
        string memory _ipfsHash
    ) public {
        require(projects[_projectId].projectId == 0, "Project already exists");
        require(_carbonAmount >= 1 ether, "carbonAmount must be >= 1 ether");
        require(_ngoDeveloper != address(0), "NGO address cannot be zero");

        // Mint NFT - CarbonCreditSystem has MINTER_ROLE
        uint256 nftId = projectNFT.mintProjectNFT(_ngoDeveloper);

        // Mint carbon credits - CarbonCreditSystem has MINTER_ROLE
        carbonToken.mintCredits(_ngoDeveloper, _carbonAmount);

        // Store project data
        Project storage project = projects[_projectId];
        project.projectId = _projectId;
        project.projectName = _projectName;
        project.ngoDeveloper = _ngoDeveloper;
        project.carbonAmount = _carbonAmount;
        project.creditsIssued = _carbonAmount;
        project.ipfsHash = _ipfsHash;
        project.mintedAt = block.timestamp;
        project.nftTokenId = nftId;

        ngoProjects[_ngoDeveloper].push(_projectId);

        emit ProjectCreatedAndMinted(_projectId, _ngoDeveloper, _carbonAmount, nftId);
    }


    function purchaseCredits(uint256 amount) public payable nonReentrant {
        require(amount > 0, "Amount must be > 0");
        require(msg.value >= amount * creditPrice, "Insufficient ETH payment");
        uint256 tokenAmount = amount * 10**18;
        if (carbonToken.balanceOf(address(this)) >= tokenAmount) {
            carbonToken.transfer(msg.sender, tokenAmount);
        } else {
            carbonToken.mintCredits(msg.sender, tokenAmount);
        }
        emit CreditsTransferred(msg.sender, amount);
    }

    function setCreditPrice(uint256 price) public onlyOwner { creditPrice = price; }
    function withdraw() public onlyOwner { payable(owner()).transfer(address(this).balance); }
    
    event CreditsTransferred(address indexed buyer, uint256 amount);
}
