
// Panchayat Dashboard JavaScript
// API Base URL
const API_BASE = 'http://localhost:5000/api';

// State variables
let currentWalletAddress = '';
let pendingProjects = [];
let approvedProjects = [];
let rejectedProjects = [];
let selectedProjectId = null;

// Initialize on page load
window.addEventListener('load', () => {
  // Check authentication
  const wallet = localStorage.getItem('wallet') || localStorage.getItem('walletAddress');
  if (!wallet) {
    window.location.href = '../Login/login.html';
    return;
  }
  
  currentWalletAddress = wallet;
  
  // Check role - should be Panchayat
  const role = localStorage.getItem(`role_${wallet}`) || localStorage.getItem('role');
  if (role !== 'Panchayat' && role !== 'panchayat') {
    alert('Access denied. Only Panchayat users can access this dashboard.');
    window.location.href = '../Login/login.html';
    return;
  }
  
  // Load all data
  loadAllData();
  
  // Load notifications and profile
  loadNotifications();
  loadProfile();
  
  // Set up profile form submission
  document.getElementById('profileForm').addEventListener('submit', handleProfileSubmit);
});

// Load all dashboard data
async function loadAllData() {
  await Promise.all([
    loadPendingProjects(),
    loadApprovedProjects(),
    loadRejectedProjects()
  ]);
  updateNotificationBadge();
  updateOverviewStats();
}

/**
 * Load pending projects from API
 * Now uses submissions API to get pending submissions for verification
 */
async function loadPendingProjects() {
  try {
    // Call the submissions/pending API which returns submissions with PENDING_INITIAL_VERIFICATION or PENDING_FINAL_VERIFICATION status
    const response = await fetch(`${API_BASE}/submissions/pending`);
    const result = await response.json();
    
    if (result.success) {
      pendingProjects = result.data;
      renderPendingProjects();
      updateCounts();
    }
  } catch (error) {
    console.error('Error loading pending projects:', error);
    showToast('Error loading pending projects. Please check if the backend server is running.', 'error');
  }
}

/**
 * Load approved projects from API
 */
async function loadApprovedProjects() {
  try {
    // Load submissions with APPROVED status from submissions collection
    const response = await fetch(`${API_BASE}/submissions?status=APPROVED`);
    const result = await response.json();
    
    if (result.success) {
      approvedProjects = result.data || [];
      renderApprovedProjects();
      updateCounts();
    }
  } catch (error) {
    console.error('Error loading approved projects:', error);
  }
}

/**
 * Load rejected projects from API
 */
async function loadRejectedProjects() {
  try {
    // Load submissions with REJECTED status from submissions collection
    const response = await fetch(`${API_BASE}/submissions?status=REJECTED`);
    const result = await response.json();
    
    if (result.success) {
      rejectedProjects = result.data || [];
      renderRejectedProjects();
      updateCounts();
    }
  } catch (error) {
    console.error('Error loading rejected projects:', error);
  }
}

/**
 * Update overview stats
 */
function updateOverviewStats() {
  document.getElementById('overviewPending').textContent = pendingProjects.length;
  document.getElementById('overviewApproved').textContent = approvedProjects.length;
  document.getElementById('overviewRejected').textContent = rejectedProjects.length;
  document.getElementById('overviewTotal').textContent = pendingProjects.length + approvedProjects.length + rejectedProjects.length;
}

/**
 * Render pending projects in the UI with full details for Panchayat verification
 */
function renderPendingProjects() {
  const container = document.getElementById('pendingProjects');
  
  if (pendingProjects.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📋</div>
        <h4>No Pending Submissions</h4>
        <p>There are no projects waiting for verification.</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = pendingProjects.map(project => {
    // Use projectDetails from API response (populated from projectId)
    const projectDetails = project.projectDetails || null;
    const ngoDetails = project.ngoDetails || null;
    
    // Build comprehensive verification details
    const projectName = projectDetails?.name || project.project || project.projectName || project.name || project.title || 'Untitled Project';
    const projectState = projectDetails?.state || project.state || 'N/A';
    const projectDistrict = projectDetails?.district || project.district || 'N/A';
    const projectPanchayat = projectDetails?.panchayat || project.panchayat || 'N/A';
    const projectType = projectDetails?.projectType || project.projectType || project.type || 'N/A';
    
    // Get plantation data from submission
    const areaCovered = project.areaCovered || 'N/A';
    const saplingsPlanted = project.saplingsPlanted || 'N/A';
    const speciesType = project.speciesType || 'N/A';
    const ipfsHash = project.ipfsHash || project.ipfsUrl || 'N/A';
    const latitude = project.latitude || 'N/A';
    const longitude = project.longitude || 'N/A';
    const carbonAmount = project.carbonAmount || '0';
    
    // Get submitted by info from ngoDetails
    // FIX: fallback chain now includes project.submittedBy which is stored directly
    const submittedBy = ngoDetails?.walletAddress || project.submittedBy || project.walletAddress || ngoDetails?.name || 'N/A';
    
    // Build IPFS link if available
    let ipfsLink = '';
    if (ipfsHash && ipfsHash !== 'N/A') {
      if (ipfsHash.startsWith('http')) {
        ipfsLink = `<a href="${ipfsHash}" target="_blank" class="ipfs-link">📄 View Document</a>`;
      } else {
        ipfsLink = `<a href="https://gateway.pinata.cloud/ipfs/${ipfsHash}" target="_blank" class="ipfs-link">📄 View Document</a>`;
      }
    }
    
    return `
      <div class="project-card" id="project-${project.id}" style="padding: 20px; margin-bottom: 20px; border: 1px solid #ddd; border-radius: 8px; background: #fff;">
        <span class="status-badge pending" style="display: inline-block; padding: 4px 12px; background: #f59e0b; color: white; border-radius: 20px; font-size: 12px; margin-bottom: 10px;">Pending Verification</span>
        
        <h3 style="margin: 10px 0; color: #1f2937;">${projectName}</h3>
        
        <!-- Project Information Section -->
        <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 15px 0;">
          <h4 style="margin: 0 0 12px 0; color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">📋 Project Information</h4>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; font-size: 14px;">
            <div><strong>State:</strong> ${projectState}</div>
            <div><strong>District:</strong> ${projectDistrict}</div>
            <div><strong>Panchayat:</strong> ${projectPanchayat}</div>
            <div><strong>Project Type:</strong> ${projectType}</div>
          </div>
        </div>
        
        <!-- Plantation Data Section -->
        <div style="background: #ecfdf5; padding: 15px; border-radius: 8px; margin: 15px 0;">
          <h4 style="margin: 0 0 12px 0; color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">🌱 Plantation Data</h4>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; font-size: 14px;">
            <div><strong>Area Covered:</strong> ${areaCovered} sq units</div>
            <div><strong>Saplings Planted:</strong> ${saplingsPlanted}</div>
            <div><strong>Species Type:</strong> ${speciesType}</div>
            <div><strong>Carbon Amount:</strong> ${carbonAmount} tCO2e</div>
          </div>
        </div>
        
        <!-- Location Data Section -->
        <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 15px 0;">
          <h4 style="margin: 0 0 12px 0; color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">📍 Location Coordinates</h4>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; font-size: 14px;">
            <div><strong>Latitude:</strong> ${latitude}</div>
            <div><strong>Longitude:</strong> ${longitude}</div>
          </div>
        </div>
        
        <!-- Document Section -->
        <div style="background: #e0e7ff; padding: 15px; border-radius: 8px; margin: 15px 0;">
          <h4 style="margin: 0 0 12px 0; color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">📄 Supporting Document</h4>
          <div>${ipfsLink || 'No document uploaded'}</div>
        </div>
        
        <!-- Submission Info -->
        <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e5e7eb;">
          <p style="margin: 5px 0;"><strong>Submitted By:</strong> <span class="wallet-address">${submittedBy}</span></p>
          <p style="margin: 5px 0;"><strong>Submitted On:</strong> ${formatDate(project.createdAt)}</p>
          <p style="margin: 5px 0;"><strong>Submission Type:</strong> ${project.submissionType || 'N/A'}</p>
        </div>
        
        <!-- Action Buttons -->
        <div class="action-buttons" style="margin-top: 20px; display: flex; gap: 10px;">
          <button class="btn-approve" onclick="approveProject('${project.id}')" style="flex: 1; padding: 12px 20px; background: #10b981; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 600;">
            ✓ Approve Project
          </button>
          <button class="btn-reject" onclick="openRejectModal('${project.id}')" style="flex: 1; padding: 12px 20px; background: #ef4444; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 600;">
            ✗ Reject Project
          </button>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Render approved projects in the UI
 */
function renderApprovedProjects() {
  const container = document.getElementById('approvedProjects');
  
  if (approvedProjects.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">✓</div>
        <h4>No Approved Submissions</h4>
        <p>There are no approved projects yet.</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = approvedProjects.map(project => `
    <div class="project-card approved" id="project-${project.id || project._id}">
      <span class="status-badge approved">Approved</span>
      <h5>${project.title || project.projectName || project.project || 'Untitled Project'}</h5>
      ${project.description ? `<div class="project-description">${project.description}</div>` : ''}
      <p><strong>Submitted By:</strong></p>
      <div class="wallet-address">${project.submittedBy || project.walletAddress || 'N/A'}</div>
      ${project.ipfsHash ? `<p><a href="https://gateway.pinata.cloud/ipfs/${project.ipfsHash}" target="_blank" class="ipfs-link">📄 View Document</a></p>` : ''}
      <p><strong>Approved On:</strong> ${formatDate(project.verifiedAt)}</p>
      ${project.estimatedCredits ? `<p><strong>Estimated Credits:</strong> ${project.estimatedCredits} tCO2e</p>` : ''}
    </div>
  `).join('');
}

/**
 * Render rejected projects in the UI
 */
function renderRejectedProjects() {
  const container = document.getElementById('rejectedProjects');
  
  if (rejectedProjects.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">✗</div>
        <h4>No Rejected Submissions</h4>
        <p>There are no rejected projects.</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = rejectedProjects.map(project => `
    <div class="project-card rejected" id="project-${project.id || project._id}">
      <span class="status-badge rejected">Rejected</span>
      <h5>${project.title || project.projectName || project.project || 'Untitled Project'}</h5>
      ${project.description ? `<div class="project-description">${project.description}</div>` : ''}
      <p><strong>Submitted By:</strong></p>
      <div class="wallet-address">${project.submittedBy || project.walletAddress || 'N/A'}</div>
      ${project.ipfsHash ? `<p><a href="https://gateway.pinata.cloud/ipfs/${project.ipfsHash}" target="_blank" class="ipfs-link">📄 View Document</a></p>` : ''}
      <p><strong>Rejected On:</strong> ${formatDate(project.verifiedAt)}</p>
      ${project.rejectionReason || project.panchayatRemarks ? `
        <div class="rejection-reason">
          <strong>Rejection Reason:</strong>
          <p>${project.rejectionReason || project.panchayatRemarks}</p>
        </div>
      ` : ''}
    </div>
  `).join('');
}

/**
 * Update counts in tabs
 */
function updateCounts() {
  document.getElementById('pendingCount').textContent = pendingProjects.length;
  document.getElementById('approvedCount').textContent = approvedProjects.length;
  document.getElementById('rejectedCount').textContent = rejectedProjects.length;
}

/**
 * Update notification badge
 */
function updateNotificationBadge() {
  const badge = document.getElementById('sidebarBadge');
  const count = pendingProjects.length;
  
  if (count > 0) {
    badge.textContent = count;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

/**
 * Approve a project
 */
async function approveProject(projectId) {
  try {
    const response = await fetch(`${API_BASE}/submissions/${projectId}/verify`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'approve',
        verifiedBy: currentWalletAddress
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      // Remove from pending and add to approved
      const projectIndex = pendingProjects.findIndex(p => p.id === projectId);
      if (projectIndex > -1) {
        const [project] = pendingProjects.splice(projectIndex, 1);
        project.status = 'APPROVED';
        project.verifiedAt = new Date();
        approvedProjects.unshift(project);
      }
      
      // Re-render
      renderPendingProjects();
      renderApprovedProjects();
      updateCounts();
      updateNotificationBadge();
      updateOverviewStats();
      
      if (result.blockchainFailed) {
        // MongoDB saved but blockchain failed – show warning, not error
        showToast('✅ Approved in DB. ⚠️ Blockchain: ' + (result.blockchainError || 'failed – check Ganache'), 'warning');
        console.warn('Blockchain warning:', result.blockchainWarning);
      } else if (result.blockchain) {
        showToast('✅ Approved & stored on blockchain! Tx: ' + result.blockchain.transactionHash?.slice(0,18) + '…', 'success');
      } else {
        showToast('Project approved successfully!', 'success');
      }
    } else {
      showToast('Error: ' + result.message, 'error');
    }
  } catch (error) {
    console.error('Error approving project:', error);
    showToast('Error approving project. Please try again.', 'error');
  }
}

/**
 * Open rejection modal
 */
function openRejectModal(projectId) {
  selectedProjectId = projectId;
  document.getElementById('rejectionReason').value = '';
  document.getElementById('rejectionModal').classList.add('show');
}

/**
 * Close rejection modal
 */
function closeRejectModal() {
  document.getElementById('rejectionModal').classList.remove('show');
  selectedProjectId = null;
}

/**
 * Confirm rejection
 */
async function confirmReject() {
  const reason = document.getElementById('rejectionReason').value.trim();
  
  if (!reason) {
    showToast('Please enter a rejection reason.', 'error');
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE}/submissions/${selectedProjectId}/verify`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'reject',
        remarks: reason,
        verifiedBy: currentWalletAddress
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      closeRejectModal();
      
      // Remove from pending and add to rejected
      const projectIndex = pendingProjects.findIndex(p => p.id === selectedProjectId);
      if (projectIndex > -1) {
        const [project] = pendingProjects.splice(projectIndex, 1);
        project.status = 'REJECTED';
        project.rejectionReason = reason;
        project.verifiedAt = new Date();
        rejectedProjects.unshift(project);
      }
      
      // Re-render
      renderPendingProjects();
      renderRejectedProjects();
      updateCounts();
      updateNotificationBadge();
      updateOverviewStats();
      
      showToast('Project rejected successfully!', 'success');
    } else {
      showToast('Error: ' + result.message, 'error');
    }
  } catch (error) {
    console.error('Error rejecting project:', error);
    showToast('Error rejecting project. Please try again.', 'error');
  }
}

/**
 * Switch between tabs
 */
function switchTab(tabId) {
  // Update tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  
  // Update nav links
  document.querySelectorAll('.sidebar nav a').forEach(link => {
    link.classList.remove('active');
    if (link.getAttribute('href') === '#' + tabId) {
      link.classList.add('active');
    }
  });
  
  // Show/hide sections
  document.querySelectorAll('.section').forEach(section => {
    section.style.display = 'none';
  });
  document.getElementById(tabId).style.display = 'block';
  
  // Close dropdown if open
  document.getElementById('profileDropdown').classList.remove('show');
}

/**
 * Toggle profile dropdown menu
 */
function toggleProfileMenu() {
  document.getElementById('profileDropdown').classList.toggle('show');
}

/**
 * Show profile section
 */
function showProfile() {
  switchTab('profile');
}

/**
 * Close profile menu when clicking outside
 */
document.addEventListener('click', (e) => {
  const dropdown = document.querySelector('.sidebar-profile');
  if (dropdown && !dropdown.contains(e.target)) {
    document.getElementById('profileDropdown').classList.remove('show');
  }
});

/**
 * Logout function
 */
function logout() {
  if (window.ethereum) {
    try {
      ethereum.request({
        method: 'wallet_revokePermissions',
        params: [{ eth_accounts: {} }]
      });
    } catch (error) {
      console.log('Error revoking permissions:', error);
    }
  }
  localStorage.removeItem('wallet');
  localStorage.removeItem('walletAddress');
  localStorage.removeItem('role');
  window.location.href = '../Login/login.html';
}

/**
 * Show toast notification
 */
function showToast(message, type) {
  // Remove existing toast
  const existingToast = document.getElementById('toast');
  if (existingToast) {
    existingToast.remove();
  }
  
  const toast = document.createElement('div');
  toast.id = 'toast';
  toast.className = 'toast ' + type;
  toast.textContent = message;
  
  document.body.appendChild(toast);
  
  // Auto remove after 3 seconds
  setTimeout(() => {
    toast.remove();
  }, 3000);
}

/**
 * Format date
 */
function formatDate(dateString) {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Load notifications for Panchayat
 */
async function loadNotifications() {
  try {
    const allProjects = [...pendingProjects, ...approvedProjects, ...rejectedProjects];
    const notifications = [];
    const seenStatuses = JSON.parse(localStorage.getItem('seenPanchayatStatuses') || '{}');
    
    allProjects.forEach(project => {
      const previousStatus = seenStatuses[project.id || project._id];
      if (project.status === 'PENDING_INITIAL_VERIFICATION' && previousStatus !== 'PENDING_INITIAL_VERIFICATION') {
        notifications.push({
          type: 'info',
          message: `New submission for verification: "${project.project || project.projectName || 'Untitled Project'}"`,
          time: project.createdAt ? getTimeAgo(new Date(project.createdAt)) : 'Just now'
        });
      }
      seenStatuses[project.id || project._id] = project.status;
    });
    
    localStorage.setItem('seenPanchayatStatuses', JSON.stringify(seenStatuses));
    
    if (approvedProjects.length > 0) {
      approvedProjects.slice(0, 3).forEach(project => {
        notifications.push({
          type: 'success',
          message: `Project approved: "${project.project || project.projectName || 'Untitled Project'}"`,
          time: project.verifiedAt ? getTimeAgo(new Date(project.verifiedAt)) : 'Recently'
        });
      });
    }
    
    if (rejectedProjects.length > 0) {
      rejectedProjects.slice(0, 3).forEach(project => {
        notifications.push({
          type: 'error',
          message: `Project rejected: "${project.project || project.projectName || 'Untitled Project'}"`,
          time: project.verifiedAt ? getTimeAgo(new Date(project.verifiedAt)) : 'Recently'
        });
      });
    }
    
    const notificationList = document.getElementById('notificationList');
    if (notificationList) {
      notificationList.innerHTML = '';
      
      if (notifications.length === 0) {
        notificationList.innerHTML = '<p>No new notifications.</p>';
      } else {
        notifications.forEach(notification => {
          const item = document.createElement('div');
          item.className = `notification-item ${notification.type === 'success' || notification.type === 'error' ? 'unread' : ''}`;
          item.innerHTML = `<p>${notification.message}</p><small>${notification.time}</small>`;
          notificationList.appendChild(item);
        });
      }
    }
  } catch (error) {
    console.error('Error loading notifications:', error);
  }
}

/**
 * Get time ago string
 */
function getTimeAgo(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minutes ago`;
  if (diffHours < 24) return `${diffHours} hours ago`;
  return `${diffDays} days ago`;
}

/**
 * Load profile data
 */
function loadProfile() {
  const profile = JSON.parse(localStorage.getItem('panchayatProfile') || '{}');
  document.getElementById('panchayatName').value = profile.panchayatName || '';
  document.getElementById('panchayatState').value = profile.state || '';
  document.getElementById('panchayatDistrict').value = profile.district || '';
  document.getElementById('panchayatContact').value = profile.contactDetails || '';
  document.getElementById('panchayatWallet').textContent = currentWalletAddress;
}

/**
 * Handle profile form submission
 */
function handleProfileSubmit(e) {
  e.preventDefault();
  
  const profile = {
    panchayatName: document.getElementById('panchayatName').value,
    state: document.getElementById('panchayatState').value,
    district: document.getElementById('panchayatDistrict').value,
    contactDetails: document.getElementById('panchayatContact').value
  };
  
  localStorage.setItem('panchayatProfile', JSON.stringify(profile));
  showToast('Profile updated successfully!', 'success');
}

// Refresh notifications every 30 seconds
setInterval(() => { loadNotifications(); }, 30000);

