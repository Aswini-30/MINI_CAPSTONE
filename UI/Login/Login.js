// ─── State ───────────────────────────────────────────────────────────────────
let walletAddress = '';
let selectedRole = '';
let isConnecting = false;

let regWalletAddress = '';
let regSelectedRole = '';

// ─── DOM refs (login) ─────────────────────────────────────────────────────────
const connectWalletBtn       = document.getElementById('connect-wallet-btn');
const walletSection          = document.getElementById('wallet-section');
const walletConnected        = document.getElementById('wallet-connected');
const walletAddressDisplay   = document.getElementById('wallet-address-display');
const roleDropdown           = document.getElementById('role-dropdown');
const loginBtn               = document.getElementById('login-btn');
const errorMessage           = document.getElementById('error-message');

// ─── DOM refs (register) ──────────────────────────────────────────────────────
const regConnectBtn          = document.getElementById('reg-connect-wallet-btn');
const regWalletSection       = document.getElementById('reg-wallet-section');
const regWalletConnected     = document.getElementById('reg-wallet-connected');
const regWalletAddressDisplay= document.getElementById('reg-wallet-address-display');
const regRoleDropdown        = document.getElementById('reg-role-dropdown');
const registerBtn            = document.getElementById('register-btn');
const regErrorMsg            = document.getElementById('reg-error-message');
const regSuccessMsg          = document.getElementById('reg-success-message');

// ─── Tab Switching ────────────────────────────────────────────────────────────
function switchTab(tab) {
    const cardLogin    = document.getElementById('card-login');
    const cardRegister = document.getElementById('card-register');
    const tabLogin     = document.getElementById('tab-login');
    const tabRegister  = document.getElementById('tab-register');

    if (tab === 'login') {
        cardLogin.style.display    = 'block';
        cardRegister.style.display = 'none';
        tabLogin.classList.add('active');
        tabRegister.classList.remove('active');
    } else {
        cardLogin.style.display    = 'none';
        cardRegister.style.display = 'block';
        tabRegister.classList.add('active');
        tabLogin.classList.remove('active');
    }
}

// ─── MetaMask: Connect Wallet ─────────────────────────────────────────────────
async function connectWallet(context = 'login') {
    if (isConnecting) return;

    if (typeof window.ethereum === 'undefined') {
        alert('MetaMask is not installed.\nPlease visit https://metamask.io to install it.');
        return;
    }

    setConnecting(true, context);

    try {
        // This triggers the MetaMask popup asking the user to connect
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });

        if (accounts.length > 0) {
            if (context === 'login') {
                walletAddress = accounts[0];
                updateLoginWalletUI();
                updateLoginButtonState();
                clearMsg(errorMessage);
            } else {
                regWalletAddress = accounts[0];
                updateRegisterWalletUI();
                updateRegisterButtonState();
                clearMsg(regErrorMsg);
                clearMsg(regSuccessMsg);
            }
        } else {
            showMsg(
                context === 'login' ? errorMessage : regErrorMsg,
                'No accounts found. Please unlock MetaMask.',
                'error'
            );
        }
    } catch (err) {
        const msg =
            err.code === 4001  ? 'Connection rejected. Please approve MetaMask connection.' :
            err.code === -32002 ? 'MetaMask popup already open. Check the extension.' :
            'Failed to connect: ' + err.message;

        showMsg(
            context === 'login' ? errorMessage : regErrorMsg,
            msg,
            'error'
        );
    }

    setConnecting(false, context);
}

// ─── Disconnect ───────────────────────────────────────────────────────────────
function disconnectWallet() {
    walletAddress = '';
    selectedRole  = '';
    roleDropdown.value = '';
    updateLoginWalletUI();
    updateLoginButtonState();
    clearMsg(errorMessage);
}

function disconnectRegWallet() {
    regWalletAddress = '';
    regSelectedRole  = '';
    regRoleDropdown.value = '';
    regNameInput.value = '';
    updateRegisterWalletUI();
    updateRegisterButtonState();
    clearMsg(regErrorMsg);
    clearMsg(regSuccessMsg);
}

// ─── Role Handlers ────────────────────────────────────────────────────────────
function handleRoleChange() {
    selectedRole = roleDropdown.value;
    updateLoginButtonState();
    clearMsg(errorMessage);
}

function handleRegRoleChange() {
    regSelectedRole = regRoleDropdown.value;
    updateRegisterButtonState();
}

// ─── Login ────────────────────────────────────────────────────────────────────
async function handleLogin() {
    clearMsg(errorMessage);

    if (!walletAddress) { showMsg(errorMessage, 'Please connect your wallet first.', 'error'); return; }
    if (!selectedRole)  { showMsg(errorMessage, 'Please select a role.', 'error'); return; }

    loginBtn.textContent = 'Logging in…';
    loginBtn.disabled    = true;

    try {
        const response = await fetch('http://localhost:5000/api/users/connect-wallet', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ walletAddress, role: selectedRole })
        });

        const data = await response.json();

        if (response.ok) {
            // If wallet is registered under a different role, warn the user
            if (data.data?.role && data.data.role !== selectedRole) {
                showMsg(
                    errorMessage,
                    `This wallet is registered as "${data.data.role}". Please select the correct role.`,
                    'error'
                );
                loginBtn.textContent = 'Login to Dashboard';
                loginBtn.disabled    = false;
                return;
            }

            localStorage.setItem('walletAddress', walletAddress);
            localStorage.setItem('role', selectedRole);
            // FIX: store full user object so NGO dashboard can access MongoDB _id
            if (data && data.data) {
              localStorage.setItem('userData', JSON.stringify(data.data));
            }

            redirectToDashboard(selectedRole);
        } else {
            showMsg(errorMessage, data.message || 'Login failed. Please try again.', 'error');
            loginBtn.textContent = 'Login to Dashboard';
            loginBtn.disabled    = false;
        }
    } catch {
        showMsg(errorMessage, 'Network error. Please check if the backend server is running.', 'error');
        loginBtn.textContent = 'Login to Dashboard';
        loginBtn.disabled    = false;
    }
}

// ─── Register ─────────────────────────────────────────────────────────────────
async function handleRegister() {
    clearMsg(regErrorMsg);
    clearMsg(regSuccessMsg);

    if (!regWalletAddress) { showMsg(regErrorMsg, 'Please connect your wallet first.', 'error'); return; }
    if (!regSelectedRole)  { showMsg(regErrorMsg, 'Please select a role.', 'error'); return; }

    registerBtn.textContent = 'Registering…';
    registerBtn.disabled    = true;

    try {
        const response = await fetch('http://localhost:5000/api/users/register', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
                walletAddress: regWalletAddress,
                role: regSelectedRole
            })
        });

        const data = await response.json();

        if (response.ok) {
            showMsg(regSuccessMsg, '✅ Account created! Redirecting to login…', 'success');

            // Auto-fill login tab and redirect after a moment
            setTimeout(() => {
                switchTab('login');
                walletAddress = regWalletAddress;
                selectedRole  = regSelectedRole;
                roleDropdown.value = regSelectedRole;
                updateLoginWalletUI();
                updateLoginButtonState();
            }, 1500);
        } else {
            showMsg(
                regErrorMsg,
                data.message || 'Registration failed. Wallet may already be registered.',
                'error'
            );
        }
    } catch {
        showMsg(regErrorMsg, 'Network error. Please check if the backend server is running.', 'error');
    }

    registerBtn.textContent = 'Create Account';
    registerBtn.disabled    = false;
    updateRegisterButtonState();
}

// ─── Redirect helper ──────────────────────────────────────────────────────────
function redirectToDashboard(role) {
    switch (role) {
        case 'NGO':       window.location.href = '../NGO/Dashboardngo.html'; break;
        case 'Industry':  window.location.href = '../Industry/DashboardIndustry.html'; break;
        case 'Panchayat': window.location.href = '../Panchayat/DashboardPanchayat.html'; break;
        default:          window.location.href = 'dashboard.html';
    }
}

// ─── UI Updaters ──────────────────────────────────────────────────────────────
function updateLoginWalletUI() {
    if (walletAddress) {
        walletSection.style.display    = 'none';
        walletConnected.style.display  = 'flex';
        walletAddressDisplay.textContent = formatAddress(walletAddress);
        roleDropdown.disabled = false;
    } else {
        walletSection.style.display    = 'block';
        walletConnected.style.display  = 'none';
        roleDropdown.disabled = true;
    }
}

function updateRegisterWalletUI() {
    if (regWalletAddress) {
        regWalletSection.style.display    = 'none';
        regWalletConnected.style.display  = 'flex';
        regWalletAddressDisplay.textContent = formatAddress(regWalletAddress);
        regNameInput.disabled     = false;
        regRoleDropdown.disabled  = false;
    } else {
        regWalletSection.style.display    = 'block';
        regWalletConnected.style.display  = 'none';
        regNameInput.disabled     = true;
        regRoleDropdown.disabled  = true;
    }
}

function updateLoginButtonState() {
    loginBtn.disabled = !(walletAddress && selectedRole);
}

function updateRegisterButtonState() {
    const name = regNameInput ? regNameInput.value.trim() : '';
    registerBtn.disabled = !(regWalletAddress && regSelectedRole && name);
}

// Live validation on name input
if (regNameInput) {
    regNameInput.addEventListener('input', updateRegisterButtonState);
}

// ─── Connecting state ─────────────────────────────────────────────────────────
function setConnecting(state, context) {
    isConnecting = state;
    const btn = context === 'login' ? connectWalletBtn : regConnectBtn;
    if (!btn) return;
    btn.textContent = state ? 'Connecting…' : '';
    if (!state) {
        btn.innerHTML = '<span class="btn-icon">🦊</span> Connect MetaMask Wallet';
    }
    btn.disabled = state;
}

// ─── Message helpers ──────────────────────────────────────────────────────────
function showMsg(el, message, type) {
    if (!el) return;
    el.textContent     = message;
    el.style.display   = 'block';
    el.className       = type === 'success' ? 'success-message' : 'error-message';
}

function clearMsg(el) {
    if (!el) return;
    el.textContent   = '';
    el.style.display = 'none';
}

function formatAddress(address) {
    if (!address) return '';
    return `${address.substring(0, 6)}…${address.substring(address.length - 4)}`;
}

// ─── MetaMask event listeners ─────────────────────────────────────────────────
if (typeof window.ethereum !== 'undefined') {
    window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length > 0) {
            // Update whichever tab is active
            if (walletAddress) {
                walletAddress = accounts[0];
                updateLoginWalletUI();
                updateLoginButtonState();
            }
            if (regWalletAddress) {
                regWalletAddress = accounts[0];
                updateRegisterWalletUI();
                updateRegisterButtonState();
            }
        } else {
            disconnectWallet();
            disconnectRegWallet();
        }
    });

    window.ethereum.on('chainChanged', () => window.location.reload());
}

// ─── Auto-restore session ─────────────────────────────────────────────────────
window.addEventListener('load', () => {
    const storedWallet = localStorage.getItem('walletAddress');
    const storedRole   = localStorage.getItem('role');

    if (storedWallet && storedRole && typeof window.ethereum !== 'undefined') {
        window.ethereum.request({ method: 'eth_accounts' })
            .then(accounts => {
                if (accounts.length > 0 &&
                    accounts[0].toLowerCase() === storedWallet.toLowerCase()) {
                    walletAddress      = accounts[0];
                    selectedRole       = storedRole;
                    roleDropdown.value = storedRole;
                    updateLoginWalletUI();
                    updateLoginButtonState();
                }
            })
            .catch(err => console.error('Session restore error:', err));
    }
});