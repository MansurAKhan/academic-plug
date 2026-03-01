const DATA_URL = './data/site-data.json';
const STORAGE_KEYS = {
  user: 'academic_plug_user',
  users: 'academic_plug_users',
  subject: 'academic_plug_subject',
  recentUnits: 'academic_plug_recent_units'
};

const state = { data: null };

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

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.user) || 'null');
  } catch {
    return null;
  }
}

function setStoredUser(user) {
  localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
}

function clearStoredUser() {
  localStorage.removeItem(STORAGE_KEYS.user);
}

function getStoredUsers() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.users) || '[]');
  } catch {
    return [];
  }
}

function setStoredUsers(users) {
  localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(users));
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

function recordRecentUnit(subject, unit, reason = 'unit') {
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

  $all('[data-feedback-email]').forEach((node) => {
    node.textContent = data.site.feedbackEmail;
    node.href = `mailto:${data.site.feedbackEmail}`;
  });

  $all('[data-pluggpt-link]').forEach((node) => {
    const url = new URL(data.site.plugGptUrl, window.location.href);
    if (activeSubject) url.searchParams.set('subject', activeSubject.name.replace(/^IB\s+/, '').toLowerCase());
    node.href = url.pathname + url.search;
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

  $all('[data-logout]').forEach((button) => {
    button.addEventListener('click', () => {
      clearStoredUser();
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
  const users = getStoredUsers();
  const loginForm = $('[data-auth-form="login"]');
  const signupForm = $('[data-auth-form="signup"]');
  const loginError = $('[data-login-error]');
  const signupError = $('[data-signup-error]');

  $all('[data-auth-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      const tab = button.dataset.authTab;
      $all('[data-auth-tab]').forEach((node) => node.classList.toggle('active', node === button));
      $all('[data-auth-form]').forEach((form) => form.classList.toggle('hidden', form.dataset.authForm !== tab));
      if (loginError) loginError.textContent = '';
      if (signupError) signupError.textContent = '';
    });
  });

  if (user?.email) {
    const loginEmail = $('[name="loginEmail"]');
    if (loginEmail) loginEmail.value = user.email;
  }

  loginForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    const email = $('[name="loginEmail"]')?.value.trim().toLowerCase();
    const password = $('[name="loginPassword"]')?.value || '';
    const existingUser = users.find((item) => item.email === email);

    if (!email || !password) {
      loginError.textContent = 'Enter your email and password.';
      loginError.className = 'inline-feedback error visible';
      return;
    }

    if (!existingUser || existingUser.password !== password) {
      loginError.textContent = 'Incorrect email or password.';
      loginError.className = 'inline-feedback error visible';
      return;
    }

    setStoredUser({ name: existingUser.name, email: existingUser.email });
    window.location.href = './dashboard.html';
  });

  signupForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = $('[name="signupName"]')?.value.trim();
    const email = $('[name="signupEmail"]')?.value.trim().toLowerCase();
    const password = $('[name="signupPassword"]')?.value || '';
    const confirmPassword = $('[name="signupConfirmPassword"]')?.value || '';

    if (!name || !email || !password || !confirmPassword) {
      signupError.textContent = 'Fill in every field to create an account.';
      signupError.className = 'inline-feedback error visible';
      return;
    }
    if (password.length < 6) {
      signupError.textContent = 'Password must be at least 6 characters.';
      signupError.className = 'inline-feedback error visible';
      return;
    }
    if (password !== confirmPassword) {
      signupError.textContent = 'Passwords do not match.';
      signupError.className = 'inline-feedback error visible';
      return;
    }
    if (users.some((item) => item.email === email)) {
      signupError.textContent = 'An account with that email already exists.';
      signupError.className = 'inline-feedback error visible';
      return;
    }

    const newUser = { name, email, password };
    setStoredUsers([...users, newUser]);
    setStoredUser({ name, email });
    window.location.href = './dashboard.html';
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
  const recent = getStoredRecentUnits();

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
}

function renderCourse(data) {
  const subject = getSubject(data);
  $('[data-course-title]').textContent = subject.name;
  $('[data-course-subtitle]').textContent = subject.description;
  $('[data-course-resource-list]').innerHTML = subject.resources.length
    ? subject.resources.map((item) => `<div class="resource-pill"><strong>${item.label}</strong><small>${item.kind}</small>${item.url ? `<a href="${item.url}" target="_blank" rel="noreferrer">Open</a>` : ''}</div>`).join('')
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
  $('[data-library-title]').textContent = `${subject.name} Library`;
  $('[data-library-subtitle]').textContent = 'Choose a unit, then open the specific videos, question resources, or study materials connected to that topic.';
  $('[data-library-filter-note]').textContent = view === 'all' ? 'Showing all units.' : `Showing ${view} by unit.`;

  const filteredUnits = subject.units.filter((unit) => {
    if (view === 'videos') return unit.videos.length > 0;
    if (view === 'questions') return unit.practices.length > 0;
    if (view === 'resources') return unit.resources.length > 0 || subject.resources.length > 0;
    return true;
  });

  $('[data-unit-library]').innerHTML = filteredUnits.map((unit) => `
    <article class="unit-library-card">
      <div class="unit-card-head">
        <div>
          <h2>${unit.title}</h2>
          <p>${unit.summary}</p>
        </div>
        <a class="pill-btn yellow small" href="${routeFor('./unit.html', { subject: subject.id, unit: unit.id })}">Open unit</a>
      </div>
      <div class="unit-card-meta">
        ${unit.videos.length ? `<span>${unit.videos.length} video item${unit.videos.length === 1 ? '' : 's'}</span>` : ''}
        ${unit.practices.length ? `<span>${unit.practices.length} practice item${unit.practices.length === 1 ? '' : 's'}</span>` : ''}
        ${unit.resources.length ? `<span>${unit.resources.length} resource item${unit.resources.length === 1 ? '' : 's'}</span>` : ''}
      </div>
      <div class="unit-card-links">
        ${view !== 'questions' ? unit.videos.map((item) => `<a href="${routeFor('./video.html', { subject: subject.id, unit: unit.id, video: item.id })}">${item.title}</a>`).join('') : ''}
        ${view !== 'videos' ? unit.practices.map((item) => `<a href="${routeFor('./questions.html', { subject: subject.id, unit: unit.id, practice: item.id })}">${item.title}</a>`).join('') : ''}
        ${view === 'resources' || view === 'all' ? unit.resources.map((item) => `<span class="resource-link-chip">${item.label}</span>`).join('') : ''}
      </div>
    </article>
  `).join('') || '<p class="empty-state">No matching units are available for this view yet.</p>';
}

function renderUnit(data) {
  const subject = getSubject(data);
  const unit = getUnit(subject);
  recordRecentUnit(subject, unit, 'unit');
  $('[data-unit-title]').textContent = unit.title;
  $('[data-unit-subtitle]').textContent = unit.summary;

  $('[data-unit-videos]').innerHTML = unit.videos.length
    ? unit.videos.map((item) => `<a class="unit-item-card" href="${routeFor('./video.html', { subject: subject.id, unit: unit.id, video: item.id })}"><strong>${item.title}</strong><small>${item.kind}</small><p>${item.detail || 'Open this lesson resource.'}</p></a>`).join('')
    : '<p class="empty-state">No video lessons are linked for this unit yet.</p>';

  $('[data-unit-practices]').innerHTML = unit.practices.length
    ? unit.practices.map((item) => `<a class="unit-item-card" href="${routeFor('./questions.html', { subject: subject.id, unit: unit.id, practice: item.id })}"><strong>${item.title}</strong><small>${item.kind}</small><p>${item.detail || 'Open this practice resource.'}</p></a>`).join('')
    : '<p class="empty-state">No dedicated practice resources are linked for this unit yet.</p>';

  $('[data-unit-resources]').innerHTML = unit.resources.length
    ? unit.resources.map((item) => `<div class="unit-item-card"><strong>${item.label}</strong><small>${item.kind}</small><p>${item.detail || 'Reference material for this unit.'}</p>${item.url ? `<a class="chip-link" href="${item.url}" target="_blank" rel="noreferrer">Open resource</a>` : ''}</div>`).join('')
    : '<p class="empty-state">No extra resources are linked for this unit yet.</p>';
}

function renderVideo(data) {
  const subject = getSubject(data);
  const unit = getUnit(subject);
  const item = findItem(unit.videos, query('video'));
  const embed = item?.url ? toYouTubeEmbed(item.url) : null;
  recordRecentUnit(subject, unit, 'video');

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
  recordRecentUnit(subject, unit, 'questions');

  $('[data-questions-title]').textContent = `${subject.name} - ${unit.title}`;
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
        <p><strong>Question ${index + 1}</strong><br>${question.prompt}</p>
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
        if (isCorrect) correct += 1;
        feedback.textContent = isCorrect ? 'Correct.' : question.explanation;
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
  const data = await loadData();
  bindGlobalShell(data);

  if (page === 'home') renderHome(data);
  if (page === 'login') renderLogin();
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
