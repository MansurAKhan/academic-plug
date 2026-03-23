const DATA_URL = './data/site-data.json';
const STORAGE_KEYS = {
  subject: 'academic_plug_subject',
  recentUnits: 'academic_plug_recent_units',
  activity: 'academic_plug_activity'
};

const state = {
  data: null,
  supabase: null,
  currentUser: null,
  recoveryMode: false,
  authConfigured: false
};

function query(key) {
  return new URLSearchParams(window.location.search).get(key);
}

function $(selector) {
  return document.querySelector(selector);
}

function $all(selector) {
  return Array.from(document.querySelectorAll(selector));
}

async function loadData() {
  if (state.data) return state.data;
  const response = await fetch(DATA_URL);
  if (!response.ok) throw new Error('Failed to load Academic Plug data');
  state.data = await response.json();
  return state.data;
}

function getConfiguredSupabase() {
  const config = window.ACADEMIC_PLUG_SUPABASE_CONFIG || {};
  if (!config.url || !config.anonKey || config.url.includes('YOUR_') || config.anonKey.includes('YOUR_')) {
    state.authConfigured = false;
    return null;
  }
  if (!state.supabase && window.supabase?.createClient) {
    state.supabase = window.supabase.createClient(config.url, config.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
  }
  state.authConfigured = Boolean(state.supabase);
  return state.supabase;
}

function mapUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email || '',
    name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Student'
  };
}

function getStoredUser() {
  return state.currentUser;
}

async function hydrateAuth() {
  const client = getConfiguredSupabase();
  state.recoveryMode = new URLSearchParams(window.location.hash.replace(/^#/, '')).get('type') === 'recovery';
  if (!client) {
    state.currentUser = null;
    return;
  }

  const { data, error } = await client.auth.getSession();
  if (!error) {
    state.currentUser = mapUser(data.session?.user || null);
  }

  client.auth.onAuthStateChange((event, session) => {
    state.currentUser = mapUser(session?.user || null);
    if (event === 'PASSWORD_RECOVERY') {
      state.recoveryMode = true;
      const resetForm = $('[data-auth-form="reset"]');
      if (resetForm) switchAuthView('reset');
    }
  });
}

function authRedirectUrl() {
  return new URL('./login.html', window.location.href).toString();
}

function setFeedback(node, message, kind = '') {
  if (!node) return;
  node.textContent = message || '';
  node.className = `inline-feedback ${kind}`.trim();
}

async function signOutUser() {
  const client = getConfiguredSupabase();
  if (client) await client.auth.signOut();
  state.currentUser = null;
}

function switchAuthView(view) {
  $all('[data-auth-tab]').forEach((node) => node.classList.toggle('active', node.dataset.authTab === view));
  $all('[data-auth-form]').forEach((form) => form.classList.toggle('hidden', form.dataset.authForm !== view));
}

function getStoredRecentUnits() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.recentUnits) || '[]');
  } catch {
    return [];
  }
}

function setStoredRecentUnits(units) {
  localStorage.setItem(STORAGE_KEYS.recentUnits, JSON.stringify(units));
}

function getStoredActivity() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.activity) || '[]');
  } catch {
    return [];
  }
}

function setStoredActivity(items) {
  localStorage.setItem(STORAGE_KEYS.activity, JSON.stringify(items));
}

function labelForReason(reason, itemTitle = '') {
  if (reason === 'video') return `Opened video${itemTitle ? `: ${itemTitle}` : ''}`;
  if (reason === 'questions') return `Opened practice${itemTitle ? `: ${itemTitle}` : ''}`;
  return 'Opened unit';
}

function recordActivity(subject, unit, reason = 'unit', item = null) {
  if (!subject || !unit) return;
  const entry = {
    id: `${subject.id}:${unit.id}:${reason}:${item?.id || 'none'}:${Date.now()}`,
    subjectId: subject.id,
    subjectName: subject.name,
    unitId: unit.id,
    unitTitle: unit.title,
    reason,
    itemId: item?.id || null,
    itemTitle: item?.title || item?.label || '',
    label: labelForReason(reason, item?.title || item?.label || ''),
    updatedAt: new Date().toISOString()
  };
  const activity = getStoredActivity();
  activity.unshift(entry);
  setStoredActivity(activity.slice(0, 12));
}

function recordRecentUnit(subject, unit, reason = 'unit', item = null) {
  if (!subject || !unit) return;
  const entry = {
    subjectId: subject.id,
    subjectName: subject.name,
    unitId: unit.id,
    unitTitle: unit.title,
    reason,
    updatedAt: new Date().toISOString()
  };
  const recent = getStoredRecentUnits().filter((item) => !(item.subjectId === subject.id && item.unitId === unit.id));
  recent.unshift(entry);
  setStoredRecentUnits(recent.slice(0, 3));
  recordActivity(subject, unit, reason, item);
}

function relativeTime(isoString) {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const minutes = Math.max(1, Math.floor(diffMs / 60000));
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function getStoredSubjectId() {
  return localStorage.getItem(STORAGE_KEYS.subject);
}

function setStoredSubjectId(id) {
  localStorage.setItem(STORAGE_KEYS.subject, id);
}

function getSubject(data, subjectId = null) {
  const resolvedId = subjectId || query('subject') || getStoredSubjectId() || data.subjects[0]?.id;
  const subject = data.subjects.find((item) => item.id === resolvedId) || data.subjects[0];
  if (subject) setStoredSubjectId(subject.id);
  return subject;
}

function getUnit(subject, unitId = null) {
  if (!subject) return null;
  const resolvedId = unitId || query('unit') || subject.units[0]?.id;
  return subject.units.find((item) => item.id === resolvedId) || subject.units[0] || null;
}

function findItem(items, itemId = null) {
  const resolvedId = itemId || null;
  if (!Array.isArray(items) || !items.length) return null;
  if (!resolvedId) return items[0];
  return items.find((item) => item.id === resolvedId) || items[0];
}

function routeFor(page, params = {}) {
  const url = new URL(page, window.location.href);
  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });
  return url.pathname + url.search;
}

function resourceLinkMarkup(item, label = 'Open resource') {
  if (!item?.url) return '';
  return `<a class="chip-link" href="${item.url}" target="_blank" rel="noreferrer">${label}</a>`;
}

function renderResourcePills(items) {
  return items.map((item) => `
    <div class="resource-pill">
      <strong>${item.label}</strong>
      <small>${item.kind}</small>
      ${resourceLinkMarkup(item, 'Open')}
    </div>
  `).join('');
}

function libraryViews() {
  return [
    { id: 'all', label: 'All units' },
    { id: 'videos', label: 'Video lessons' },
    { id: 'questions', label: 'Question bank' },
    { id: 'resources', label: 'Resources' }
  ];
}

function conciseFeedback(text) {
  if (!text) return 'Review the method and compare it with the strongest answer choice.';
  const cleaned = text
    .replace(/\s+/g, ' ')
    .replace(/The lesson supports this when it explains:.*/i, '')
    .replace(/A related lesson statement is:.*/i, '')
    .replace(/Relevant teaching point:.*/i, '')
    .trim();
  if (!cleaned) return 'Review the method and compare it with the strongest answer choice.';
  return cleaned.length > 220 ? `${cleaned.slice(0, 217).trim()}...` : cleaned;
}

function concisePrompt(text) {
  if (!text) return '';
  return text
    .replace(/^In the IB .*? lesson on .*?,\s*/i, '')
    .replace(/\s+in the lesson on .*?\?$/i, '?')
    .replace(/\s+in an IB-style question on .*?\?$/i, '?')
    .trim();
}

function practiceMeta(item, unit) {
  const bits = [];
  bits.push('IB Paper 1 style');
  if (item?.questions?.length) bits.push(`${item.questions.length} MCQs`);
  if (unit?.title) bits.push(unit.title);
  return bits;
}

function toYouTubeEmbed(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('youtu.be')) {
      return `https://www.youtube.com/embed/${parsed.pathname.slice(1)}`;
    }
    if (parsed.hostname.includes('youtube.com')) {
      const id = parsed.searchParams.get('v');
      const list = parsed.searchParams.get('list');
      if (id && list) return `https://www.youtube.com/embed/${id}?list=${list}`;
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
  } catch {
    return null;
  }
  return null;
}

function bindGlobalShell(data) {
  const user = getStoredUser();
  const activeSubject = getSubject(data);
  const activeUnit = query('unit') ? getUnit(activeSubject, query('unit')) : null;
  const activeView = query('view') || 'all';

  $all('[data-feedback-email]').forEach((node) => {
    node.textContent = data.site.feedbackEmail;
    node.href = `mailto:${data.site.feedbackEmail}`;
  });

  $all('[data-pluggpt-link]').forEach((node) => {
    const url = new URL(data.site.plugGptUrl, window.location.href);
    if (activeSubject) url.searchParams.set('subject', activeSubject.name.replace(/^IB\s+/, '').toLowerCase());
    node.href = url.toString();
  });

  $all('[data-user-name]').forEach((node) => {
    node.textContent = user?.name || 'Student';
  });

  const homeUser = $('[data-home-user]');
  const homeLogin = $('[data-home-login]');
  const heroLogin = $('[data-home-hero-login]');
  const heroDashboard = $('[data-home-hero-dashboard]');

  if (homeUser && homeLogin) {
    homeUser.classList.toggle('hidden', !user);
    homeLogin.classList.toggle('hidden', !!user);
  }

  if (heroLogin && heroDashboard) {
    heroLogin.classList.toggle('hidden', !!user);
    heroDashboard.classList.toggle('hidden', !user);
  }

  const courseDashboardLink = $('[data-course-dashboard-link]');
  if (courseDashboardLink) courseDashboardLink.href = routeFor('./dashboard.html');

  const librarySubjectLink = $('[data-library-subject-link]');
  if (librarySubjectLink && activeSubject) {
    librarySubjectLink.href = routeFor('./course.html', { subject: activeSubject.id });
  }

  const unitLibraryLink = $('[data-unit-library-link]');
  if (unitLibraryLink && activeSubject) {
    unitLibraryLink.href = routeFor('./library.html', { subject: activeSubject.id, view: activeView === 'all' ? null : activeView });
  }

  const videoUnitLink = $('[data-video-unit-link]');
  if (videoUnitLink && activeSubject && activeUnit) {
    videoUnitLink.href = routeFor('./unit.html', { subject: activeSubject.id, unit: activeUnit.id });
  }

  const questionsUnitLink = $('[data-questions-unit-link]');
  if (questionsUnitLink && activeSubject && activeUnit) {
    questionsUnitLink.href = routeFor('./unit.html', { subject: activeSubject.id, unit: activeUnit.id });
  }

  $all('[data-logout]').forEach((button) => {
    button.addEventListener('click', async () => {
      await signOutUser();
      window.location.href = './index.html';
    });
  });
}

function renderHome(data) {
  $('[data-site-tagline]').textContent = data.site.tagline;
  $('[data-site-about]').textContent = data.site.about;
}

function renderLogin() {
  const user = getStoredUser();
  const client = getConfiguredSupabase();
  const mode = query('mode');
  const loginForm = $('[data-auth-form="login"]');
  const signupForm = $('[data-auth-form="signup"]');
  const forgotForm = $('[data-auth-form="forgot"]');
  const resetForm = $('[data-auth-form="reset"]');
  const loginError = $('[data-login-error]');
  const signupError = $('[data-signup-error]');
  const forgotFeedback = $('[data-forgot-feedback]');
  const resetFeedback = $('[data-reset-feedback]');
  const authBanner = $('[data-auth-banner]');

  if (user && !state.recoveryMode && mode !== 'forgot') {
    window.location.href = './dashboard.html';
    return;
  }

  if (!client) {
    setFeedback(authBanner, 'Auth is not configured yet. Add your Supabase project URL and anon key in supabase-config.js.', 'warn');
  }

  $all('[data-auth-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      switchAuthView(button.dataset.authTab);
      setFeedback(loginError, '');
      setFeedback(signupError, '');
      setFeedback(forgotFeedback, '');
      setFeedback(resetFeedback, '');
      setFeedback(authBanner, client ? '' : 'Auth is not configured yet. Add your Supabase project URL and anon key in supabase-config.js.', client ? '' : 'warn');
    });
  });

  $all('[data-auth-link]').forEach((button) => {
    button.addEventListener('click', () => {
      const targetView = button.dataset.authLink;
      if (targetView === 'forgot') {
        window.history.replaceState({}, document.title, './login.html?mode=forgot');
      } else if (query('mode')) {
        window.history.replaceState({}, document.title, './login.html');
      }
      switchAuthView(targetView);
      setFeedback(loginError, '');
      setFeedback(signupError, '');
      setFeedback(forgotFeedback, '');
      setFeedback(resetFeedback, '');
    });
  });

  if (user?.email) {
    const loginEmail = $('[name="loginEmail"]');
    if (loginEmail) loginEmail.value = user.email;
  }

  if (state.recoveryMode) {
    switchAuthView('reset');
    setFeedback(authBanner, 'Choose a new password for your account.', 'success');
  } else if (mode === 'forgot') {
    switchAuthView('forgot');
  }

  loginForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = $('[name="loginEmail"]')?.value.trim().toLowerCase();
    const password = $('[name="loginPassword"]')?.value || '';

    if (!email || !password) {
      setFeedback(loginError, 'Enter your email and password.', 'error');
      return;
    }

    if (!client) {
      setFeedback(loginError, 'Auth is not configured yet.', 'error');
      return;
    }

    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) {
      setFeedback(loginError, error.message, 'error');
      return;
    }

    state.currentUser = mapUser(data.user);
    window.location.href = './dashboard.html';
  });

  signupForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const name = $('[name="signupName"]')?.value.trim();
    const email = $('[name="signupEmail"]')?.value.trim().toLowerCase();
    const password = $('[name="signupPassword"]')?.value || '';
    const confirmPassword = $('[name="signupConfirmPassword"]')?.value || '';

    if (!name || !email || !password || !confirmPassword) {
      setFeedback(signupError, 'Fill in every field to create an account.', 'error');
      return;
    }
    if (password.length < 6) {
      setFeedback(signupError, 'Password must be at least 6 characters.', 'error');
      return;
    }
    if (password !== confirmPassword) {
      setFeedback(signupError, 'Passwords do not match.', 'error');
      return;
    }
    if (!client) {
      setFeedback(signupError, 'Auth is not configured yet.', 'error');
      return;
    }

    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
        emailRedirectTo: authRedirectUrl()
      }
    });
    if (error) {
      setFeedback(signupError, error.message, 'error');
      return;
    }

    state.currentUser = mapUser(data.user);
    if (data.session) {
      window.location.href = './dashboard.html';
      return;
    }
    setFeedback(signupError, 'Account created. Check your email to confirm your address, then log in.', 'success');
  });

  forgotForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = $('[name="forgotEmail"]')?.value.trim().toLowerCase();
    if (!email) {
      setFeedback(forgotFeedback, 'Enter your email address.', 'error');
      return;
    }
    if (!client) {
      setFeedback(forgotFeedback, 'Auth is not configured yet.', 'error');
      return;
    }
    const { error } = await client.auth.resetPasswordForEmail(email, {
      redirectTo: authRedirectUrl()
    });
    if (error) {
      setFeedback(forgotFeedback, error.message, 'error');
      return;
    }
    setFeedback(forgotFeedback, 'Password reset link sent. Check your inbox.', 'success');
  });

  resetForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const password = $('[name="resetPassword"]')?.value || '';
    const confirmPassword = $('[name="resetConfirmPassword"]')?.value || '';
    if (password.length < 6) {
      setFeedback(resetFeedback, 'Password must be at least 6 characters.', 'error');
      return;
    }
    if (password !== confirmPassword) {
      setFeedback(resetFeedback, 'Passwords do not match.', 'error');
      return;
    }
    if (!client) {
      setFeedback(resetFeedback, 'Auth is not configured yet.', 'error');
      return;
    }
    const { error } = await client.auth.updateUser({ password });
    if (error) {
      setFeedback(resetFeedback, error.message, 'error');
      return;
    }
    state.recoveryMode = false;
    window.history.replaceState({}, document.title, './login.html');
    setFeedback(resetFeedback, 'Password updated. You can log in now.', 'success');
    switchAuthView('login');
  });
}

function renderForgotPage() {
  const client = getConfiguredSupabase();
  const form = $('[data-forgot-page-form]');
  const banner = $('[data-forgot-page-banner]');
  const feedback = $('[data-forgot-page-feedback]');
  const user = getStoredUser();

  if (user && !state.recoveryMode) {
    window.location.href = './dashboard.html';
    return;
  }

  if (!client) {
    setFeedback(banner, 'Auth is not configured yet. Add your Supabase project URL and anon key in supabase-config.js.', 'warn');
  }

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = $('[name="forgotPageEmail"]')?.value.trim().toLowerCase();
    if (!email) {
      setFeedback(feedback, 'Enter your email address.', 'error');
      return;
    }
    if (!client) {
      setFeedback(feedback, 'Auth is not configured yet.', 'error');
      return;
    }
    const { error } = await client.auth.resetPasswordForEmail(email, {
      redirectTo: authRedirectUrl()
    });
    if (error) {
      setFeedback(feedback, error.message, 'error');
      return;
    }
    setFeedback(feedback, 'Password reset link sent. Check your inbox.', 'success');
  });
}

function renderDashboard(data) {
  const user = getStoredUser() || { name: 'Student' };
  const continueList = $('[data-continue-list]');
  const continueEmpty = $('[data-continue-empty]');
  const subjectsList = $('[data-subject-list]');
  const latestTitle = $('[data-latest-unit-title]');
  const latestMeta = $('[data-latest-unit-meta]');
  const latestSummary = $('[data-latest-unit-summary]');
  const latestOpen = $('[data-latest-unit-open]');
  const latestActivityList = $('[data-latest-activity-list]');
  const recent = getStoredRecentUnits();
  const activity = getStoredActivity();

  $('[data-dashboard-heading]').innerHTML = `Welcome back,<br><span>${user.name}</span>!`;

  if (recent.length < 3) {
    continueList.innerHTML = '';
    continueEmpty.classList.remove('hidden');
  } else {
    continueEmpty.classList.add('hidden');
    continueList.innerHTML = recent.map((entry) => `
      <a href="${routeFor('./unit.html', { subject: entry.subjectId, unit: entry.unitId })}">
        ${entry.unitTitle}<br>
        <small>${entry.subjectName}</small>
      </a>
    `).join('');
  }

  subjectsList.innerHTML = data.subjects.map((subject) => `
    <button class="subject-row" type="button" data-dashboard-subject="${subject.id}">
      <strong>${subject.name}</strong>
      <span>${subject.units.length} units available</span>
    </button>
  `).join('');

  $all('[data-dashboard-subject]').forEach((button) => {
    button.addEventListener('click', () => {
      const id = button.dataset.dashboardSubject;
      setStoredSubjectId(id);
      window.location.href = routeFor('./course.html', { subject: id });
    });
  });

  if (recent[0]) {
    const subject = getSubject(data, recent[0].subjectId);
    const unit = getUnit(subject, recent[0].unitId);
    latestTitle.textContent = unit?.title || recent[0].unitTitle;
    latestMeta.textContent = `${subject?.name || recent[0].subjectName} • Last opened ${new Date(recent[0].updatedAt).toLocaleDateString()}`;
    latestSummary.textContent = unit?.summary || 'Continue working through this unit from where you left off.';
    latestOpen.classList.remove('hidden');
    latestOpen.href = routeFor('./unit.html', { subject: recent[0].subjectId, unit: recent[0].unitId });
  }

  if (latestActivityList) {
    latestActivityList.innerHTML = activity.length
      ? activity.slice(0, 5).map((entry) => `
        <a class="activity-row" href="${routeFor('./unit.html', { subject: entry.subjectId, unit: entry.unitId })}">
          <strong>${entry.label}</strong>
          <span>${entry.subjectName} • ${entry.unitTitle}</span>
          <small>${relativeTime(entry.updatedAt)}</small>
        </a>
      `).join('')
      : '<p class="empty-state">Activity will appear here once you open a unit, lesson, or practice set.</p>';
  }
}

function renderCourse(data) {
  const subject = getSubject(data);
  $('[data-course-title]').textContent = subject.name;
  $('[data-course-subtitle]').textContent = subject.description;
  $('[data-course-resource-list]').innerHTML = subject.resources.length
    ? renderResourcePills(subject.resources)
    : '<p class="empty-state">No extra resources added for this subject yet.</p>';

  $('[data-subject-actions]').innerHTML = [
    { label: 'Practice Questions', detail: 'Open the full practice library with a unit-by-unit breakdown.', href: routeFor('./library.html', { subject: subject.id, view: 'questions' }), icon: '?' },
    { label: 'Video Lessons', detail: 'Browse all video lessons organized by unit.', href: routeFor('./library.html', { subject: subject.id, view: 'videos' }), icon: '▶' },
    { label: 'Extra Resources', detail: 'Formula sheets, guides, and support material.', href: routeFor('./library.html', { subject: subject.id, view: 'resources' }), icon: '◎' },
    { label: 'Open Lesson', detail: 'Open the unit library and choose where to continue.', href: routeFor('./library.html', { subject: subject.id }), icon: '→' }
  ].map((item) => `
    <a class="subject-action-card" href="${item.href}">
      <span class="material-icon">${item.icon}</span>
      <div>
        <strong>${item.label}</strong>
        <p>${item.detail}</p>
      </div>
    </a>
  `).join('');
}

function renderLibrary(data) {
  const subject = getSubject(data);
  const view = query('view') || 'all';
  const viewConfig = {
    all: { title: 'Showing all units.', empty: 'No units are available yet.' },
    videos: { title: 'Showing video lessons by unit.', empty: 'No units with video lessons are available yet.' },
    questions: { title: 'Showing question banks by unit.', empty: 'No units with question banks are available yet.' },
    resources: { title: 'Showing resource libraries by unit.', empty: 'No units with resources are available yet.' }
  };
  $('[data-library-title]').textContent = `${subject.name} Library`;
  $('[data-library-subtitle]').textContent = 'Move unit by unit. Each section is split the way students actually revise: lessons, question banks, and support material.';
  $('[data-library-filter-note]').textContent = viewConfig[view]?.title || viewConfig.all.title;

  const nav = $('[data-library-nav]');
  if (nav) {
    nav.innerHTML = libraryViews().map((item) => `
      <a class="library-tab ${item.id === view ? 'active' : ''}" href="${routeFor('./library.html', { subject: subject.id, view: item.id === 'all' ? null : item.id })}">
        ${item.label}
      </a>
    `).join('');
  }

  const subjectResourcesPanel = $('[data-library-subject-resources-panel]');
  const subjectResources = $('[data-library-subject-resources]');
  if ((view === 'resources' || view === 'all') && subject.resources.length) {
    subjectResourcesPanel?.classList.remove('hidden');
    if (subjectResources) subjectResources.innerHTML = renderResourcePills(subject.resources);
  } else {
    subjectResourcesPanel?.classList.add('hidden');
  }

  const filteredUnits = subject.units.filter((unit) => {
    if (view === 'videos') return unit.videos.length > 0;
    if (view === 'questions') return unit.practices.length > 0;
    if (view === 'resources') return unit.resources.length > 0;
    return true;
  });

  $('[data-unit-library]').innerHTML = filteredUnits.map((unit, index) => {
    const items = [];
    if (view === 'all' || view === 'videos') {
      items.push(...unit.videos.map((item) => `
        <a class="library-item-link" href="${routeFor('./video.html', { subject: subject.id, unit: unit.id, video: item.id })}">
          <span>Video lesson</span>
          <strong>${item.title}</strong>
        </a>
      `));
    }
    if (view === 'all' || view === 'questions') {
      items.push(...unit.practices.map((item) => `
        <a class="library-item-link" href="${routeFor('./questions.html', { subject: subject.id, unit: unit.id, practice: item.id })}">
          <span>Question bank</span>
          <strong>${item.title}</strong>
        </a>
      `));
    }
    if (view === 'all' || view === 'resources') {
      items.push(...unit.resources.map((item) => `
        <a class="library-item-link" href="${item.url || routeFor('./unit.html', { subject: subject.id, unit: unit.id })}" ${item.url ? 'target="_blank" rel="noreferrer"' : ''}>
          <span>Resource</span>
          <strong>${item.label}</strong>
        </a>
      `));
    }

    return `
      <article class="unit-library-card revision-card">
        <div class="unit-card-index">${String(index + 1).padStart(2, '0')}</div>
        <div class="unit-card-head">
          <div>
            <h2>${unit.title}</h2>
            <p>${unit.summary}</p>
          </div>
          <a class="pill-btn yellow small" href="${routeFor('./unit.html', { subject: subject.id, unit: unit.id, view: view === 'all' ? null : view })}">Open unit</a>
        </div>
        <div class="unit-card-meta">
          <span>${unit.videos.length} lesson${unit.videos.length === 1 ? '' : 's'}</span>
          <span>${unit.practices.length} question set${unit.practices.length === 1 ? '' : 's'}</span>
          <span>${unit.resources.length} resource${unit.resources.length === 1 ? '' : 's'}</span>
        </div>
        <div class="unit-card-links">
          ${items.join('') || '<p class="empty-state">No items for this library view yet.</p>'}
        </div>
      </article>
    `;
  }).join('') || `<p class="empty-state">${viewConfig[view]?.empty || viewConfig.all.empty}</p>`;
}

function renderUnit(data) {
  const subject = getSubject(data);
  const unit = getUnit(subject);
  const preferredView = query('view') || 'all';
  recordRecentUnit(subject, unit, 'unit');
  $('[data-unit-subject-name]').textContent = subject.name;
  $('[data-unit-title]').textContent = unit.title;
  $('[data-unit-subtitle]').textContent = unit.summary;
  $('[data-unit-library-link]').href = routeFor('./library.html', { subject: subject.id, view: preferredView === 'all' ? null : preferredView });
  $('[data-unit-meta]').innerHTML = [
    `${unit.videos.length} video lesson${unit.videos.length === 1 ? '' : 's'}`,
    `${unit.practices.length} question set${unit.practices.length === 1 ? '' : 's'}`,
    `${(unit.resources.length + subject.resources.length)} total resource${(unit.resources.length + subject.resources.length) === 1 ? '' : 's'}`
  ].map((item) => `<span>${item}</span>`).join('');
  $('[data-unit-actions]').innerHTML = [
    { label: 'Video library', href: routeFor('./library.html', { subject: subject.id, view: 'videos' }) },
    { label: 'Question bank', href: routeFor('./library.html', { subject: subject.id, view: 'questions' }) },
    { label: 'Resources', href: routeFor('./library.html', { subject: subject.id, view: 'resources' }) }
  ].map((item) => `<a class="pill-btn ghost small" href="${item.href}">${item.label}</a>`).join('');

  $('[data-unit-videos]').innerHTML = unit.videos.length
    ? unit.videos.map((item) => `<a class="unit-item-card" href="${routeFor('./video.html', { subject: subject.id, unit: unit.id, video: item.id })}"><strong>${item.title}</strong><small>${item.kind}</small><p>${item.detail || 'Open this lesson resource.'}</p></a>`).join('')
    : '<p class="empty-state">No video lessons are linked for this unit yet.</p>';

  $('[data-unit-practices]').innerHTML = unit.practices.length
    ? unit.practices.map((item) => `<a class="unit-item-card" href="${routeFor('./questions.html', { subject: subject.id, unit: unit.id, practice: item.id })}"><strong>${item.title}</strong><small>${item.kind}</small><p>${item.detail || 'Open this practice resource.'}</p></a>`).join('')
    : '<p class="empty-state">No dedicated practice resources are linked for this unit yet.</p>';

  const combinedResources = [...unit.resources, ...subject.resources];
  $('[data-unit-resources]').innerHTML = combinedResources.length
    ? combinedResources.map((item) => `<div class="unit-item-card"><strong>${item.label}</strong><small>${item.kind}</small><p>${item.detail || 'Reference material for this unit.'}</p>${resourceLinkMarkup(item)}</div>`).join('')
    : '<p class="empty-state">No extra resources are linked for this unit yet.</p>';
}

function renderVideo(data) {
  const subject = getSubject(data);
  const unit = getUnit(subject);
  const item = findItem(unit.videos, query('video'));
  const embed = item?.url ? toYouTubeEmbed(item.url) : null;
  recordRecentUnit(subject, unit, 'video', item);

  $('[data-video-page-title]').textContent = `${subject.name} - ${unit.title}`;
  $('[data-video-title]').textContent = item?.title || 'Video resource';
  $('[data-video-meta]').textContent = embed ? 'Embedded lesson available below.' : 'External resource';
  $('[data-video-summary]').textContent = item?.detail || 'No additional lesson notes were provided for this item yet.';

  const frame = $('[data-video-frame]');
  const shell = $('[data-video-shell]');
  const external = $('[data-video-open-external]');
  if (embed) {
    frame.src = embed;
    frame.classList.remove('hidden');
    external.classList.add('hidden');
  } else {
    frame.remove();
    shell.innerHTML = '<div class="external-resource-card"><strong>No inline player available.</strong><p>This item opens as an external playlist, document, or resource link.</p></div>';
    if (item?.url) {
      external.href = item.url;
      external.classList.remove('hidden');
    }
  }

  $('[data-video-back]').href = routeFor('./unit.html', { subject: subject.id, unit: unit.id });
  const firstPractice = unit.practices[0];
  $('[data-video-next]').href = firstPractice ? routeFor('./questions.html', { subject: subject.id, unit: unit.id, practice: firstPractice.id }) : routeFor('./unit.html', { subject: subject.id, unit: unit.id });
}

function renderQuestions(data) {
  const subject = getSubject(data);
  const unit = getUnit(subject);
  const item = findItem(unit.practices, query('practice'));
  recordRecentUnit(subject, unit, 'questions', item);

  $('[data-questions-title]').textContent = `${subject.name} - ${unit.title}`;
  $('[data-questions-unit-link]').href = routeFor('./unit.html', { subject: subject.id, unit: unit.id });
  $('[data-practice-meta]').innerHTML = practiceMeta(item, unit).map((bit) => `<span>${bit}</span>`).join('');
  $('[data-practice-title]').textContent = item?.title || 'Practice resource';
  $('[data-practice-description]').textContent = item?.detail || 'Open the linked practice resource for this unit.';

  const openButton = $('[data-practice-open]');
  if (item?.url) {
    openButton.href = item.url;
    openButton.classList.remove('hidden');
  } else {
    openButton.classList.add('hidden');
  }

  const generatedPanel = $('[data-generated-questions-panel]');
  const generatedList = $('[data-generated-question-list]');
  const generatedForm = $('[data-generated-mcq-form]');
  const generatedScore = $('[data-generated-score]');
  if (item?.questions?.length) {
    generatedPanel.classList.remove('hidden');
    generatedList.innerHTML = item.questions.map((question, index) => `
      <li class="practice-question-item">
        <p><strong>Paper 1 MCQ ${index + 1}</strong><br>${concisePrompt(question.prompt)}</p>
        <div class="practice-choice-list">
          ${question.choices.map((choice, choiceIndex) => `
            <label class="choice-option question-option">
              <input type="radio" name="${question.id}" value="${choiceIndex}" />
              <span>${String.fromCharCode(65 + choiceIndex)}. ${choice}</span>
            </label>
          `).join('')}
        </div>
        <div class="inline-feedback hidden" data-generated-feedback="${question.id}"></div>
      </li>
    `).join('');

    generatedForm?.addEventListener('submit', (event) => {
      event.preventDefault();
      let correct = 0;
      item.questions.forEach((question) => {
        const selected = document.querySelector(`input[name="${question.id}"]:checked`);
        const feedback = document.querySelector(`[data-generated-feedback="${question.id}"]`);
        if (!selected) {
          feedback.textContent = 'Select an answer.';
          feedback.className = 'inline-feedback warn';
          return;
        }
        const isCorrect = Number(selected.value) === question.answer;
        const answerLabel = question.choices?.[question.answer];
        if (isCorrect) correct += 1;
        feedback.textContent = isCorrect
          ? `Correct. ${conciseFeedback(question.explanation)}`
          : `Not quite. Correct answer: ${answerLabel}. ${conciseFeedback(question.explanation)}`;
        feedback.className = `inline-feedback ${isCorrect ? 'success' : 'error'}`;
      });
      generatedScore.textContent = `Score: ${correct} / ${item.questions.length}`;
      generatedScore.className = 'inline-feedback success';
    });
  } else {
    generatedPanel.classList.add('hidden');
    generatedList.innerHTML = '';
    if (generatedScore) generatedScore.textContent = '';
  }

  $('[data-practice-notes]').innerHTML = [
    'Use this as guided practice, not answer-copying material.',
    item?.questions?.length ? 'Work through the generated questions first, then use PlugGPT to check unclear points.' : 'Open the external practice resource and work through it actively instead of passively skimming.',
    'Move back to the unit page if you want the related videos and support resources.',
    'Open PlugGPT if you want help breaking down the concept or checking your reasoning.'
  ].map((line) => `<div class="unit-item-card"><p>${line}</p></div>`).join('');
}

async function start() {
  const page = document.body.dataset.page;
  await hydrateAuth();
  const data = await loadData();
  bindGlobalShell(data);

  if (page === 'home') renderHome(data);
  if (page === 'login') renderLogin();
  if (page === 'forgot') renderForgotPage();
  if (page === 'dashboard') renderDashboard(data);
  if (page === 'course') renderCourse(data);
  if (page === 'library') renderLibrary(data);
  if (page === 'unit') renderUnit(data);
  if (page === 'video') renderVideo(data);
  if (page === 'questions') renderQuestions(data);
}

start().catch((error) => {
  console.error(error);
  const mount = document.querySelector('[data-page-error]');
  if (mount) mount.textContent = 'The page could not load its content.';
});
