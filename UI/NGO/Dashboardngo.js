// State variables
let isEditing = false;
let editingProjectId = null;
let currentWalletAddress = '';

// Logout functionality
document.getElementById('logoutBtn').addEventListener('click', async () => {
  if (window.ethereum) {
    try {
      await ethereum.request({
        method: 'wallet_revokePermissions',
        params: [{ eth_accounts: {} }],
      });
    } catch (error) {
      console.log('Error revoking permissions:', error);
    }
  }
  localStorage.removeItem('wallet');
  localStorage.removeItem('walletAddress');
  localStorage.removeItem('role');
  window.location.href = '../Login/login.html';
});

// Check if user is logged in
window.addEventListener('load', () => {
  const wallet = localStorage.getItem('wallet') || localStorage.getItem('walletAddress');
  if (!wallet) {
    window.location.href = '../Login/login.html';
  } else {
    currentWalletAddress = wallet;
    const role = localStorage.getItem(`role_${wallet}`) || localStorage.getItem('role');
    document.getElementById('userRole').textContent = role || 'NGO User';
    document.getElementById('walletAddress').value = wallet;
    loadDashboardData();
  }
});

// Load dashboard data
async function loadDashboardData() {
  await updateOverviewStats();
  await loadProjects();
  loadSubmissions();
  loadNotifications();
  loadProfile();
}

// Update overview stats
async function updateOverviewStats() {
  try {
    const response = await fetch(`http://localhost:5000/api/projects/${currentWalletAddress}`);
    const result = await response.json();
    
    let projects = [];
    if (result.success) {
      projects = result.data;
    }
    
    // Filter by new workflow statuses
    // NGO should see: DRAFT, INITIAL_APPROVED, COMPLETED
    const draftProjects = projects.filter(p => p.status === 'DRAFT');
    const initialApprovedProjects = projects.filter(p => p.status === 'INITIAL_APPROVED');
    const completedProjects = projects.filter(p => p.status === 'COMPLETED');
    const initialRejectedProjects = projects.filter(p => p.status === 'INITIAL_REJECTED');
    
    // Get submissions for status
    const submissionsResponse = await fetch('http://localhost:5000/api/submissions');
    const submissionsResult = await submissionsResponse.json();
    const submissions = submissionsResult.success ? submissionsResult.data : [];
    
    // Filter submissions by status
    const pendingInitialSubmissions = submissions.filter(s => s.status === 'PENDING_INITIAL_VERIFICATION');
    const pendingFinalSubmissions = submissions.filter(s => s.status === 'PENDING_FINAL_VERIFICATION');
    const mintedSubmissions = submissions.filter(s => s.status === 'MINTED');
    
    // Legacy counts for backward compatibility
    const totalProjects = projects.length;
    const submittedPlantations = pendingInitialSubmissions.length + pendingFinalSubmissions.length;
    const verifiedProjects = completedProjects.length;
    const pendingVerification = pendingInitialSubmissions.length;
    const rejectedSubmissions = initialRejectedProjects.length;
    const estimatedCredits = projects.reduce((sum, p) => sum + (p.estimatedCredits || 0), 0);

    document.getElementById('totalProjects').textContent = draftProjects.length + initialApprovedProjects.length + completedProjects.length;
    document.getElementById('submittedPlantations').textContent = submittedPlantations;
    document.getElementById('verifiedProjects').textContent = verifiedProjects;
    document.getElementById('pendingVerification').textContent = pendingVerification;
    document.getElementById('rejectedSubmissions').textContent = rejectedSubmissions;
    document.getElementById('estimatedCredits').textContent = estimatedCredits.toFixed(1);
  } catch (error) {
    console.error('Error loading stats:', error);
  }
}

// Project Management
document.getElementById('projectForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const projectName = document.getElementById('projectName').value;
  
  // Get all plantation data from form
  const speciesType = document.getElementById('speciesType') ? document.getElementById('speciesType').value : '';
  const saplingsPlanted = document.getElementById('saplingsPlanted') ? document.getElementById('saplingsPlanted').value : '';
  const areaCovered = document.getElementById('areaCovered') ? document.getElementById('areaCovered').value : '';
  const latitude = document.getElementById('gpsLat') ? document.getElementById('gpsLat').value : '';
  const longitude = document.getElementById('gpsLng') ? document.getElementById('gpsLng').value : '';
  const estimatedCredits = parseFloat(document.getElementById('projectEstimatedCredits').value) || 0;
  
  // Calculate carbon amount if not provided (approximate: 0.02 tCO2e per sapling)
  const carbonAmount = saplingsPlanted ? (parseInt(saplingsPlanted) * 0.02) : estimatedCredits;
  
  // Send both name and title for backend schema compatibility
  // Also send type and projectType for schema compatibility
  // Send all plantation data for Panchayat verification
  const projectData = {
    name: projectName,
    title: projectName,  // Schema expects 'title' field
    state: document.getElementById('state').value,
    district: document.getElementById('district').value,
    panchayat: document.getElementById('panchayat').value,
    type: document.getElementById('projectType').value,
    projectType: document.getElementById('projectType').value,  // Schema uses 'projectType'
    startDate: document.getElementById('startDate').value,
    completionDate: document.getElementById('completionDate').value,
    estimatedCredits: estimatedCredits,
    walletAddress: currentWalletAddress,
    // Plantation data - these will be saved in DB and shown to Panchayat
    speciesType: speciesType,
    saplingsPlanted: saplingsPlanted,
    areaCovered: areaCovered,
    latitude: latitude,
    longitude: longitude,
    carbonAmount: carbonAmount
  };

  try {
    if (isEditing && editingProjectId) {
      // Update existing project via API
      const response = await fetch(`http://localhost:5000/api/projects/${editingProjectId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(projectData)
      });
      
      const result = await response.json();
      if (result.success) {
        alert('Project updated successfully!');
      } else {
        alert('Error updating project: ' + result.message);
        return;
      }
    } else {
      // Create new project via API
      const response = await fetch('http://localhost:5000/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(projectData)
      });
      
      const result = await response.json();
      if (result.success) {
        alert('Project created successfully!');
      } else {
        alert('Error creating project: ' + result.message);
        return;
      }
    }

    await loadProjects();
    await updateProjectSelect();
    await updateOverviewStats();
    resetProjectForm();
  } catch (error) {
    console.error('Error saving project:', error);
    alert('Error saving project. Please check if the backend server is running.');
  }
});

function resetProjectForm() {
  document.getElementById('projectForm').reset();
  document.getElementById('editProjectId').value = '';
  document.getElementById('projectFormTitle').textContent = 'Create New Project';
  document.getElementById('projectSubmitBtn').textContent = 'Create Project';
  document.getElementById('cancelEditBtn').style.display = 'none';
  isEditing = false;
  editingProjectId = null;
}

function cancelEdit() {
  resetProjectForm();
}

async function loadProjects() {
  try {
    const response = await fetch(`http://localhost:5000/api/projects/${currentWalletAddress}`);
    const result = await response.json();
    
    const projects = result.success ? result.data : [];
    const projectList = document.getElementById('projectListContainer');
    projectList.innerHTML = '';

    if (projects.length === 0) {
      projectList.innerHTML = '<p>No projects yet.</p>';
    } else {
      projects.forEach(project => {
        const projectCard = document.createElement('div');
        projectCard.className = 'project-card';
        // Handle both name and title fields for display
        const projectName = project.name || project.title || project.projectName || 'Untitled Project';
        const projectType = project.type || project.projectType || 'N/A';
        const credits = project.estimatedCredits || 0;
        
        projectCard.innerHTML = `
          <h5>${projectName}</h5>
          <p><strong>ID:</strong> ${project._id}</p>
          <p><strong>Location:</strong> ${project.state || 'N/A'}, ${project.district || 'N/A'}, ${project.panchayat || 'N/A'}</p>
          <p><strong>Type:</strong> ${projectType}</p>
          <p><strong>Status:</strong> <span class="status-${(project.status || 'pending').toLowerCase()}">${project.status || 'Pending'}</span></p>
          <p><strong>Dates:</strong> ${project.startDate || 'N/A'} to ${project.completionDate || 'N/A'}</p>
          <p><strong>Est. Credits:</strong> ${credits} tCO2e</p>
          <div class="project-actions">
            <button class="btn-secondary" onclick="viewProject('${project._id}')">View Details</button>
            <button class="btn-secondary" onclick="editProject('${project._id}')">Edit</button>
            <button class="btn-danger" onclick="deleteProject('${project._id}')">Delete</button>
          </div>
        `;
        projectList.appendChild(projectCard);
      });
    }
  } catch (error) {
    console.error('Error loading projects:', error);
    document.getElementById('projectListContainer').innerHTML = '<p>Error loading projects.</p>';
  }
}

function viewProject(projectId) {
  fetch(`http://localhost:5000/api/projects/project/${projectId}`)
    .then(res => res.json())
    .then(result => {
      if (result.success) {
        const project = result.data;
        // Handle both name and title fields
        const projectName = project.name || project.title || project.projectName || 'Untitled Project';
        const projectType = project.type || project.projectType || 'N/A';
        const credits = project.estimatedCredits || 0;
        
        alert(`Project Details:\nName: ${projectName}\nLocation: ${project.state || 'N/A'}, ${project.district || 'N/A'}, ${project.panchayat || 'N/A'}\nType: ${projectType}\nDates: ${project.startDate || 'N/A'} to ${project.completionDate || 'N/A'}\nEst. Credits: ${credits} tCO2e\nStatus: ${project.status || 'Pending'}`);
      } else {
        alert('Project not found');
      }
    })
    .catch(err => console.error('Error:', err));
}

async function editProject(projectId) {
  try {
    const response = await fetch(`http://localhost:5000/api/projects/project/${projectId}`);
    const result = await response.json();
    
    if (result.success) {
      const project = result.data;
      
      // Set editing state
      isEditing = true;
      editingProjectId = projectId;
      
      // Handle both name and title fields
      const projectName = project.name || project.title || project.projectName || '';
      const projectType = project.type || project.projectType || '';
      
      // Populate form with project data for editing
      document.getElementById('projectName').value = projectName;
      document.getElementById('editProjectId').value = project._id;
      document.getElementById('state').value = project.state || '';
      
      // Trigger district population
      document.getElementById('state').dispatchEvent(new Event('change'));
      setTimeout(() => {
        document.getElementById('district').value = project.district || '';
        document.getElementById('panchayat').value = project.panchayat || '';
        document.getElementById('projectType').value = projectType;
        document.getElementById('startDate').value = project.startDate ? project.startDate.split('T')[0] : '';
        document.getElementById('completionDate').value = project.completionDate ? project.completionDate.split('T')[0] : '';
        document.getElementById('projectEstimatedCredits').value = project.estimatedCredits || 0;
        
        // Update UI for edit mode
        document.getElementById('projectFormTitle').textContent = 'Edit Project';
        document.getElementById('projectSubmitBtn').textContent = 'Update Project';
        document.getElementById('cancelEditBtn').style.display = 'inline-block';
      }, 100);
      
      // Switch to projects section
      document.querySelectorAll('.section').forEach(section => {
        section.style.display = section.id === 'projects' ? 'block' : 'none';
      });
      document.querySelectorAll('.sidebar nav a').forEach(a => a.classList.remove('active'));
      document.querySelector('a[href="#projects"]').classList.add('active');
    }
  } catch (error) {
    console.error('Error loading project:', error);
    alert('Error loading project');
  }
}

// Project dropdown - Updated to filter by submission type
async function updateProjectSelect() {
  try {
    const submissionType = document.getElementById('submissionType') ? document.getElementById('submissionType').value : '';
    const select = document.getElementById('projectSelect');
    
    let url = `http://localhost:5000/api/projects/submissions?walletAddress=${currentWalletAddress}`;
    
    // If submission type is selected, filter by that type
    if (submissionType) {
      url += `&type=${submissionType}`;
    }
    
    const response = await fetch(url);
    const result = await response.json();
    
    const projects = result.success ? result.data : [];
    select.innerHTML = '<option value="">Choose Project</option>';

    if (projects.length === 0) {
      // Show message based on submission type
      if (submissionType === 'INITIAL') {
        select.innerHTML += '<option value="" disabled>No projects available for INITIAL submission</option>';
      } else if (submissionType === 'FINAL') {
        select.innerHTML += '<option value="" disabled>No projects available for FINAL submission (initial not approved yet)</option>';
      }
      return;
    }

    projects.forEach(project => {
      const option = document.createElement('option');
      option.value = project._id;
      // Handle both name and title fields
      const projectName = project.name || project.title || project.projectName || 'Untitled';
      option.textContent = `${projectName} (${project._id})`;
      select.appendChild(option);
    });
  } catch (error) {
    console.error('Error updating project select:', error);
  }
}

// Event listener for submission type change - refresh project dropdown
document.getElementById('submissionType').addEventListener('change', function() {
  updateProjectSelect();
});

// Image Upload
document.getElementById('imageUpload').addEventListener('change', (e) => {
  const files = e.target.files;
  const preview = document.getElementById('imagePreview');
  preview.innerHTML = '';

  Array.from(files).forEach(file => {
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = document.createElement('img');
        img.src = e.target.result;
        preview.appendChild(img);
      };
      reader.readAsDataURL(file);
    }
  });
});

// GPS Auto-detection
document.getElementById('gpsLat').addEventListener('focus', () => {
  if (navigator.geolocation && !document.getElementById('gpsLat').value) {
    navigator.geolocation.getCurrentPosition((position) => {
      document.getElementById('gpsLat').value = position.coords.latitude.toFixed(6);
      document.getElementById('gpsLng').value = position.coords.longitude.toFixed(6);
    });
  }
});

// Success Popup Function
function showSuccessPopup(message) {
  // Remove existing popup if any
  const existingPopup = document.getElementById('successPopup');
  if (existingPopup) {
    existingPopup.remove();
  }

  // Create popup container
  const popup = document.createElement('div');
  popup.id = 'successPopup';
  popup.innerHTML = `
    <div class="popup-content">
      <div class="popup-icon">✓</div>
      <div class="popup-message">${message}</div>
      <button class="popup-close" onclick="closeSuccessPopup()">Close</button>
    </div>
  `;
  
  // Add styles
  popup.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: linear-gradient(135deg, #10b981, #059669);
    color: white;
    padding: 30px 50px;
    border-radius: 15px;
    box-shadow: 0 10px 40px rgba(16, 185, 129, 0.4);
    z-index: 10000;
    animation: popupSlideIn 0.3s ease-out;
    font-family: 'Segoe UI', sans-serif;
  `;

  // Add animation styles
  const style = document.createElement('style');
  style.textContent = `
    @keyframes popupSlideIn {
      from {
        opacity: 0;
        transform: translate(-50%, -40%);
      }
      to {
        opacity: 1;
        transform: translate(-50%, -50%);
      }
    }
  `;
  document.head.appendChild(style);

  // Add to body
  document.body.appendChild(popup);

  // Auto close after 3 seconds
  setTimeout(() => {
    closeSuccessPopup();
  }, 3000);
}

function closeSuccessPopup() {
  const popup = document.getElementById('successPopup');
  if (popup) {
    popup.style.animation = 'popupSlideOut 0.3s ease-out';
    setTimeout(() => popup.remove(), 300);
  }
}

// Upload Form - REAL submission to backend
document.getElementById('uploadForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const progressBar = document.getElementById('uploadProgress');
  const submitBtn = document.querySelector('#uploadForm button[type="submit"]');
  
  // Get form values
  const project = document.getElementById('projectSelect').value;
  const latitude = document.getElementById('gpsLat').value;
  const longitude = document.getElementById('gpsLng').value;
  const areaCovered = document.getElementById('areaCovered').value;
  const saplingsPlanted = document.getElementById('saplingsPlanted').value;
  const speciesType = document.getElementById('speciesType').value;
  const fileInput = document.getElementById('imageUpload');

  // Validate required fields
  if (!project) {
    alert('Please select a project');
    return;
  }
  if (!latitude || !longitude) {
    alert('Please enter GPS coordinates');
    return;
  }
  if (!areaCovered) {
    alert('Please enter area covered');
    return;
  }
  if (!saplingsPlanted) {
    alert('Please enter number of saplings planted');
    return;
  }
  if (!speciesType) {
    alert('Please select species type');
    return;
  }
  if (!fileInput.files || !fileInput.files[0]) {
    alert('Please select a file to upload');
    return;
  }

  // Create FormData for file upload
  const formData = new FormData();
  formData.append('file', fileInput.files[0]);
  formData.append('project', project);
  // FIX: Send walletAddress explicitly so backend can store submittedBy
  formData.append('walletAddress', currentWalletAddress);
  formData.append('submittedBy', currentWalletAddress);
  // ngoId should be MongoDB _id if available, otherwise omit (wallet is stored separately)
  const userData = JSON.parse(localStorage.getItem('userData') || '{}');
  if (userData._id) formData.append('ngoId', userData._id);
  formData.append('submissionType', document.getElementById('submissionType').value);
  formData.append('latitude', latitude);
  formData.append('longitude', longitude);
  formData.append('areaCovered', areaCovered);
  formData.append('saplingsPlanted', saplingsPlanted);
  formData.append('speciesType', speciesType);

  // Disable button during upload
  submitBtn.disabled = true;
  submitBtn.textContent = 'Uploading...';

  try {
    // Show progress
    progressBar.style.width = '30%';

    // Make actual API call to backend
    const response = await fetch('http://localhost:5000/api/submissions', {
      method: 'POST',
      body: formData
      // Don't set Content-Type - let browser set it with boundary
    });

    progressBar.style.width = '70%';

    const result = await response.json();
    
    if (result.success) {
      progressBar.style.width = '100%';
      
      // Show success popup instead of alert
      showSuccessPopup('Project data submitted successfully!');
      
      // Reset form
      document.getElementById('uploadForm').reset();
      document.getElementById('imagePreview').innerHTML = '';
      progressBar.style.width = '0%';
      
      // Refresh submissions table
      loadSubmissions();
      
      // Refresh carbon credits stats if on that page
      if (document.getElementById('carbonCredits')) {
        loadCarbonCreditsStats();
      }
    } else {
      alert('Error: ' + result.message);
      progressBar.style.width = '0%';
    }
  } catch (error) {
    console.error('Upload error:', error);
    alert('Error uploading data. Please check if the backend server is running.');
    progressBar.style.width = '0%';
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit Data';
  }
});

// Load Submissions from Backend API
async function loadSubmissions() {
  try {
    const response = await fetch('http://localhost:5000/api/submissions');
    const result = await response.json();
    
    const submissions = result.success ? result.data : [];
    const tbody = document.querySelector('#statusTable tbody');
    tbody.innerHTML = '';

    if (submissions.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No submissions yet</td></tr>';
      return;
    }

    submissions.forEach(submission => {
      const row = document.createElement('tr');
      const submittedDate = submission.submittedAt ? new Date(submission.submittedAt).toLocaleDateString() : '-';
      const status = submission.status || 'Submitted';
      const mintingStatus = submission.mintingStatus || 'Not Minted';
      const remarks = submission.panchayatRemarks || submission.remarks || 'N/A';
      
      row.innerHTML = `
        <td>${submission.submissionId || submission.id}</td>
        <td>${submittedDate}</td>
        <td><span class="status-${status.toLowerCase()}">${status}</span></td>
        <td>${remarks}</td>
        <td>${mintingStatus}</td>
      `;
      tbody.appendChild(row);
    });
  } catch (error) {
    console.error('Error loading submissions:', error);
    const tbody = document.querySelector('#statusTable tbody');
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Error loading submissions</td></tr>';
  }
}

// Load Carbon Credits Stats
async function loadCarbonCreditsStats() {
  try {
    const response = await fetch('http://localhost:5000/api/submissions/carbon-credits');
    const result = await response.json();
    
    if (result.success) {
      const data = result.data;
      
      // Update the stats cards
      document.getElementById('totalCredits').textContent = parseFloat(data.totalCredits || 0).toFixed(4);
      document.getElementById('pendingCredits').textContent = parseFloat(data.pendingCredits || 0).toFixed(4);
      document.getElementById('mintedCredits').textContent = parseFloat(data.mintedCredits || 0).toFixed(4);
      document.getElementById('co2Offset').textContent = parseFloat(data.co2Offset || 0).toFixed(4);
      
      // Update minting status counts
      const mintingStatus = data.mintingStatus || {};
      document.getElementById('notMintedCount').textContent = mintingStatus.notMinted || 0;
      document.getElementById('pendingMintCount').textContent = mintingStatus.pending || 0;
      document.getElementById('completedMintCount').textContent = mintingStatus.completed || 0;
      document.getElementById('failedMintCount').textContent = mintingStatus.failed || 0;
      
      // Update total saplings
      document.getElementById('totalSaplings').textContent = data.totalSaplings || 0;
    }
  } catch (error) {
    console.error('Error loading carbon credits stats:', error);
  }
}

// Load Notifications - Real-time updates when Panchayat approves/rejects projects
// Enhanced to also check submission status changes
async function loadNotifications() {
  try {
    // Check project status changes
    const projectResponse = await fetch(`http://localhost:5000/api/projects/${currentWalletAddress}`);
    const projectResult = await projectResponse.json();
    
    const projects = projectResult.success ? projectResult.data : [];
    const notifications = [];
    
    const seenStatuses = JSON.parse(localStorage.getItem('seenProjectStatuses') || '{}');
    let hasNewNotifications = false;
    
    projects.forEach(project => {
      const previousStatus = seenStatuses[project._id];
      // Handle both 'Approved' and 'Verified' status (some parts may use Verified)
      const isApproved = project.status === 'Approved' || project.status === 'Verified';
      
      // Check for APPROVED status - Panchayat approved the project
      if (isApproved && previousStatus !== 'Approved' && previousStatus !== 'Verified') {
        const projectName = project.name || project.title || project.projectName || 'Untitled Project';
        notifications.push({
          type: 'success',
          message: `✅ Your project "${projectName}" has been APPROVED by Panchayat!`,
          time: project.verifiedAt ? getTimeAgo(new Date(project.verifiedAt)) : 'Just now'
        });
        hasNewNotifications = true;
      } 
      // Check for REJECTED status - Panchayat rejected the project
      else if (project.status === 'Rejected' && previousStatus !== 'Rejected') {
        const projectName = project.name || project.title || project.projectName || 'Untitled Project';
        notifications.push({
          type: 'error',
          message: `❌ Your project "${projectName}" has been REJECTED. Reason: ${project.rejectionReason || 'Please contact Panchayat for details'}`,
          time: project.verifiedAt ? getTimeAgo(new Date(project.verifiedAt)) : 'Just now'
        });
        hasNewNotifications = true;
      }
      // Check for new PENDING submissions that need verification
      else if (project.status === 'Pending' && previousStatus === undefined) {
        const projectName = project.name || project.title || project.projectName || 'Untitled Project';
        notifications.push({
          type: 'info',
          message: `📋 Your project "${projectName}" is awaiting Panchayat verification.`,
          time: project.createdAt ? getTimeAgo(new Date(project.createdAt)) : 'Just now'
        });
      }
      
      // Always update the seen status
      seenStatuses[project._id] = project.status;
    });
    
    localStorage.setItem('seenProjectStatuses', JSON.stringify(seenStatuses));
    
    // Also check submission status changes for real-time notifications
    await checkSubmissionStatusChanges();
    
    // Show toast notification for new status changes
    if (hasNewNotifications && notifications.length > 0) {
      notifications.forEach(notification => {
        showToastNotification(notification.message, notification.type === 'success' ? 'success' : 'error');
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
          item.className = `notification-item ${notification.type === 'success' ? 'unread' : ''}`;
          item.innerHTML = `<p>${notification.message}</p><small>${notification.time}</small>`;
          notificationList.appendChild(item);
        });
      }
    }
  } catch (error) {
    console.error('Error loading notifications:', error);
  }
}

// Check for submission status changes and show notifications
async function checkSubmissionStatusChanges() {
  try {
    const response = await fetch('http://localhost:5000/api/submissions');
    const result = await response.json();
    
    if (!result.success) return;
    
    const submissions = result.data;
    const seenSubmissions = JSON.parse(localStorage.getItem('seenSubmissionStatuses') || '{}');
    
    submissions.forEach(submission => {
      const previousStatus = seenSubmissions[submission.id];
      const submissionType = submission.submissionType || 'Submission';
      
      // Check for APPROVED status - Panchayat approved the submission
      if (submission.status === 'APPROVED' && previousStatus !== 'APPROVED' && previousStatus !== undefined) {
        showToastNotification(`✅ Your ${submissionType} submission has been APPROVED by Panchayat!`, 'success');
      }
      // Check for REJECTED status - Panchayat rejected the submission
      else if (submission.status === 'REJECTED' && previousStatus !== 'REJECTED' && previousStatus !== undefined) {
        showToastNotification(`❌ Your ${submissionType} submission has been REJECTED. Reason: ${submission.panchayatRemarks || 'Please contact Panchayat for details'}`, 'error');
      }
      // Check for MINTED status - Tokens have been minted
      else if (submission.status === 'MINTED' && previousStatus !== 'MINTED' && previousStatus !== undefined) {
        showToastNotification(`🎉 Congratulations! Carbon credits have been minted for your ${submissionType} submission!`, 'success');
      }
      
      // Always update the seen status
      seenSubmissions[submission.id] = submission.status;
    });
    
    localStorage.setItem('seenSubmissionStatuses', JSON.stringify(seenSubmissions));
  } catch (error) {
    console.error('Error checking submission status changes:', error);
  }
}

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

function showToastNotification(message, type = 'success') {
  const existingToast = document.getElementById('toast');
  if (existingToast) existingToast.remove();

  const toast = document.createElement('div');
  toast.id = 'toast';
  toast.style.cssText = `position:fixed;top:20px;right:20px;padding:15px 25px;border-radius:8px;color:white;font-weight:500;z-index:3000;animation:slideIn 0.3s ease-out;max-width:400px;box-shadow:0 4px 15px rgba(0,0,0,0.2);`;
  toast.style.background = type === 'success' ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #e74c3c, #c0392b)';
  toast.textContent = message;
  
  const style = document.createElement('style');
  style.textContent = '@keyframes slideIn{from{transform:translateX(400px);opacity:0}to{transform:translateX(0);opacity:1}}@keyframes slideOut{from{transform:translateX(0);opacity:1}to{transform:translateX(400px);opacity:0}}';
  document.head.appendChild(style);
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => toast.remove(), 300);
  }, 5000);
}

setInterval(() => { loadNotifications(); }, 30000);

// Load Profile
function loadProfile() {
  const profile = JSON.parse(localStorage.getItem('profile') || '{}');
  document.getElementById('ngoName').value = profile.ngoName || '';
  document.getElementById('registrationId').value = profile.registrationId || '';
  document.getElementById('contactDetails').value = profile.contactDetails || '';
  document.getElementById('email').value = profile.email || '';
  document.getElementById('phone').value = profile.phone || '';
  document.getElementById('address').value = profile.address || '';
}

// Profile Form
document.getElementById('profileForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const profile = {
    ngoName: document.getElementById('ngoName').value,
    registrationId: document.getElementById('registrationId').value,
    contactDetails: document.getElementById('contactDetails').value,
    email: document.getElementById('email').value,
    phone: document.getElementById('phone').value,
    address: document.getElementById('address').value
  };

  localStorage.setItem('profile', JSON.stringify(profile));
  alert('Profile updated successfully!');
});

// Sidebar Navigation
document.querySelectorAll('.sidebar nav a').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const targetId = link.getAttribute('href').substring(1);
    document.querySelectorAll('.section').forEach(section => {
      section.style.display = section.id === targetId ? 'block' : 'none';
    });
    document.querySelectorAll('.sidebar nav a').forEach(a => a.classList.remove('active'));
    link.classList.add('active');
  });
});

// Populate states
const states = ['Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal'];

const stateSelect = document.getElementById('state');
states.forEach(state => {
  const option = document.createElement('option');
  option.value = state;
  option.textContent = state;
  stateSelect.appendChild(option);
});

// On state change, populate districts
stateSelect.addEventListener('change', () => {
  const selectedState = stateSelect.value;
  const districtSelect = document.getElementById('district');
  const panchayatSelect = document.getElementById('panchayat');
  districtSelect.innerHTML = '<option value="">Select District</option>';
  panchayatSelect.innerHTML = '<option value="">Select Panchayat</option>';
  districtSelect.disabled = false;
  panchayatSelect.disabled = true;

  const districts = {
    'Andhra Pradesh': ['Anantapur', 'Chittoor', 'East Godavari', 'Guntur', 'Krishna', 'Kurnool', 'Nellore', 'Prakasam', 'Srikakulam', 'Visakhapatnam', 'Vizianagaram', 'West Godavari'],
    'Arunachal Pradesh': ['Anjaw', 'Changlang', 'Dibang Valley', 'East Kameng', 'East Siang', 'Kra Daadi', 'Kurung Kumey', 'Lepa Rada', 'Lohit', 'Longding', 'Lower Dibang Valley', 'Lower Subansiri', 'Namsai', 'Pakke Kessang', 'Papum Pare', 'Shi Yomi', 'Siang', 'Tawang', 'Tirap', 'Upper Siang', 'Upper Subansiri', 'West Kameng', 'West Siang'],
    'Assam': ['Baksa', 'Barpeta', 'Biswanath', 'Bongaigaon', 'Cachar', 'Charaideo', 'Chirang', 'Darrang', 'Dhemaji', 'Dhubri', 'Dibrugarh', 'Dima Hasao', 'Goalpara', 'Golaghat', 'Hailakandi', 'Hojai', 'Jorhat', 'Kamrup', 'Kamrup Metropolitan', 'Karbi Anglong', 'Karimganj', 'Kokrajhar', 'Lakhimpur', 'Majuli', 'Morigaon', 'Nagaon', 'Nalbari', 'Sivasagar', 'Sonitpur', 'South Salmara-Mankachar', 'Tinsukia', 'Udalguri', 'West Karbi Anglong'],
    'Bihar': ['Araria', 'Arwal', 'Aurangabad', 'Banka', 'Begusarai', 'Bhagalpur', 'Bhojpur', 'Buxar', 'Darbhanga', 'East Champaran', 'Gaya', 'Gopalganj', 'Jamui', 'Jehanabad', 'Kaimur', 'Katihar', 'Khagaria', 'Kishanganj', 'Lakhisarai', 'Madhepura', 'Madhubani', 'Munger', 'Muzaffarpur', 'Nalanda', 'Nawada', 'Patna', 'Purnia', 'Rohtas', 'Saharsa', 'Samastipur', 'Saran', 'Sheikhpura', 'Sheohar', 'Sitamarhi', 'Siwan', 'Supaul', 'Vaishali', 'West Champaran'],
    'Chhattisgarh': ['Balod', 'Baloda Bazar', 'Balrampur', 'Bastar', 'Bemetara', 'Bijapur', 'Bilaspur', 'Dantewada', 'Dhamtari', 'Durg', 'Gariaband', 'Janjgir-Champa', 'Jashpur', 'Kabirdham', 'Kanker', 'Kondagaon', 'Korba', 'Koriya', 'Mahasamund', 'Mungeli', 'Narayanpur', 'Raigarh', 'Raipur', 'Rajnandgaon', 'Sukma', 'Surajpur', 'Surguja'],
    'Goa': ['North Goa', 'South Goa'],
    'Gujarat': ['Ahmedabad', 'Amreli', 'Anand', 'Aravalli', 'Banaskantha', 'Bharuch', 'Bhavnagar', 'Botad', 'Chhota Udaipur', 'Dahod', 'Dang', 'Devbhoomi Dwarka', 'Gandhinagar', 'Gir Somnath', 'Jamnagar', 'Junagadh', 'Kheda', 'Kutch', 'Mahisagar', 'Mehsana', 'Morbi', 'Narmada', 'Navsari', 'Panchmahal', 'Patan', 'Porbandar', 'Rajkot', 'Sabarkantha', 'Surat', 'Surendranagar', 'Tapi', 'Vadodara', 'Valsad'],
    'Haryana': ['Ambala', 'Bhiwani', 'Charkhi Dadri', 'Faridabad', 'Fatehabad', 'Gurugram', 'Hisar', 'Jhajjar', 'Jind', 'Kaithal', 'Karnal', 'Kurukshetra', 'Mahendragarh', 'Nuh', 'Palwal', 'Panchkula', 'Panipat', 'Rewari', 'Rohtak', 'Sirsa', 'Sonipat', 'Yamunanagar'],
    'Himachal Pradesh': ['Bilaspur', 'Chamba', 'Hamirpur', 'Kangra', 'Kinnaur', 'Kullu', 'Lahaul and Spiti', 'Mandi', 'Shimla', 'Sirmaur', 'Solan', 'Una'],
    'Jharkhand': ['Bokaro', 'Chatra', 'Deoghar', 'Dhanbad', 'Dumka', 'East Singhbhum', 'Garhwa', 'Giridih', 'Godda', 'Gumla', 'Hazaribagh', 'Jamtara', 'Khunti', 'Koderma', 'Latehar', 'Lohardaga', 'Pakur', 'Palamu', 'Ramgarh', 'Ranchi', 'Sahibganj', 'Seraikela Kharsawan', 'Simdega', 'West Singhbhum'],
    'Karnataka': ['Bagalkot', 'Bangalore Rural', 'Bangalore Urban', 'Belgaum', 'Bellary', 'Bidar', 'Bijapur', 'Chamarajanagar', 'Chikkaballapur', 'Chikkamagaluru', 'Chitradurga', 'Dakshina Kannada', 'Davanagere', 'Dharwad', 'Gadag', 'Gulbarga', 'Hassan', 'Haveri', 'Kodagu', 'Kolar', 'Koppal', 'Mandya', 'Mysore', 'Raichur', 'Ramanagara', 'Shimoga', 'Tumkur', 'Tumakuru', 'Udupi', 'Uttara Kannada', 'Yadgir'],
    'Kerala': ['Alappuzha', 'Ernakulam', 'Idukki', 'Kannur', 'Kasaragod', 'Kollam', 'Kottayam', 'Kozhikode', 'Malappuram', 'Palakkad', 'Pathanamthitta', 'Thiruvananthapuram', 'Thrissur', 'Wayanad'],
    'Madhya Pradesh': ['Agar Malwa', 'Alirajpur', 'Anuppur', 'Ashoknagar', 'Balaghat', 'Barwani', 'Betul', 'Bhind', 'Bhopal', 'Burhanpur', 'Chhatarpur', 'Chhindwara', 'Damoh', 'Datia', 'Dewas', 'Dhar', 'Dindori', 'Guna', 'Gwalior', 'Harda', 'Hoshangabad', 'Indore', 'Jabalpur', 'Jhabua', 'Katni', 'Khandwa', 'Khargone', 'Mandla', 'Mandsaur', 'Morena', 'Narsinghpur', 'Neemuch', 'Panna', 'Raisen', 'Rajgarh', 'Ratlam', 'Rewa', 'Sagar', 'Satna', 'Sehore', 'Seoni', 'Shahdol', 'Shajapur', 'Sheopur', 'Shivpuri', 'Sidhi', 'Singrauli', 'Tikamgarh', 'Ujjain', 'Umaria', 'Vidisha'],
    'Maharashtra': ['Ahmednagar', 'Akola', 'Amravati', 'Aurangabad', 'Beed', 'Bhandara', 'Buldhana', 'Chandrapur', 'Dhule', 'Gadchiroli', 'Gondia', 'Hingoli', 'Jalgaon', 'Jalna', 'Kolhapur', 'Latur', 'Mumbai City', 'Mumbai Suburban', 'Nagpur', 'Nanded', 'Nandurbar', 'Nashik', 'Osmanabad', 'Palghar', 'Parbhani', 'Pune', 'Raigad', 'Ratnagiri', 'Sangli', 'Satara', 'Sindhudurg', 'Solapur', 'Thane', 'Wardha', 'Washim', 'Yavatmal'],
    'Manipur': ['Bishnupur', 'Chandel', 'Churachandpur', 'Imphal East', 'Imphal West', 'Jiribam', 'Kakching', 'Kamjong', 'Kangpokpi', 'Noney', 'Pherzawl', 'Senapati', 'Tamenglong', 'Tengnoupal', 'Thoubal', 'Ukhrul'],
    'Meghalaya': ['East Garo Hills', 'East Jaintia Hills', 'East Khasi Hills', 'North Garo Hills', 'Ri Bhoi', 'South Garo Hills', 'South West Garo Hills', 'South West Khasi Hills', 'West Garo Hills', 'West Jaintia Hills', 'West Khasi Hills'],
    'Mizoram': ['Aizawl', 'Champhai', 'Hnahthial', 'Khawzawl', 'Kolasib', 'Lawngtlai', 'Lunglei', 'Mamit', 'Saiha', 'Saitual', 'Serchhip'],
    'Nagaland': ['Chümoukedima', 'Dimapur', 'Kiphire', 'Kohima', 'Longleng', 'Mokokchung', 'Mon', 'Niuland', 'Noklak', 'Peren', 'Phek', 'Shamator', 'Tseminyü', 'Tuensang', 'Wokha', 'Zünheboto'],
    'Odisha': ['Angul', 'Balangir', 'Balasore', 'Bargarh', 'Bhadrak', 'Boudh', 'Cuttack', 'Deogarh', 'Dhenkanal', 'Gajapati', 'Ganjam', 'Jagatsinghpur', 'Jajpur', 'Jharsuguda', 'Kalahandi', 'Kandhamal', 'Kendrapara', 'Kendujhar', 'Khordha', 'Koraput', 'Malkangiri', 'Mayurbhanj', 'Nabarangpur', 'Nayagarh', 'Nuapada', 'Puri', 'Rayagada', 'Sambalpur', 'Subarnapur', 'Sundargarh'],
    'Punjab': ['Amritsar', 'Barnala', 'Bathinda', 'Faridkot', 'Fatehgarh Sahib', 'Fazilka', 'Ferozepur', 'Gurdaspur', 'Hoshiarpur', 'Jalandhar', 'Kapurthala', 'Ludhiana', 'Mansa', 'Moga', 'Muktsar', 'Nawanshahr', 'Pathankot', 'Patiala', 'Rupnagar', 'Sahibzada Ajit Singh Nagar', 'Sangrur', 'Sri Muktsar Sahib', 'Tarn Taran'],
    'Rajasthan': ['Ajmer', 'Alwar', 'Banswara', 'Baran', 'Barmer', 'Bharatpur', 'Bhilwara', 'Bikaner', 'Bundi', 'Chittorgarh', 'Churu', 'Dausa', 'Dholpur', 'Dungarpur', 'Hanumangarh', 'Jaipur', 'Jaisalmer', 'Jalore', 'Jhalawar', 'Jhunjhunu', 'Jodhpur', 'Karauli', 'Kota', 'Nagaur', 'Pali', 'Pratapgarh', 'Rajsamand', 'Sawai Madhopur', 'Sikar', 'Sirohi', 'Sri Ganganagar', 'Tonk', 'Udaipur'],
    'Sikkim': ['East Sikkim', 'North Sikkim', 'South Sikkim', 'West Sikkim'],
    'Tamil Nadu': ['Ariyalur', 'Chengalpattu', 'Chennai', 'Coimbatore', 'Cuddalore', 'Dharmapuri', 'Dindigul', 'Erode', 'Kallakurichi', 'Kancheepuram', 'Kanyakumari', 'Karur', 'Krishnagiri', 'Madurai', 'Nagapattinam', 'Namakkal', 'Nilgiris', 'Perambalur', 'Pudukkottai', 'Ramanathapuram', 'Ranipet', 'Salem', 'Sivaganga', 'Tenkasi', 'Thanjavur', 'Theni', 'Thoothukudi', 'Tiruchirappalli', 'Tirunelveli', 'Tirupathur', 'Tiruppur', 'Tiruvallur', 'Tiruvannamalai', 'Tiruvarur', 'Vellore', 'Viluppuram', 'Virudhunagar'],
    'Telangana': ['Adilabad', 'Bhadradri Kothagudem', 'Hyderabad', 'Jagtial', 'Jangaon', 'Jayashankar Bhupalpally', 'Jogulamba Gadwal', 'Kamareddy', 'Karimnagar', 'Khammam', 'Kumuram Bheem', 'Mahabubabad', 'Mahabubnagar', 'Mancherial', 'Medak', 'Medchal–Malkajgiri', 'Mulugu', 'Nagarkurnool', 'Nalgonda', 'Narayanpet', 'Nirmal', 'Nizamabad', 'Peddapalli', 'Rajanna Sircilla', 'Rangareddy', 'Sangareddy', 'Siddipet', 'Suryapet', 'Vikarabad', 'Wanaparthy', 'Warangal Rural', 'Warangal Urban', 'Yadadri Bhuvanagiri'],
    'Tripura': ['Dhalai', 'Gomati', 'Khowai', 'North Tripura', 'Sepahijala', 'South Tripura', 'Unakoti', 'West Tripura'],
    'Uttar Pradesh': ['Agra', 'Aligarh', 'Allahabad', 'Ambedkar Nagar', 'Amethi', 'Amroha', 'Auraiya', 'Azamgarh', 'Baghpat', 'Bahraich', 'Ballia', 'Balrampur', 'Banda', 'Barabanki', 'Bareilly', 'Basti', 'Bhadohi', 'Bijnor', 'Budaun', 'Bulandshahr', 'Chandauli', 'Chitrakoot', 'Deoria', 'Etah', 'Etawah', 'Faizabad', 'Farrukhabad', 'Fatehpur', 'Firozabad', 'Gautam Buddha Nagar', 'Ghaziabad', 'Ghazipur', 'Gonda', 'Gorakhpur', 'Hamirpur', 'Hapur', 'Hardoi', 'Hathras', 'Jalaun', 'Jaunpur', 'Jhansi', 'Kannauj', 'Kanpur Dehat', 'Kanpur Nagar', 'Kasganj', 'Kaushambi', 'Kheri', 'Kushinagar', 'Lakhimpur Kheri', 'Lalitpur', 'Lucknow', 'Maharajganj', 'Mahoba', 'Mainpuri', 'Mathura', 'Mau', 'Meerut', 'Mirzapur', 'Moradabad', 'Muzaffarnagar', 'Pilibhit', 'Pratapgarh', 'Rae Bareli', 'Rampur', 'Saharanpur', 'Sambhal', 'Sant Kabir Nagar', 'Shahjahanpur', 'Shamli', 'Shravasti', 'Siddharthnagar', 'Sitapur', 'Sonbhadra', 'Sultanpur', 'Unnao', 'Varanasi'],
    'Uttarakhand': ['Almora', 'Bageshwar', 'Chamoli', 'Champawat', 'Dehradun', 'Haridwar', 'Nainital', 'Pauri Garhwal', 'Pithoragarh', 'Rudraprayag', 'Tehri Garhwal', 'Udham Singh Nagar', 'Uttarkashi'],
    'West Bengal': ['Alipurduar', 'Bankura', 'Birbhum', 'Cooch Behar', 'Dakshin Dinajpur', 'Darjeeling', 'Hooghly', 'Howrah', 'Jalpaiguri', 'Jhargram', 'Kalimpong', 'Kolkata', 'Malda', 'Murshidabad', 'Nadia', 'North 24 Parganas', 'Paschim Bardhaman', 'Paschim Medinipur', 'Purba Bardhaman', 'Purba Medinipur', 'Purulia', 'South 24 Parganas', 'Uttar Dinajpur']
  };
  const stateDistricts = districts[selectedState] || [];
  stateDistricts.forEach(district => {
    const option = document.createElement('option');
    option.value = district;
    option.textContent = district;
    districtSelect.appendChild(option);
  });
});

// On district change, enable panchayat input
document.getElementById('district').addEventListener('change', () => {
  const panchayatInput = document.getElementById('panchayat');
  panchayatInput.disabled = false;
});

// Load project list on page load
window.addEventListener('load', () => {
  loadProjects();
});

// Load projects when navigating to project list section
document.querySelectorAll('.sidebar nav a').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const targetId = link.getAttribute('href').substring(1);
    document.querySelectorAll('.section').forEach(section => {
      section.style.display = section.id === targetId ? 'block' : 'none';
    });
    document.querySelectorAll('.sidebar nav a').forEach(a => a.classList.remove('active'));
    link.classList.add('active');

    if (targetId === 'projectList') {
      loadProjects();
    }
    
    // Load carbon credits stats when navigating to credits section
    if (targetId === 'credits') {
      loadCarbonCreditsStats();
    }
  });
});

// Ensure overview is shown on load
window.addEventListener('load', () => {
  document.getElementById('overview').style.display = 'block';
  document.querySelector('a[href="#overview"]').classList.add('active');
});

// Set min date for date inputs to today
const today = new Date().toISOString().split('T')[0];
document.getElementById('startDate').setAttribute('min', today);
document.getElementById('completionDate').setAttribute('min', today);

// Initialize
updateProjectSelect();

// Delete Project Function
async function deleteProject(projectId) {
  if (confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
    try {
      const response = await fetch(`http://localhost:5000/api/projects/${projectId}`, {
        method: 'DELETE'
      });
      
      const result = await response.json();
      if (result.success) {
        alert('Project deleted successfully!');
        await loadProjects();
        await updateProjectSelect();
        await updateOverviewStats();
      } else {
        alert('Error deleting project: ' + result.message);
      }
    } catch (error) {
      console.error('Error deleting project:', error);
      alert('Error deleting project. Please check if the backend server is running.');
    }
  }
}
