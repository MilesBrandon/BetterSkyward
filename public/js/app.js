// ==========================================================================
// BetterSkyward • Core Application & Reactive Client
// High-density, anti-card academic workspace for Skyward Qmlativ
// ==========================================================================

class BetterSkywardApp {
  constructor() {
    // Application State
    this.data = null;
    this.session = null; // Ephemeral in-memory session only ({ type: 'live'|'demo', username, student })
    this.sessionRemainingSeconds = 600; // 10 minutes TTL
    this.sessionTimerInterval = null;
    this.lastTouch = Date.now();

    this.activeView = 'grades'; // 'grades' | 'action'
    this.activeStyle = localStorage.getItem('betterSkyward_style') || 'studio';
    this.activeTheme = localStorage.getItem('betterSkyward_theme') || 'dark';
    this.activeTerm = localStorage.getItem('betterSkyward_term') || 's1';
    this.activeSort = 'period'; // 'period' | 'grade' | 'name' | 'missing'
    this.searchQuery = '';
    this.selectedCourse = null;
    this.assignmentFilter = 'all'; // 'all' | 'missing' | 'graded'
    this.customNicknames = JSON.parse(localStorage.getItem('betterSkyward_nicknames') || '{}');

    // DOM Elements Cache
    this.dom = {
      // Splash Screen
      splashScreen: document.getElementById('splashScreen'),
      splashAlert: document.getElementById('splashAlert'),
      splashLoginForm: document.getElementById('splashLoginForm'),
      splashUsername: document.getElementById('splashUsername'),
      splashPassword: document.getElementById('splashPassword'),
      toggleSplashPwBtn: document.getElementById('toggleSplashPwBtn'),
      splashSubmitBtn: document.getElementById('splashSubmitBtn'),
      splashDemoBtn: document.getElementById('splashDemoBtn'),

      // App Shell & Header
      appContainer: document.getElementById('appContainer'),
      studentName: document.getElementById('studentName'),
      studentDistrict: document.getElementById('studentDistrict'),
      sessionTimerBadge: document.getElementById('sessionTimerBadge'),
      sessionTimerText: document.getElementById('sessionTimerText'),
      syncDot: document.getElementById('syncDot'),
      syncText: document.getElementById('syncText'),
      syncBtn: document.getElementById('syncBtn'),
      logoutBtn: document.getElementById('logoutBtn'),
      themeToggleBtn: document.getElementById('themeToggleBtn'),

      // Controls
      viewGradesBtn: document.getElementById('viewGradesBtn'),
      viewActionBtn: document.getElementById('viewActionBtn'),
      actionMissingBadge: document.getElementById('actionMissingBadge'),
      termBtns: document.querySelectorAll('.term-btn'),
      styleBtns: document.querySelectorAll('.style-btn'),

      // Views
      viewGrades: document.getElementById('viewGrades'),
      viewAction: document.getElementById('viewAction'),

      // KPI Metrics
      kpiCumGpa: document.getElementById('kpiCumGpa'),
      kpiTermGpa: document.getElementById('kpiTermGpa'),
      kpiCredits: document.getElementById('kpiCredits'),
      kpiPoints: document.getElementById('kpiPoints'),
      kpiMissingCount: document.getElementById('kpiMissingCount'),
      kpiMissingBadge: document.getElementById('kpiMissingBadge'),
      kpiMissingSubtext: document.getElementById('kpiMissingSubtext'),
      kpiCourseCount: document.getElementById('kpiCourseCount'),

      // Search & Sort
      courseSearchInput: document.getElementById('courseSearchInput'),
      clearSearchBtn: document.getElementById('clearSearchBtn'),
      sortBtns: document.querySelectorAll('.sort-btn'),
      coursesContainer: document.getElementById('coursesContainer'),

      // Action View
      actionUrgentCount: document.getElementById('actionUrgentCount'),
      missingSectionCount: document.getElementById('missingSectionCount'),
      missingAssignmentsList: document.getElementById('missingAssignmentsList'),
      upcomingSectionCount: document.getElementById('upcomingSectionCount'),
      upcomingAssignmentsList: document.getElementById('upcomingAssignmentsList'),
      actionViewAllClassesBtn: document.getElementById('actionViewAllClassesBtn'),

      // Inspector Drawer
      inspectorBackdrop: document.getElementById('inspectorBackdrop'),
      inspectorDrawer: document.getElementById('inspectorDrawer'),
      closeDrawerBtn: document.getElementById('closeDrawerBtn'),
      drawerPeriod: document.getElementById('drawerPeriod'),
      drawerCode: document.getElementById('drawerCode'),
      drawerRoom: document.getElementById('drawerRoom'),
      drawerCourseName: document.getElementById('drawerCourseName'),
      drawerTeacherName: document.getElementById('drawerTeacherName'),
      drawerTermName: document.getElementById('drawerTermName'),
      drawerGradeLetter: document.getElementById('drawerGradeLetter'),
      drawerGradePercent: document.getElementById('drawerGradePercent'),
      drawerGradeStatus: document.getElementById('drawerGradeStatus'),
      editNicknameBtn: document.getElementById('editNicknameBtn'),
      nicknameBar: document.getElementById('nicknameBar'),
      nicknameInput: document.getElementById('nicknameInput'),
      saveNicknameBtn: document.getElementById('saveNicknameBtn'),
      cancelNicknameBtn: document.getElementById('cancelNicknameBtn'),
      drawerCategoriesList: document.getElementById('drawerCategoriesList'),
      asgTabs: document.querySelectorAll('.asg-tab'),
      drawerAssignmentsList: document.getElementById('drawerAssignmentsList'),

      // Status Strip Toast
      statusStrip: document.getElementById('statusStrip'),
      statusMessage: document.getElementById('statusMessage')
    };

    this.init();
  }

  // --------------------------------------------------------------------------
  // Initialization & Ephemeral Session Gate
  // --------------------------------------------------------------------------
  init() {
    this.applyTheme(this.activeTheme);
    this.applyStylePreset(this.activeStyle);
    this.applyTermSelection(this.activeTerm);

    this.bindEvents();

    // Check for existing session token in sessionStorage (protects against F5)
    this.checkStoredSession();
  }

  // --------------------------------------------------------------------------
  // Event Bindings
  // --------------------------------------------------------------------------
  bindEvents() {
    // Splash Screen Login Submit
    this.dom.splashLoginForm.addEventListener('submit', (e) => this.handleSplashLogin(e));

    // Password Visibility Toggle
    this.dom.toggleSplashPwBtn.addEventListener('click', () => {
      const isPw = this.dom.splashPassword.type === 'password';
      this.dom.splashPassword.type = isPw ? 'text' : 'password';
      this.dom.toggleSplashPwBtn.textContent = isPw ? 'Hide' : 'Show';
    });

    // Explore with Demo Account
    this.dom.splashDemoBtn.addEventListener('click', () => this.handleDemoLogin());

    // Logout Button
    this.dom.logoutBtn.addEventListener('click', () => this.logout());

    // Primary View Switching
    this.dom.viewGradesBtn.addEventListener('click', () => this.switchView('grades'));
    this.dom.viewActionBtn.addEventListener('click', () => this.switchView('action'));
    this.dom.actionViewAllClassesBtn.addEventListener('click', () => this.switchView('grades'));

    // Academic Term Switching
    this.dom.termBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const term = e.currentTarget.dataset.term;
        this.applyTermSelection(term);
      });
    });

    // Style Presets
    this.dom.styleBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const style = e.currentTarget.dataset.styleSet;
        this.applyStylePreset(style);
      });
    });

    // Theme Toggle
    this.dom.themeToggleBtn.addEventListener('click', () => {
      const nextTheme = this.activeTheme === 'dark' ? 'light' : 'dark';
      this.applyTheme(nextTheme);
    });

    // Search & Clear
    this.dom.courseSearchInput.addEventListener('input', (e) => {
      this.searchQuery = e.target.value.toLowerCase().trim();
      this.dom.clearSearchBtn.style.display = this.searchQuery ? 'block' : 'none';
      this.renderGradebookView();
    });

    this.dom.clearSearchBtn.addEventListener('click', () => {
      this.dom.courseSearchInput.value = '';
      this.searchQuery = '';
      this.dom.clearSearchBtn.style.display = 'none';
      this.renderGradebookView();
    });

    // Sort Controls
    this.dom.sortBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.dom.sortBtns.forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.activeSort = e.currentTarget.dataset.sort;
        this.renderGradebookView();
      });
    });

    // Sync Live Data
    this.dom.syncBtn.addEventListener('click', () => this.triggerLiveSync());

    // Drawer Controls
    this.dom.closeDrawerBtn.addEventListener('click', () => this.closeInspector());
    this.dom.inspectorBackdrop.addEventListener('click', () => this.closeInspector());

    // Drawer Assignment Tabs
    this.dom.asgTabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        this.dom.asgTabs.forEach(t => t.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.assignmentFilter = e.currentTarget.dataset.filter;
        this.renderInspectorAssignments();
      });
    });

    // Nickname Editing
    this.dom.editNicknameBtn.addEventListener('click', () => {
      this.dom.nicknameBar.style.display = 'flex';
      this.dom.nicknameInput.value = this.getCourseDisplayName(this.selectedCourse);
      this.dom.nicknameInput.focus();
    });

    this.dom.cancelNicknameBtn.addEventListener('click', () => {
      this.dom.nicknameBar.style.display = 'none';
    });

    this.dom.saveNicknameBtn.addEventListener('click', () => {
      const newName = this.dom.nicknameInput.value.trim();
      if (this.selectedCourse) {
        if (newName) {
          this.customNicknames[this.selectedCourse.id] = newName;
        } else {
          delete this.customNicknames[this.selectedCourse.id];
        }
        localStorage.setItem('betterSkyward_nicknames', JSON.stringify(this.customNicknames));
        this.dom.drawerCourseName.textContent = this.getCourseDisplayName(this.selectedCourse);
        this.dom.nicknameBar.style.display = 'none';
        this.renderGradebookView();
        this.showToast('Nickname updated', 'info');
      }
    });

    // Global Activity Touch (Resets 10-minute inactivity countdown)
    ['mousedown', 'keydown', 'scroll', 'touchstart'].forEach(evtName => {
      window.addEventListener(evtName, () => this.touchActivity(), { passive: true });
    });

    // Global Escape Key listener
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeInspector();
      }
    });
  }

  // --------------------------------------------------------------------------
  // Multi-Tenant Session Management & Splash Screen
  // --------------------------------------------------------------------------
  showSplashScreen() {
    this.dom.splashScreen.classList.remove('hidden');
    this.dom.splashUsername.value = '';
    this.dom.splashPassword.value = '';
    this.dom.splashAlert.style.display = 'none';
    setTimeout(() => this.dom.splashUsername.focus(), 150);
  }

  hideSplashScreen() {
    this.dom.splashScreen.classList.add('hidden');
  }

  async checkStoredSession() {
    const savedSessionId = sessionStorage.getItem('better_skyward_session_id');

    if (!savedSessionId) {
      this.showSplashScreen();
      return;
    }

    try {
      this.showToast('Resuming active session...', 'loading');
      const response = await fetch('/api/skyward/sync', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${savedSessionId}`
        }
      });

      if (response.status === 401) {
        sessionStorage.removeItem('better_skyward_session_id');
        this.showSplashScreen();
        this.showToast('Session expired after 10 minutes of inactivity. Please sign in.', 'warning');
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to restore session');
      }

      const result = await response.json();
      if (result.success && result.data) {
        this.data = result.data;
        this.session = {
          type: 'live',
          username: result.data.student?.id || '',
          student: result.data.student,
          expiresAt: Date.now() + (result.expiresIn || 600) * 1000
        };
        this.hideSplashScreen();
        this.startSessionTimer(result.expiresIn || 600);
        this.renderAll();
        this.showToast(`Welcome back, ${result.data.student?.name || 'Student'}! Session resumed.`, 'success');
      } else {
        throw new Error(result.error || 'Failed to parse session data');
      }
    } catch (err) {
      sessionStorage.removeItem('better_skyward_session_id');
      this.showSplashScreen();
    }
  }

  async handleSplashLogin(e) {
    e.preventDefault();
    const username = this.dom.splashUsername.value.trim();
    const password = this.dom.splashPassword.value;

    if (!username || !password) return;

    this.dom.splashAlert.style.display = 'none';
    this.dom.splashSubmitBtn.disabled = true;
    this.dom.splashSubmitBtn.innerHTML = `
      <div class="spinner" style="width: 14px; height: 14px; border-width: 2px;"></div>
      <span>Authenticating with Skyward...</span>
    `;

    try {
      const response = await fetch('/api/skyward/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Authentication rejected by Skyward');
      }

      // Store sessionId exclusively in sessionStorage (survives F5, cleared on tab close)
      if (result.sessionId) {
        sessionStorage.setItem('better_skyward_session_id', result.sessionId);
      }

      // Ephemeral in-memory representation
      this.session = {
        type: 'live',
        username,
        student: result.student,
        expiresAt: Date.now() + (result.expiresIn || 600) * 1000
      };

      this.data = result.data;
      this.dom.splashPassword.value = ''; // Clean up credentials immediately
      this.hideSplashScreen();
      this.startSessionTimer(result.expiresIn || 600);
      this.renderAll();
      this.showToast(`Welcome, ${result.student?.name || username}! Live session active.`, 'success');
    } catch (err) {
      this.dom.splashAlert.textContent = err.message;
      this.dom.splashAlert.style.display = 'block';
    } finally {
      this.dom.splashSubmitBtn.disabled = false;
      this.dom.splashSubmitBtn.innerHTML = `
        <span>Sign In to Skyward</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="5" y1="12" x2="19" y2="12"/>
          <polyline points="12 5 19 12 12 19"/>
        </svg>
      `;
    }
  }

  async handleDemoLogin() {
    this.dom.splashDemoBtn.disabled = true;
    this.dom.splashDemoBtn.textContent = 'Loading demo environment...';

    try {
      // Demo mode runs purely client-side with zero server session overhead
      sessionStorage.removeItem('better_skyward_session_id');

      const response = await fetch('/api/grades?source=mock');
      if (!response.ok) throw new Error('Could not load demo records');

      this.data = await response.json();
      this.session = {
        type: 'demo',
        username: 'demo_alex',
        student: this.data.student,
        expiresAt: Date.now() + 600 * 1000
      };

      this.hideSplashScreen();
      this.startSessionTimer(600);
      this.renderAll();
      this.showToast('Demo session connected (Alex Mercer) • Client-side sandbox', 'info');
    } catch (err) {
      this.dom.splashAlert.textContent = 'Failed to load demo data: ' + err.message;
      this.dom.splashAlert.style.display = 'block';
    } finally {
      this.dom.splashDemoBtn.disabled = false;
      this.dom.splashDemoBtn.textContent = 'Explore with Demo Account (Alex Mercer)';
    }
  }

  startSessionTimer(seconds = 600) {
    clearInterval(this.sessionTimerInterval);
    this.sessionRemainingSeconds = seconds;
    this.updateTimerDisplay();

    this.sessionTimerInterval = setInterval(() => {
      this.sessionRemainingSeconds--;
      this.updateTimerDisplay();

      if (this.sessionRemainingSeconds <= 0) {
        clearInterval(this.sessionTimerInterval);
        this.handleSessionTimeout();
      }
    }, 1000);
  }

  touchActivity() {
    if (!this.session) return;
    const now = Date.now();
    // Throttle touch resets to once every 3 seconds
    if (now - this.lastTouch > 3000) {
      this.lastTouch = now;
      this.sessionRemainingSeconds = 600; // Reset 10m on user interaction
      this.updateTimerDisplay();
    }
  }

  updateTimerDisplay() {
    const mins = Math.floor(Math.max(0, this.sessionRemainingSeconds) / 60);
    const secs = Math.max(0, this.sessionRemainingSeconds) % 60;
    const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    this.dom.sessionTimerText.textContent = timeStr;

    const timerDot = this.dom.sessionTimerBadge.querySelector('.timer-dot');
    if (timerDot) {
      timerDot.className = 'timer-dot';
      if (this.sessionRemainingSeconds <= 30) {
        timerDot.classList.add('danger');
      } else if (this.sessionRemainingSeconds <= 120) {
        timerDot.classList.add('warning');
      }
    }
  }

  handleSessionTimeout() {
    this.logout('Session expired after 10 minutes of inactivity. Session terminated.');
  }

  async logout(message = 'Session ended • All ephemeral cache wiped.') {
    clearInterval(this.sessionTimerInterval);
    const sessionId = sessionStorage.getItem('better_skyward_session_id');
    sessionStorage.removeItem('better_skyward_session_id');

    this.session = null;
    this.data = null;
    this.closeInspector();

    if (sessionId) {
      try {
        await fetch('/api/skyward/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${sessionId}`
          }
        });
      } catch (e) {
        // Server not reachable or already cleared
      }
    }

    this.showSplashScreen();
    this.showToast(message, 'info');
  }

  // --------------------------------------------------------------------------
  // Data Fetching & Sync
  // --------------------------------------------------------------------------
  async triggerLiveSync() {
    if (!this.session) {
      this.showSplashScreen();
      return;
    }

    if (this.session.type === 'demo') {
      try {
        this.dom.syncDot.className = 'sync-dot syncing';
        this.dom.syncText.textContent = 'Syncing...';
        this.showToast('Refreshing demo data...', 'loading');

        const response = await fetch('/api/grades?source=mock');
        this.data = await response.json();
        this.renderAll();

        this.dom.syncDot.className = 'sync-dot';
        this.dom.syncText.textContent = 'Demo Mode';
        this.showToast('Demo data refreshed', 'success');
      } catch (err) {
        this.showToast('Failed to refresh demo data', 'error');
      }
      return;
    }

    // Live sync
    try {
      const sessionId = sessionStorage.getItem('better_skyward_session_id');
      if (!sessionId) {
        this.logout('No active session token. Please sign in again.');
        return;
      }

      this.dom.syncDot.className = 'sync-dot syncing';
      this.dom.syncText.textContent = 'Syncing...';
      this.showToast('Connecting to Skyward Qmlativ...', 'loading');

      const response = await fetch('/api/skyward/sync', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionId}`
        }
      });
      
      if (response.status === 401) {
        this.handleSessionTimeout();
        return;
      }

      const result = await response.json();
      if (result.success && result.data) {
        this.data = result.data;
        this.renderAll();
        this.sessionRemainingSeconds = result.expiresIn || 600; // Refresh 10m on sync
        this.dom.syncDot.className = 'sync-dot';
        this.dom.syncText.textContent = 'Live Connected';
        this.showToast('Live sync completed successfully', 'success');
      } else {
        throw new Error(result.error || 'Sync failed');
      }
    } catch (err) {
      console.error('Sync error:', err);
      this.dom.syncDot.className = 'sync-dot error';
      this.dom.syncText.textContent = 'Sync Failed';
      this.showToast(err.message || 'Live sync failed. Check credentials.', 'error');
    }
  }

  // --------------------------------------------------------------------------
  // Theme & Preset Application
  // --------------------------------------------------------------------------
  applyTheme(theme) {
    this.activeTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('betterSkyward_theme', theme);
  }

  applyStylePreset(style) {
    this.activeStyle = style;
    document.documentElement.setAttribute('data-style', style);
    localStorage.setItem('betterSkyward_style', style);

    this.dom.styleBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.styleSet === style);
    });
  }

  applyTermSelection(term) {
    this.activeTerm = term;
    localStorage.setItem('betterSkyward_term', term);

    this.dom.termBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.term === term);
    });

    if (this.data) {
      this.renderGradebookView();
      this.renderActionWorkView();
    }
  }

  switchView(view) {
    this.activeView = view;
    this.dom.viewGrades.classList.toggle('active', view === 'grades');
    this.dom.viewAction.classList.toggle('active', view === 'action');

    this.dom.viewGradesBtn.classList.toggle('active', view === 'grades');
    this.dom.viewActionBtn.classList.toggle('active', view === 'action');
    this.dom.viewGradesBtn.setAttribute('aria-selected', view === 'grades');
    this.dom.viewActionBtn.setAttribute('aria-selected', view === 'action');

    if (view === 'action') {
      this.renderActionWorkView();
    } else {
      this.renderGradebookView();
    }
  }

  // --------------------------------------------------------------------------
  // Master Renderers
  // --------------------------------------------------------------------------
  renderAll() {
    if (!this.data) return;
    this.renderHeaderAndKPIs();
    this.renderGradebookView();
    this.renderActionWorkView();
  }

  renderHeaderAndKPIs() {
    const { student, summary } = this.data;

    // Student identity
    this.dom.studentName.textContent = student?.name || 'Student Record';
    this.dom.studentDistrict.textContent = student?.district || student?.school || 'Alpine School District';

    // Summary KPIs
    this.dom.kpiCumGpa.textContent = summary?.unweightedGpa != null ? summary.unweightedGpa.toFixed(2) : '--';
    const termGpa = summary?.termGpa != null ? summary.termGpa.toFixed(2) : (summary?.liveCalculatedGpa != null ? summary.liveCalculatedGpa.toFixed(2) : '--');
    this.dom.kpiTermGpa.textContent = `TM1: ${termGpa}`;

    this.dom.kpiCredits.textContent = summary?.cumCredits != null ? summary.cumCredits.toFixed(2) : '--';
    this.dom.kpiPoints.textContent = summary?.cumPoints != null ? `${summary.cumPoints.toFixed(1)} Pts` : '-- Pts';

    // Missing work
    const missingCount = summary?.missingCount || 0;
    this.dom.kpiMissingCount.textContent = missingCount;
    if (missingCount > 0) {
      this.dom.kpiMissingCount.className = 'kpi-number alert';
      this.dom.kpiMissingBadge.className = 'kpi-pill alert';
      this.dom.kpiMissingBadge.textContent = `${missingCount} Missing`;
      this.dom.kpiMissingSubtext.textContent = 'Immediate submission required';
      this.dom.actionMissingBadge.textContent = missingCount;
      this.dom.actionMissingBadge.style.display = 'inline-block';
    } else {
      this.dom.kpiMissingCount.className = 'kpi-number';
      this.dom.kpiMissingBadge.className = 'kpi-pill good';
      this.dom.kpiMissingBadge.textContent = 'All Clear';
      this.dom.kpiMissingSubtext.textContent = 'All coursework submitted';
      this.dom.actionMissingBadge.style.display = 'none';
    }

    const totalCourses = summary?.activeCoursesCount || this.data.courses?.length || 0;
    this.dom.kpiCourseCount.textContent = totalCourses;
  }

  // --------------------------------------------------------------------------
  // VIEW 1: Courses & Grades Ledger Render
  // --------------------------------------------------------------------------
  renderGradebookView() {
    if (!this.data || !this.data.courses) return;

    let courses = [...this.data.courses];

    // Filter by Term
    if (this.activeTerm === 's1') {
      courses = courses.filter(c => c.semester === 1 || c.term?.includes('1') || !c.isUpcoming);
    } else if (this.activeTerm === 's2') {
      courses = courses.filter(c => c.semester === 2 || c.term?.includes('2') || c.isUpcoming);
    }

    // Filter by Search Query
    if (this.searchQuery) {
      courses = courses.filter(c => {
        const name = this.getCourseDisplayName(c).toLowerCase();
        const teacher = (c.teacher?.name || '').toLowerCase();
        const code = (c.courseCode || '').toLowerCase();
        const room = (c.room || '').toLowerCase();
        return name.includes(this.searchQuery) || 
               teacher.includes(this.searchQuery) || 
               code.includes(this.searchQuery) ||
               room.includes(this.searchQuery);
      });
    }

    // Sort Courses
    courses.sort((a, b) => {
      if (this.activeSort === 'period') {
        return (a.period || 0) - (b.period || 0);
      }
      if (this.activeSort === 'grade') {
        const scoreA = a.grade?.percent != null ? a.grade.percent : -1;
        const scoreB = b.grade?.percent != null ? b.grade.percent : -1;
        return scoreB - scoreA;
      }
      if (this.activeSort === 'name') {
        return this.getCourseDisplayName(a).localeCompare(this.getCourseDisplayName(b));
      }
      if (this.activeSort === 'missing') {
        return (b.missingCount || 0) - (a.missingCount || 0);
      }
      return 0;
    });

    if (courses.length === 0) {
      this.dom.coursesContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🔍</div>
          <h3>No Courses Found</h3>
          <p>No coursework matches the selected filters or search query.</p>
        </div>
      `;
      return;
    }

    // Render course rows
    this.dom.coursesContainer.innerHTML = courses.map(course => {
      const displayName = this.getCourseDisplayName(course);
      const gradeLetter = course.grade?.letter || 'N/A';
      const gradePercent = course.grade?.percent != null ? `${course.grade.percent.toFixed(1)}%` : '--';
      const gradeColorClass = this.getGradeColorClass(gradeLetter);
      const missingCount = course.missingCount || 0;

      // Render mini category progress bars
      const categoryBars = (course.categories || []).slice(0, 3).map(cat => {
        const pct = cat.percent != null ? Math.min(Math.max(cat.percent, 0), 100) : 0;
        return `
          <div class="category-mini-chip" title="${cat.name}: ${cat.percent != null ? cat.percent.toFixed(0) + '%' : 'N/A'}">
            <span>${this.abbreviateCategory(cat.name)}</span>
            <div class="cat-mini-bar">
              <div class="cat-mini-bar-fill" style="width: ${pct}%"></div>
            </div>
          </div>
        `;
      }).join('');

      return `
        <article class="course-card" data-course-id="${course.id}" role="button" tabindex="0" aria-label="${displayName}, Grade ${gradeLetter}">
          <!-- Period -->
          <div class="course-period-badge">
            <span>Period</span>
            <span class="course-period-num">${course.period || '-'}</span>
          </div>

          <!-- Course Identity -->
          <div class="course-identity">
            <div class="course-name-row">
              <span class="course-name">${displayName}</span>
            </div>
            <div class="course-meta">
              <span class="course-code">${course.courseCode || ''}</span>
              <span>•</span>
              <span>${course.teacher?.name || 'Instructor TBD'}</span>
              ${course.room ? `<span>•</span><span>${course.room}</span>` : ''}
            </div>
          </div>

          <!-- Categories Breakdown -->
          <div class="course-categories">
            <div class="category-chip-row">
              ${categoryBars || '<span class="no-missing-tag">No category weights</span>'}
            </div>
          </div>

          <!-- Missing Work Column -->
          <div class="course-missing-col">
            ${missingCount > 0 
              ? `<span class="missing-badge">⚠️ ${missingCount} Missing</span>` 
              : `<span class="no-missing-tag">✓ Complete</span>`
            }
          </div>

          <!-- Grade Display -->
          <div class="course-grade-block">
            <div class="grade-badge-wrap">
              <span class="course-grade-letter ${gradeColorClass}">${gradeLetter}</span>
              <span class="course-grade-percent">${gradePercent}</span>
            </div>
          </div>

          <!-- Drilldown Arrow -->
          <div class="course-drill-arrow" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </div>
        </article>
      `;
    }).join('');

    // Attach click handlers to course cards
    this.dom.coursesContainer.querySelectorAll('.course-card').forEach(card => {
      card.addEventListener('click', () => {
        const courseId = card.dataset.courseId;
        const course = this.data.courses.find(c => c.id === courseId);
        if (course) this.openInspector(course);
      });
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          card.click();
        }
      });
    });
  }

  // --------------------------------------------------------------------------
  // VIEW 2: Action & Missing Work Prioritized View Render
  // --------------------------------------------------------------------------
  renderActionWorkView() {
    if (!this.data || !this.data.courses) return;

    const allCourses = this.data.courses;
    const missingItems = [];
    const upcomingItems = [];

    // Collect all assignments
    allCourses.forEach(course => {
      const courseName = this.getCourseDisplayName(course);
      const assignments = course.assignments || [];

      assignments.forEach(asg => {
        const item = {
          ...asg,
          courseId: course.id,
          courseName,
          teacherName: course.teacher?.name || 'Instructor',
          teacherEmail: course.teacher?.email || ''
        };

        if (asg.status === 'missing' || asg.isMissing) {
          missingItems.push(item);
        } else if (asg.status === 'pending' || asg.status === 'upcoming' || (!asg.score && asg.score !== 0)) {
          upcomingItems.push(item);
        }
      });
    });

    // Update Counts & Badges
    this.dom.actionUrgentCount.textContent = `${missingItems.length} MISSING`;
    this.dom.missingSectionCount.textContent = `${missingItems.length} ${missingItems.length === 1 ? 'item' : 'items'}`;
    this.dom.upcomingSectionCount.textContent = `${upcomingItems.length} ${upcomingItems.length === 1 ? 'item' : 'items'}`;

    // Render Missing List
    if (missingItems.length === 0) {
      this.dom.missingAssignmentsList.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🎉</div>
          <h3>Zero Missing Assignments!</h3>
          <p>You have submitted all required coursework across all enrolled classes.</p>
        </div>
      `;
    } else {
      this.dom.missingAssignmentsList.innerHTML = missingItems.map(item => `
        <div class="action-item urgent" data-course-id="${item.courseId}">
          <div class="action-item-left">
            <span class="action-course-badge">${item.courseName}</span>
            <div class="action-details">
              <h4>${item.title}</h4>
              <p>
                <span>Due: ${item.dueDate || 'Immediate'}</span>
                <span>•</span>
                <span>Category: ${item.category || 'General'}</span>
                <span>•</span>
                <span>${item.teacherName}</span>
              </p>
            </div>
          </div>
          <div class="action-item-right">
            <span class="action-due-date urgent">0 / ${item.maxScore || 100} pts</span>
            <button class="btn-sm primary action-inspect-btn" data-course-id="${item.courseId}">Inspect</button>
          </div>
        </div>
      `).join('');
    }

    // Render Upcoming List
    if (upcomingItems.length === 0) {
      this.dom.upcomingAssignmentsList.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📅</div>
          <h3>No Pending Tasks</h3>
          <p>All posted assignments have been evaluated.</p>
        </div>
      `;
    } else {
      this.dom.upcomingAssignmentsList.innerHTML = upcomingItems.map(item => `
        <div class="action-item" data-course-id="${item.courseId}">
          <div class="action-item-left">
            <span class="action-course-badge">${item.courseName}</span>
            <div class="action-details">
              <h4>${item.title}</h4>
              <p>
                <span>Due: ${item.dueDate || 'Upcoming'}</span>
                <span>•</span>
                <span>Category: ${item.category || 'General'}</span>
              </p>
            </div>
          </div>
          <div class="action-item-right">
            <span class="action-due-date">Due ${item.dueDate || 'Soon'}</span>
            <button class="btn-sm action-inspect-btn" data-course-id="${item.courseId}">Inspect</button>
          </div>
        </div>
      `).join('');
    }

    // Attach inspect buttons in action view
    this.dom.viewAction.querySelectorAll('.action-inspect-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const courseId = btn.dataset.courseId;
        const course = this.data.courses.find(c => c.id === courseId);
        if (course) this.openInspector(course);
      });
    });
  }

  // --------------------------------------------------------------------------
  // Course Inspector Drawer
  // --------------------------------------------------------------------------
  openInspector(course) {
    this.selectedCourse = course;
    this.assignmentFilter = 'all';
    this.dom.asgTabs.forEach(t => t.classList.toggle('active', t.dataset.filter === 'all'));

    const displayName = this.getCourseDisplayName(course);
    const gradeLetter = course.grade?.letter || 'N/A';
    const gradePercent = course.grade?.percent != null ? `${course.grade.percent.toFixed(1)}%` : '--';
    const gradeColorClass = this.getGradeColorClass(gradeLetter);

    // Meta tags
    this.dom.drawerPeriod.textContent = `Period ${course.period || '-'}`;
    this.dom.drawerCode.textContent = course.courseCode || 'CODE';
    this.dom.drawerRoom.textContent = course.room ? `Room ${course.room}` : 'Main Campus';
    this.dom.drawerCourseName.textContent = displayName;
    this.dom.drawerTeacherName.textContent = course.teacher?.name || 'Instructor';
    this.dom.drawerTermName.textContent = course.term || 'Semester 1';

    // Grade score
    this.dom.drawerGradeLetter.textContent = gradeLetter;
    this.dom.drawerGradeLetter.className = `drawer-score-letter ${gradeColorClass}`;
    this.dom.drawerGradePercent.textContent = gradePercent;
    this.dom.drawerGradeStatus.textContent = course.grade?.isPassing ? 'Passing • Course in good standing' : 'Academic attention required';

    // Nickname bar reset
    this.dom.nicknameBar.style.display = 'none';

    // Render Categories
    this.renderInspectorCategories();

    // Render Assignments
    this.renderInspectorAssignments();

    // Show Drawer
    this.dom.inspectorBackdrop.classList.add('active');
    this.dom.inspectorDrawer.classList.add('active');
    this.dom.inspectorDrawer.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  closeInspector() {
    this.dom.inspectorBackdrop.classList.remove('active');
    this.dom.inspectorDrawer.classList.remove('active');
    this.dom.inspectorDrawer.setAttribute('aria-hidden', 'true');
    this.selectedCourse = null;
    document.body.style.overflow = '';
  }

  renderInspectorCategories() {
    const categories = this.selectedCourse?.categories || [];
    if (categories.length === 0) {
      this.dom.drawerCategoriesList.innerHTML = `
        <div class="empty-state">
          <p>No weighted category definitions recorded for this class.</p>
        </div>
      `;
      return;
    }

    this.dom.drawerCategoriesList.innerHTML = categories.map(cat => {
      const pct = cat.percent != null ? Math.min(Math.max(cat.percent, 0), 100) : 0;
      const weightText = cat.weight ? `${cat.weight}% Weight` : 'Unweighted';
      const scoreText = cat.earnedPoints != null && cat.possiblePoints != null 
        ? `${cat.earnedPoints} / ${cat.possiblePoints} pts (${cat.percent?.toFixed(1)}%)`
        : (cat.percent != null ? `${cat.percent.toFixed(1)}%` : 'No score');

      return `
        <div class="category-row-card">
          <div class="cat-row-top">
            <span class="cat-name">${cat.name}</span>
            <span class="cat-weight-pill">${weightText}</span>
          </div>
          <div class="cat-score-bar-bg">
            <div class="cat-score-bar-fill" style="width: ${pct}%"></div>
          </div>
          <div class="cat-score-text">
            <span>Score:</span>
            <span>${scoreText}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  renderInspectorAssignments() {
    const assignments = this.selectedCourse?.assignments || [];
    let filtered = [...assignments];

    if (this.assignmentFilter === 'missing') {
      filtered = filtered.filter(a => a.status === 'missing' || a.isMissing);
    } else if (this.assignmentFilter === 'graded') {
      filtered = filtered.filter(a => a.status === 'graded' || a.score != null);
    }

    if (filtered.length === 0) {
      this.dom.drawerAssignmentsList.innerHTML = `
        <div class="empty-state">
          <p>No assignments in this category.</p>
        </div>
      `;
      return;
    }

    this.dom.drawerAssignmentsList.innerHTML = filtered.map(asg => {
      const isMissing = asg.status === 'missing' || asg.isMissing;
      const scoreDisplay = isMissing 
        ? 'MISSING' 
        : (asg.score != null ? `${asg.score} / ${asg.maxScore || 100}` : 'Pending');

      return `
        <div class="asg-item ${isMissing ? 'missing' : ''}">
          <div class="asg-item-left">
            <div class="asg-item-title">${asg.title}</div>
            <div class="asg-item-sub">
              <span>Due: ${asg.dueDate || 'N/A'}</span>
              <span>•</span>
              <span>${asg.category || 'General'}</span>
              ${asg.notes ? `<span>• <em>${asg.notes}</em></span>` : ''}
            </div>
          </div>
          <div class="asg-item-right">
            <span class="asg-item-score ${isMissing ? 'missing' : ''}">${scoreDisplay}</span>
            <span class="asg-item-date">${asg.percent != null ? asg.percent.toFixed(0) + '%' : ''}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  // --------------------------------------------------------------------------
  // Helpers & Utility Methods
  // --------------------------------------------------------------------------
  getCourseDisplayName(course) {
    if (!course) return '';
    return this.customNicknames[course.id] || course.name || 'Unnamed Course';
  }

  getGradeColorClass(letter) {
    if (!letter) return 'grade-none';
    const firstChar = letter.trim().charAt(0).toUpperCase();
    if (firstChar === 'A') return 'grade-a';
    if (firstChar === 'B') return 'grade-b';
    if (firstChar === 'C') return 'grade-c';
    if (firstChar === 'D') return 'grade-d';
    if (firstChar === 'F') return 'grade-f';
    if (firstChar === 'P') return 'grade-p';
    return 'grade-none';
  }

  abbreviateCategory(name) {
    if (!name) return 'Cat';
    const clean = name.replace(/Assessments?/i, 'Asmt').replace(/Assignments?/i, 'Asg');
    return clean.length > 14 ? clean.substring(0, 12) + '…' : clean;
  }

  showToast(message, type = 'info') {
    this.dom.statusMessage.textContent = message;
    const dot = this.dom.statusStrip.querySelector('.status-dot');
    if (dot) {
      dot.style.background = type === 'error' ? 'var(--alert-red)' : 
                             type === 'loading' ? 'var(--accent)' : 'var(--grade-a)';
    }
  }
}

// Instantiate on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new BetterSkywardApp();
});
