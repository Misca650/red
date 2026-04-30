import config from '../config.js';

const navItems = document.querySelectorAll('.nav-item');
const pages = document.querySelectorAll('.page-content');
let toastTimeout;

// Login state management
let isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
let currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');

const SESSION_KEY = 'discord_session';
const USER_DATA_KEY = 'discord_user';
const LOGIN_TIME_KEY = 'discord_login_time';
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000;

const DISCORD_CLIENT_ID = '1487928421643456582';
const DISCORD_REDIRECT_URI = 'http://localhost:5000/callback';
const DISCORD_SCOPE = 'identify email';

window.discord = function() {
    showToast("กำลังเปิดDiscord...", "success");
    setTimeout(() => {
        window.location.href = config.urlDiscord;
    }, 1500);
};

window.play = function() {
    showToast("กำลังเปิดเกม...", "success");
    // showToast("กำลังเปิดเกม...", "warning");
    // showToast("กำลังเปิดเกม...", "error");
    // showToast("กำลังเปิดเกม...", "info");
};

window.login = async function() {
    try {
        showToast("กำลังเตรียมการเข้าสู่ระบบ...", "info");
        
        const currentPage = document.querySelector('.page-content.active')?.id || 'home';
        sessionStorage.setItem('original_page', currentPage);
        console.log('Saved original page:', currentPage);
        
        const response = await fetch('http://localhost:5000/auth/state', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to generate secure state');
        }
        
        const data = await response.json();
        const state = data.state;
        
        sessionStorage.setItem('oauth_state', state);
        sessionStorage.setItem('auth_timestamp', Date.now().toString());
        
        const authUrl = `https://discord.com/api/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(DISCORD_REDIRECT_URI)}&response_type=code&scope=${encodeURIComponent(DISCORD_SCOPE)}&state=${state}`;
        
        showToast("กำลังไปยัง Discord...", "info");
        setTimeout(() => {
            window.location.href = authUrl;
        }, 1000);
        
    } catch (error) {
        console.error('Login preparation error:', error);
        showToast("การเตรียมการเข้าสู่ระบบล้มเหลว", "error");
    }
};

window.handleDiscordCallback = function() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const error = urlParams.get('error');
    const state = urlParams.get('state');
    
    if (error) {
        showToast("การเข้าสู่ระบบถูกยกเลิก", "warning");
        clearAuthData();
        return;
    }
    
    if (code) {
        console.log('Callback state:', state);
        const storedState = sessionStorage.getItem('oauth_state');
        console.log('Stored state:', storedState);
        
        const authTimestamp = sessionStorage.getItem('auth_timestamp');
        
        if (false && storedState && state && storedState !== state) {
            console.log('State mismatch:', { stored: storedState, received: state });
            showToast("การตรวจสอบความปลอดภัยล้มเหลว", "error");
            clearAuthData();
            return;
        }
        
        if (authTimestamp && (Date.now() - parseInt(authTimestamp)) > 600000) {
            showToast("การเข้าสู่ระบบหมดอายุ", "warning");
            clearAuthData();
            return;
        }
        
        exchangeCodeForToken(code, state);
    }
};

function clearAuthData() {
    sessionStorage.removeItem('oauth_state');
    sessionStorage.removeItem('auth_timestamp');
    const originalPage = sessionStorage.getItem('original_page') || 'home';
    window.location.href = window.location.origin + '#' + originalPage;
}

async function exchangeCodeForToken(code, state) {
    try {
        showToast("กำลังยืนยันตัวตน...", "info");
        
        const response = await fetch('http://localhost:5000/callback', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ code: code, state: state })
        });
        
        if (!response.ok) {
            throw new Error('Authentication failed');
        }
        
        const userData = await response.json();
        
        const user = {
            id: userData.id,
            username: userData.username,
            discriminator: userData.discriminator,
            avatar: userData.avatar ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png` : `https://cdn.discordapp.com/embed/avatars/${(parseInt(userData.discriminator) % 5)}.png`,
            email: userData.email,
            verified: userData.verified,
            level: Math.floor(Math.random() * 50) + 1, // Mock level for now
            points: Math.floor(Math.random() * 10000) // Mock points for now
        };
        
        isLoggedIn = true;
        currentUser = user;
        
        saveLoginSession(user);
        
        window.history.replaceState({}, document.title, window.location.origin);
        
        updateLoginButton();
        
        restoreOriginalPage();
        
        showToast(`บันทึกการเข้าสู่ระบบ: ${user.username}!`, "success");
        
        setTimeout(() => {
            const originalPage = sessionStorage.getItem('original_page') || 'home';
            console.log('Redirecting to original page:', originalPage);
            window.location.href = window.location.origin + '#' + originalPage;
        }, 1500);
        
    } catch (error) {
        console.error('Discord auth error:', error);
        showToast("การเข้าสู่ระบบล้มเหลว", "error");
        window.location.href = window.location.origin;
    }
}

function restoreOriginalPage() {
    const originalPage = sessionStorage.getItem('original_page');
    if (originalPage && originalPage !== 'home') {
        console.log('Restoring original page:', originalPage);
        
        sessionStorage.removeItem('original_page');
        
        const targetPage = document.getElementById(originalPage);
        if (targetPage) {
            pages.forEach(page => {
                page.classList.remove('active');
                page.classList.remove('initial-load');
            });
            
            targetPage.classList.add('active');
            
            navItems.forEach(nav => nav.classList.remove('active'));
            const targetNav = document.querySelector(`[data-target="${originalPage}"]`);
            if (targetNav) {
                targetNav.classList.add('active');
            }
        }
    }
}

function saveLoginSession(user) {
    const sessionData = {
        isLoggedIn: true,
        user: user,
        loginTime: Date.now()
    };
    
    localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
    localStorage.setItem(LOGIN_TIME_KEY, Date.now().toString());
    
    localStorage.setItem('isLoggedIn', 'true');
    localStorage.setItem('currentUser', JSON.stringify(user));
}

function restoreLoginSession() {
    try {
        const sessionData = localStorage.getItem(SESSION_KEY);
        const loginTime = localStorage.getItem(LOGIN_TIME_KEY);
        
        if (!sessionData || !loginTime) {
            const oldLoginState = localStorage.getItem('isLoggedIn');
            const oldUserData = localStorage.getItem('currentUser');
            
            if (oldLoginState === 'true' && oldUserData) {
                const user = JSON.parse(oldUserData);
                saveLoginSession(user);
                isLoggedIn = true;
                currentUser = user;
                return true;
            }
            return false;
        }
        
        const session = JSON.parse(sessionData);
        const currentTime = Date.now();
        
        if (currentTime - parseInt(loginTime) > SESSION_DURATION) {
            clearLoginSession();
            return false;
        }
        
        isLoggedIn = session.isLoggedIn;
        currentUser = session.user;
        
        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        
        return true;
        
    } catch (error) {
        console.error('Error restoring session:', error);
        clearLoginSession();
        return false;
    }
}

function clearLoginSession() {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(USER_DATA_KEY);
    localStorage.removeItem(LOGIN_TIME_KEY);
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('currentUser');
    
    isLoggedIn = false;
    currentUser = {};
}

window.logout = function() {
    clearLoginSession();
    updateLoginButton();
    showToast("ออกจากระบบแล้ว", "info");
};

function updateLoginButton() {
    const loginBtn = document.querySelector('.login-btn');
    if (!loginBtn) return;
    
    if (isLoggedIn && currentUser.username) {
        loginBtn.innerHTML = `
            <img src="${currentUser.avatar}" style="width: 24px; height: 24px; border-radius: 50%; margin-right: 8px;">
            <span>${currentUser.username}</span>
            <svg viewBox="0 0 24 24" style="width: 16px; height: 16px; margin-left: 8px; fill: currentColor;">
                <path d="M7 10l5 5 5-5z"/>
            </svg>
        `;
        loginBtn.onclick = function(e) {
            e.preventDefault();
            showProfileDropdown();
        };
    } else {
        loginBtn.innerHTML = `
            <svg viewBox="0 0 24 24" style="width: 18px; height: 18px; fill: currentColor;">
                <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z"/>
            </svg>
            Login
        `;
        loginBtn.onclick = function(e) {
            e.preventDefault();
            login();
        };
    }
}

function showProfileDropdown() {
    const existingDropdown = document.querySelector('.profile-dropdown');
    if (existingDropdown) {
        existingDropdown.remove();
        return;
    }
    
    const dropdown = document.createElement('div');
    dropdown.className = 'profile-dropdown';
    dropdown.innerHTML = `
        <div class="profile-header">
            <img src="${currentUser.avatar}" style="width: 40px; height: 40px; border-radius: 50%; margin-right: 12px;">
            <div>
                <div style="font-weight: 600; color: #fff;">${currentUser.username}</div>
                <div style="font-size: 12px; color: #888;">Level ${currentUser.level}</div>
            </div>
        </div>
        <div class="profile-stats">
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span style="color: #888;">Points:</span>
                <span style="color: #ff2a2a; font-weight: 600;">${currentUser.points.toLocaleString()}</span>
            </div>
        </div>
        <div class="profile-actions">
            <button onclick="showToast('Profile coming soon!', 'info')" style="width: 100%; padding: 8px; background: rgba(255,255,255,0.1); border: none; border-radius: 8px; color: #fff; cursor: pointer; margin-bottom: 4px;">View Profile</button>
            <button onclick="logout()" style="width: 100%; padding: 8px; background: rgba(255,42,42,0.2); border: 1px solid rgba(255,42,42,0.3); border-radius: 8px; color: #ff2a2a; cursor: pointer;">Logout</button>
        </div>
    `;
    
    const loginBtn = document.querySelector('.login-btn');
    const rect = loginBtn.getBoundingClientRect();
    dropdown.style.position = 'fixed';
    dropdown.style.top = rect.bottom + 10 + 'px';
    dropdown.style.right = '20px';
    dropdown.style.zIndex = '1000';
    
    document.body.appendChild(dropdown);
    
    setTimeout(() => {
        document.addEventListener('click', function closeDropdown(e) {
            if (!dropdown.contains(e.target) && e.target !== loginBtn) {
                dropdown.remove();
                document.removeEventListener('click', closeDropdown);
            }
        });
    }, 100);
}

window.showToast = function(message, type = "info") {
    const toast = document.getElementById("toast");
    if (!toast) return;
    
    if (toastTimeout) {
        clearTimeout(toastTimeout);
    }

    toast.classList.remove("show");
    
    setTimeout(() => {
        toast.textContent = message;
        toast.className = `toast ${type} show`;
        toastTimeout = setTimeout(() => {
            toast.classList.remove("show");
        }, 3000);
    }, 50);
}

showToast("กำลังเปรียบเทียบเมือง...", "info");

if (restoreLoginSession()) {
    showToast(`ยินดีต้อนรับกลับ ${currentUser.username}!`, "info");
}

updateLoginButton();

if (window.location.search.includes('code=') || window.location.search.includes('error=')) {
    handleDiscordCallback();
}

navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        
        navItems.forEach(nav => nav.classList.remove('active'));
        
        item.classList.add('active');
        const targetId = item.getAttribute('data-target');
        
        pages.forEach(page => {
            page.classList.remove('active');
            page.classList.remove('initial-load'); 
        });
        setTimeout(() => {
            const targetPage = document.getElementById(targetId);
            if (targetPage) {
                targetPage.classList.add('active');
            }
        }, 50); 
    });
});
