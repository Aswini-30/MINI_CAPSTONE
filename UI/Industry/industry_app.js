/**
 * industry_app.js – MintCarbon Industry Dashboard
 * FIXED: proper purchase flow, blockchain status, purchase history
 */

const API          = 'http://localhost:5000/api/blockchain';
const PROJECTS_API = 'http://localhost:5000/api/projects';

// ─── Session ──────────────────────────────────────────────────────────────────
let session = {
  walletAddress: localStorage.getItem('ind_wallet')  || '',
  privateKey:    localStorage.getItem('ind_key')     || '',
  companyName:   localStorage.getItem('ind_company') || ''
};

let allProjects    = [];
let creditPriceWei = 1000000000000000; // 0.001 ETH default

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (!session.walletAddress || !session.privateKey) {
    document.getElementById('loginOverlay').classList.add('open');
  } else {
    startDashboard();
  }

  document.querySelectorAll('.sidebar nav a[data-section]').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      navigate(link.dataset.section);
    });
  });

  document.getElementById('logoutBtn').addEventListener('click', doLogout);
});

// ─── Login / Logout ───────────────────────────────────────────────────────────
function doLogin() {
  const wallet  = document.getElementById('loginWallet').value.trim();
  const key     = document.getElementById('loginKey').value.trim();
  const company = document.getElementById('loginCompany').value.trim() || 'Industry User';

  if (!wallet || !key) { toast('Please enter wallet address and private key', 'error'); return; }
  if (!wallet.startsWith('0x')) { toast('Wallet address must start with 0x', 'error'); return; }
  if (!key.startsWith('0x'))   { toast('Private key must start with 0x', 'error');     return; }

  session = { walletAddress: wallet, privateKey: key, companyName: company };
  localStorage.setItem('ind_wallet',  wallet);
  localStorage.setItem('ind_key',     key);
  localStorage.setItem('ind_company', company);
  document.getElementById('loginOverlay').classList.remove('open');
  startDashboard();
}

function doLogout() {
  localStorage.removeItem('ind_wallet');
  localStorage.removeItem('ind_key');
  localStorage.removeItem('ind_company');
  location.reload();
}

// ─── Start Dashboard ──────────────────────────────────────────────────────────
async function startDashboard() {
  document.getElementById('companyName').textContent   = session.companyName || 'Industry Dashboard';
  document.getElementById('walletDisplay').textContent = shortAddr(session.walletAddress);
  await checkChain();
  await loadCreditPrice();
  await loadOverview();
  await loadMarketplace();
}

// ─── Navigation ───────────────────────────────────────────────────────────────
function navigate(section) {
  document.querySelectorAll('.sidebar nav a').forEach(a => a.classList.remove('active'));
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));

  const link = document.querySelector(`.sidebar nav a[data-section="${section}"]`);
  const sec  = document.getElementById(section);
  if (link) link.classList.add('active');
  if (sec)  sec.classList.add('active');

  if (section === 'marketplace') loadMarketplace();
  if (section === 'purchases')   loadPurchaseHistory();
  if (section === 'blockchain')  loadBlockchainStatus();
}

// ─── Blockchain Chain Status ──────────────────────────────────────────────────
async function checkChain() {
  const dot  = document.getElementById('chainDot');
  const text = document.getElementById('chainStatusText');
  try {
    const r = await apiFetch(`${API}/status`);
    if (r.success) {
      dot.classList.remove('offline');
      text.textContent = `Block #${r.blockNumber} | Net ${r.networkId}`;
    } else throw new Error(r.error);
  } catch (err) {
    dot.classList.add('offline');
    text.textContent = 'Blockchain offline';
  }
}

async function loadBlockchainStatus() {
  const el = document.getElementById('blockchainInfo');
  el.innerHTML = '<div class="loading-card"><i class="icon">⏳</i><p>Fetching blockchain info…</p></div>';
  try {
    const r = await apiFetch(`${API}/status`);
    if (!r.success) throw new Error(r.error);
    el.innerHTML = `
      <div class="bc-grid">
        <div class="card" style="margin:0;background:#eafaf1">
          <h4 style="color:#27ae60">✅ Connected</h4>
          <p style="font-size:.85rem;color:#555">Ganache node is online</p>
        </div>
        <div class="card" style="margin:0">
          <h4>Block Number</h4>
          <p style="font-size:1.4rem;font-weight:700;color:#3498db">#${r.blockNumber}</p>
        </div>
        <div class="card" style="margin:0">
          <h4>Network ID</h4>
          <p style="font-size:1.2rem;font-weight:700">${r.networkId}</p>
        </div>
        <div class="card" style="margin:0">
          <h4>RPC URL</h4>
          <p style="font-size:.82rem;font-family:monospace">${r.rpcUrl}</p>
        </div>
      </div>
      <div class="card">
        <h4>📜 Contract Addresses</h4>
        <div style="display:flex;flex-direction:column;gap:.5rem;font-size:.85rem;margin-top:.5rem">
          <div style="display:flex;justify-content:space-between;padding:.5rem;background:#f8f9fa;border-radius:8px">
            <span style="font-weight:600">CarbonCreditSystem</span>
            <span style="font-family:monospace;color:#3498db">${r.contracts?.CarbonCreditSystem || 'N/A'}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:.5rem;background:#f8f9fa;border-radius:8px">
            <span style="font-weight:600">CarbonCreditToken</span>
            <span style="font-family:monospace;color:#3498db">${r.contracts?.CarbonCreditToken || 'N/A'}</span>
          </div>
        </div>
      </div>`;
  } catch (err) {
    el.innerHTML = `<div class="card" style="color:#e74c3c">
      <h4>❌ Blockchain Offline</h4>
      <p style="margin-top:.5rem">${err.message}</p>
      <p style="margin-top:.5rem;font-size:.82rem">Make sure Ganache is running on port 7545 and contracts are deployed (truffle migrate).</p>
    </div>`;
  }
}

// ─── Credit Price ─────────────────────────────────────────────────────────────
async function loadCreditPrice() {
  try {
    const r = await apiFetch(`${API}/credit-price`);
    if (r.success) {
      creditPriceWei = Number(r.priceWei);
      document.getElementById('pricePerCredit').textContent = `${r.priceEth} ETH`;
    }
  } catch (_) {}
}

function calcCost() {
  const amt   = parseFloat(document.getElementById('purchaseAmount').value) || 0;
  const total = (amt * creditPriceWei / 1e18).toFixed(4);
  document.getElementById('totalCostDisplay').textContent = `${total} ETH`;
}

// ─── Overview ─────────────────────────────────────────────────────────────────
async function loadOverview() {
  try {
    const [projR, histR] = await Promise.all([
      apiFetch('http://localhost:5000/api/projects/verified'),
      apiFetch(`${API}/purchase-history/${session.walletAddress}`)
    ]);
    console.log('✅ Overview projects API response:', projR);
    const projects = projR.success ? projR.data : [];
    const history  = histR.success ? histR.data : [];

    document.getElementById('statProjects').textContent  = projects.length;
    document.getElementById('statPurchases').textContent = history.length;

    const totalCredits = history.reduce((s, h) => s + (h.creditsAmount || 0), 0);
    const totalEth     = history.reduce((s, h) => s + (h.totalPaid    || 0), 0);
    document.getElementById('statTotal').textContent = totalCredits;
    document.getElementById('statEth').textContent   = (totalEth / 1e18).toFixed(4);

    renderRecentPurchases(history.slice(0, 5));
  } catch (err) {
    console.error('loadOverview error:', err.message);
  }
}

function renderRecentPurchases(list) {
  const tbody = document.getElementById('recentPurchasesTbody');
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state"><i class="icon">📥</i><p>No purchases yet. Go to Marketplace!</p></td></tr>';
    return;
  }
  tbody.innerHTML = list.map(p => `
    <tr>
      <td>${p.projectName || 'Project'}</td>
      <td><strong>${p.creditsAmount}</strong> tCO₂</td>
      <td class="tx-hash" title="${p.txHash}" onclick="copyTx('${p.txHash}')">${shortAddr(p.txHash, 14)}</td>
      <td>${fmtDate(p.createdAt)}</td>
      <td><span class="status-pill status-${(p.status || 'completed').toLowerCase()}">${p.status || 'COMPLETED'}</span></td>
    </tr>`).join('');
}

// ─── Marketplace ──────────────────────────────────────────────────────────────
async function loadMarketplace() {
  const grid = document.getElementById('marketplaceGrid');
  grid.innerHTML = '<div class="loading-card"><i class="icon">⏳</i><p>Loading verified projects…</p></div>';
  try {
    const r = await apiFetch('http://localhost:5000/api/projects/verified');
    console.log('✅ Marketplace API response:', r);
    if (!r.success) throw new Error(r.error || 'Failed to load projects');
    allProjects = r.data || [];
    document.getElementById('statProjects').textContent = allProjects.length;
    populateStateFilter();
    renderProjects(allProjects);
  } catch (err) {
    console.error('Marketplace load error:', err);
    grid.innerHTML = `<div class="loading-card" style="color:#e74c3c">
      <i class="icon">❌</i>
      <p>Error loading projects: ${err.message}</p>
      <button class="btn btn-outline" style="margin-top:1rem" onclick="loadMarketplace()">🔄 Retry</button>
    </div>`;
  }
}

function populateStateFilter() {
  const sel    = document.getElementById('filterState');
  const states = [...new Set(allProjects.map(p => p.state).filter(Boolean))];
  sel.innerHTML = '<option value="">All States</option>' +
    states.map(s => `<option value="${s}">${s}</option>`).join('');
}

function filterProjects() {
  const q      = document.getElementById('searchInput').value.toLowerCase();
  const state  = document.getElementById('filterState').value;
  const filtered = allProjects.filter(p => {
    const matchQ = !q || (p.projectName || '').toLowerCase().includes(q) ||
                   (p.description || '').toLowerCase().includes(q) ||
                   (p.district    || '').toLowerCase().includes(q);
    const matchS = !state || p.state === state;
    return matchQ && matchS;
  });
  renderProjects(filtered);
}

function renderProjects(list) {
  const grid = document.getElementById('marketplaceGrid');
  // Hide projects with no remaining credits (fully purchased)
  const available = list.filter(p => Number(p.creditsAvailable || 0) > 0);
  if (!available.length) {
    grid.innerHTML = '<div class="loading-card"><i class="icon">🔍</i><p>No projects found</p></div>';
    return;
  }
  grid.innerHTML = available.map(p => {
    const projectNameSafe = (p.projectName || p.title || 'Project').replace(/'/g, "\\'");
    return `
    <div class="project-card">
      <div class="project-card-header">
        <h4>${p.projectName || p.title || 'Unnamed Project'}</h4>
        <span class="badge badge-green">✓ Verified</span>
      </div>
      <div class="project-meta">
        <div class="meta-item"><strong>${p.state || 'N/A'}</strong>State</div>
        <div class="meta-item"><strong>${p.district || 'N/A'}</strong>District</div>
        <div class="meta-item"><strong>${p.projectType || 'Carbon'}</strong>Type</div>
        <div class="meta-item"><strong>${p.saplingsPlanted || 'N/A'}</strong>Saplings</div>
      </div>
      <div class="credits-highlight">
        <div>
          <div class="credit-lbl">Available Credits</div>
          <div class="credit-num">${Number(p.creditsAvailable || 0).toFixed(2)} tCO₂</div>
        </div>
        <div style="text-align:right">
          <div class="credit-lbl">Price Each</div>
          <div style="font-size:1rem;font-weight:600;color:#3498db">${(creditPriceWei / 1e18)} ETH</div>
        </div>
      </div>
      ${p.description ? `<p style="font-size:.82rem;color:#7f8c8d">${p.description.slice(0,120)}${p.description.length > 120 ? '…' : ''}</p>` : ''}
      ${p.txHash ? `<div style="font-size:.75rem;color:#aaa">⛓ On-chain: ${shortAddr(p.txHash, 16)}</div>` : ''}
      <button class="buy-btn" onclick="openPurchaseModal('${p._id}', '${projectNameSafe}', ${Number(p.creditsAvailable || 0).toFixed(2)})">
        🛒 Purchase Credits
      </button>
    </div>`;
  }).join('');
}

// ─── Purchase Flow ────────────────────────────────────────────────────────────
function openPurchaseModal(projectId, projectName, creditsAvailable) {
  document.getElementById('purchaseProjectId').value = projectId;
  document.getElementById('purchaseAmount').value    = '';
  document.getElementById('purchaseKey').value       = session.privateKey || '';
  document.getElementById('totalCostDisplay').textContent = '0.0000 ETH';
  document.getElementById('purchaseBanner').innerHTML = `
    <h4>🌳 ${projectName}</h4>
    <p>Available credits: <strong>${creditsAvailable} tCO₂</strong> &nbsp;|&nbsp; Your wallet: <code>${shortAddr(session.walletAddress)}</code></p>`;
  document.getElementById('purchaseModal').classList.add('open');
}

function closePurchaseModal() {
  document.getElementById('purchaseModal').classList.remove('open');
}

async function confirmPurchase() {
  const projectId     = document.getElementById('purchaseProjectId').value;
  const creditsAmount = parseFloat(document.getElementById('purchaseAmount').value);
  const buyerPrivKey  = document.getElementById('purchaseKey').value.trim();

  if (!creditsAmount || creditsAmount <= 0) { toast('Enter a valid credit amount', 'error'); return; }
  if (!buyerPrivKey)                         { toast('Private key is required', 'error');     return; }
  if (!buyerPrivKey.startsWith('0x'))        { toast('Private key must start with 0x', 'error'); return; }

  const btn = document.getElementById('confirmPurchaseBtn');
  btn.disabled     = true;
  btn.textContent  = '⏳ Processing…';

  try {
    const r = await apiFetch(`${API}/purchase-credits`, 'POST', {
      projectId,
      creditsAmount,
      buyerAddress:    session.walletAddress,
      buyerPrivateKey: buyerPrivKey
    });

    if (!r.success) throw new Error(r.error || 'Purchase failed');

    closePurchaseModal();
    showSuccess(r, creditsAmount);

    // Refresh stats
    await loadOverview();
    await loadMarketplace();

  } catch (err) {
    showError(err.message);
  } finally {
    btn.disabled    = false;
    btn.textContent = '✅ Confirm Purchase';
  }
}

function showSuccess(r, credits) {
  document.getElementById('successDetail').innerHTML = `
    <div class="detail-row"><span class="detail-key">Credits Purchased</span><span class="detail-value">${credits} tCO₂</span></div>
    <div class="detail-row"><span class="detail-key">Total Paid</span><span class="detail-value">${r.data?.totalPaid || '–'}</span></div>
    <div class="detail-row"><span class="detail-key">Tx Hash</span><span class="detail-value" style="color:#3498db">${r.data?.transactionHash || '–'}</span></div>
    <div class="detail-row"><span class="detail-key">Block Number</span><span class="detail-value">${r.data?.blockNumber || '–'}</span></div>
    <div class="detail-row"><span class="detail-key">Purchase ID</span><span class="detail-value">${r.data?.purchaseId || '–'}</span></div>`;
  document.getElementById('successModal').classList.add('open');
}

function closeSuccessModal() {
  document.getElementById('successModal').classList.remove('open');
}

function showError(msg) {
  document.getElementById('errorMsg').textContent = msg;
  document.getElementById('errorModal').classList.add('open');
}

function closeErrorModal() {
  document.getElementById('errorModal').classList.remove('open');
}

// ─── Purchase History ─────────────────────────────────────────────────────────
async function loadPurchaseHistory() {
  const tbody = document.getElementById('purchasesTbody');
  tbody.innerHTML = '<tr><td colspan="8" class="empty-state"><i class="icon">⏳</i><p>Loading…</p></td></tr>';
  try {
    const r = await apiFetch(`${API}/purchase-history/${session.walletAddress}`);
    if (!r.success) throw new Error(r.error);
    const list = r.data || [];
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="empty-state"><i class="icon">📥</i><p>No purchases yet. Go to Marketplace to buy credits!</p></td></tr>';
      return;
    }
    tbody.innerHTML = list.map((p, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${p.projectName || 'Project'}</td>
        <td><strong>${p.creditsAmount}</strong> tCO₂</td>
        <td>${(p.totalPaid / 1e18).toFixed(4)} ETH</td>
        <td class="tx-hash" title="${p.txHash}" onclick="copyTx('${p.txHash}')">${shortAddr(p.txHash, 14)}</td>
        <td>${p.blockNumber || '–'}</td>
        <td>${fmtDate(p.createdAt)}</td>
        <td><span class="status-pill status-${(p.status || 'completed').toLowerCase()}">${p.status || 'COMPLETED'}</span></td>
      </tr>`).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty-state" style="color:#e74c3c"><i class="icon">❌</i><p>${err.message}</p></td></tr>`;
  }
}

// ─── Utilities ────────────────────────────────────────────────────────────────
async function apiFetch(url, method = 'GET', body = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res  = await fetch(url, opts);
  const data = await res.json();
  if (!res.ok && !data.success) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

function shortAddr(addr, len = 10) {
  if (!addr) return '–';
  if (addr.length <= len) return addr;
  return addr.slice(0, Math.ceil(len / 2)) + '…' + addr.slice(-4);
}

function fmtDate(d) {
  if (!d) return '–';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function copyTx(hash) {
  navigator.clipboard.writeText(hash).then(() => toast('Tx hash copied!', 'info'));
}

function toast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  document.getElementById('toastContainer').appendChild(el);
  setTimeout(() => el.remove(), 3500);
}
