# MCP_Final – BlueCarbonMRV Complete Fixed Project 🌿

## 🔧 All Bugs Fixed

### 🔴 PRIMARY BUG: "Project in CREATED state" / Gas Estimation Failure

**Root Cause (confirmed from server logs):**

The initial submission has `_id = 69df1c3d...b48c52` → blockchain ID = **11,832,402**
The final submission has `_id = 69df1c5e...b48c97` → blockchain ID = **11,832,471** ← DIFFERENT!

Both belong to the **same project** (`projectId = 69df18a2...d2cb`) but because blockchain ID
was derived from `submission._id` (different per submission), final verification looked for
a project that didn't exist on-chain → "Project in CREATED state" error.

**Fix:** Blockchain project ID is now derived from `submission.projectId` (the Project document
_id), which is **identical** for both initial and final submissions of the same project.

| Lookup Priority | Source | Result |
|---|---|---|
| 1st | `submission.blockchain.projectIdOnChain` (stored from initial run) | Reuses exact value |
| 2nd | `Project.blockchainProjectId` (stored in Project document) | Reuses stored value |
| 3rd | `submission.projectId.slice(-6)` hex → integer | Consistent fallback |

With this fix: both initial and final use **578251** (from `69df18a2...d2cb`) ✅

---

### 🔴 Secondary Bug: carbonAmount = 0 → mint reverts

**Fix:** `Math.max(1, carbonCredits)` in submissionController + `safeAmount` guard in Solidity

### 🎨 Industry Dashboard Redesign

Matches NGO + Panchayat design (same sidebar gradient, stat cards, tables, modals).
Full working purchase flow: Marketplace → Select project → Enter amount → Confirm → Receipt.

---

## 🚀 Setup & Run

### 1. Start Ganache GUI
- Port: **7545**, note Account[0] private key → paste in `.env` as `OWNER_PRIVATE_KEY`

### 2. Deploy Contracts (MUST re-deploy after contract fix)
```bash
cd Truffle
npm install
truffle migrate --network development --reset
```

### 3. Start Backend
```bash
cd Backend
npm install
node server.js
```

### 4. Open UI in browser
- `UI/Login/Login.html` — Login page
- `UI/NGO/Dashboardngo.html` — NGO Dashboard
- `UI/Panchayat/Dashboardpanchayat.html` — Verifier Dashboard
- `UI/Industry/DashboardIndustry.html` — Industry Buyer Dashboard

---

## ✅ Complete Workflow

```
1. Panchayat creates project
2. NGO submits INITIAL data (photo + GPS + saplings)
   → Backend: blockchain ID derived from projectId (e.g. 578251)
   → Chain: createProject(578251) + verifyInitial(578251) ✅
   → Project.blockchainProjectId = 578251 (saved)
3. NGO submits FINAL data
   → Backend: reads blockchainProjectId=578251 from Project doc
   → Chain: verifyFinalAndMint(578251) ✅ (status was INITIAL_VERIFIED → ok)
   → NFT minted to NGO + CCT tokens minted
4. Industry: Marketplace → Buy Credits → Pay ETH → Get CCT tokens ✅
```
