const dataUrl = './data/resources.json';

const state = {
  subjects: [],
  filtered: [],
  activeId: null,
};

function qs(id) {
  return document.getElementById(id);
}

function renderHero(site) {
  qs('hero-description').textContent = `${site.tagline} ${site.description}`;
  qs('hero-stats').innerHTML = site.stats
    .map((item) => `
      <div class="stat-chip">
        <span>${item.label}</span>
        <strong>${item.value}</strong>
      </div>
    `)
    .join('');
}

function subjectCard(subject) {
  return `
    <article class="subject-card">
      <span class="subject-kicker" style="background:${subject.accent}20;color:${subject.accent};">${subject.theme}</span>
      <h3>${subject.name}</h3>
      <p>${subject.summary}</p>
    </article>
  `;
}

function renderSubjectGrid(subjects) {
  qs('subject-grid').innerHTML = subjects.map(subjectCard).join('');
}

function renderSubjectList() {
  const list = qs('subject-list');
  list.innerHTML = state.filtered
    .map((subject) => `
      <button type="button" data-id="${subject.id}" class="${subject.id === state.activeId ? 'active' : ''}">
        <strong>${subject.name}</strong>
        <span>${subject.theme}</span>
      </button>
    `)
    .join('');

  list.querySelectorAll('button').forEach((button) => {
    button.addEventListener('click', () => {
      state.activeId = button.dataset.id;
      renderSubjectList();
      renderSubjectDetail();
    });
  });
}

function resourceItem(item) {
  if (item.url) {
    return `
      <div class="resource-item">
        <a href="${item.url}" target="_blank" rel="noreferrer">${item.label}</a>
        ${item.detail ? `<p>${item.detail}</p>` : ''}
        <span class="resource-type">${item.type}</span>
      </div>
    `;
  }

  return `
    <div class="resource-item">
      <strong>${item.label}</strong>
      ${item.detail ? `<p>${item.detail}</p>` : ''}
      <span class="resource-type">${item.type}</span>
    </div>
  `;
}

function renderSubjectDetail() {
  const subject = state.subjects.find((item) => item.id === state.activeId) || state.filtered[0];
  const detail = qs('subject-detail');

  if (!subject) {
    detail.innerHTML = '<p>No subject matches that search.</p>';
    return;
  }

  state.activeId = subject.id;

  detail.innerHTML = `
    <span class="subject-kicker" style="background:${subject.accent}20;color:${subject.accent};">${subject.theme}</span>
    <h3>${subject.name}</h3>
    <p>${subject.summary}</p>
    ${subject.sections.map((section) => `
      <section class="resource-section">
        <h4>${section.title}</h4>
        <div class="resource-list">
          ${section.items.map(resourceItem).join('')}
        </div>
      </section>
    `).join('')}
  `;
}

function applySearch(value) {
  const term = value.trim().toLowerCase();
  state.filtered = state.subjects.filter((subject) => {
    return [subject.name, subject.theme, subject.summary]
      .join(' ')
      .toLowerCase()
      .includes(term);
  });

  if (!state.filtered.some((subject) => subject.id === state.activeId)) {
    state.activeId = state.filtered[0]?.id || null;
  }

  renderSubjectList();
  renderSubjectDetail();
}

async function start() {
  const resp = await fetch(dataUrl);
  const data = await resp.json();

  state.subjects = data.subjects;
  state.filtered = data.subjects;
  state.activeId = data.subjects[0]?.id || null;

  renderHero(data.site);
  renderSubjectGrid(data.subjects);
  renderSubjectList();
  renderSubjectDetail();

  qs('subject-search').addEventListener('input', (event) => {
    applySearch(event.target.value || '');
  });
}

start().catch((error) => {
  console.error(error);
  qs('subject-detail').innerHTML = '<p>Failed to load site data.</p>';
});
