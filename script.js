/* =============================================
   BAND BOARD — Script
   ============================================= */

// ---- CONFIG ----
const ACCESS_CODE = 'BAND2025';
const JB_BIN_ID  = '6a08e1b9c0954111d833cc82';
const JB_API_KEY = '$2a$10$mKABUNWen4x.00rTvx0kc.WCGi6RCFrW6Dzv2IS7eug/v4rqeIaAW';
const JB_API     = `https://api.jsonbin.io/v3/b/${JB_BIN_ID}`;

// ---- STATE ----
let projects = [];
let moodCards = [];
let currentProjectId = null;
let currentMoodId = null;
let currentSort = 'created';
let currentFilter = 'all';
let currentView = 'grid';

// ---- UTILS ----
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/\n/g, '<br>');
}

function escAttr(str) {
  return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function deadlineStatus(dateStr) {
  if (!dateStr) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  const d = new Date(dateStr);
  const diff = Math.ceil((d - today) / 86400000);
  if (diff < 0) return 'overdue';
  if (diff <= 7) return 'soon';
  return 'ok';
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
}

// ---- STORAGE ----
async function load() {
  try {
    const res = await fetch(JB_API + '/latest', {
      headers: { 'X-Access-Key': JB_API_KEY }
    });
    const data = await res.json();
    projects  = data.record.projects  || [];
    moodCards = data.record.moodCards || [];
  } catch(e) {
    console.error('Failed to load from JSONBin', e);
    projects  = [];
    moodCards = [];
  }
}

async function save() {
  try {
    await fetch(JB_API, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Access-Key': JB_API_KEY,
      },
      body: JSON.stringify({ projects, moodCards }),
    });
  } catch(e) {
    console.error('Failed to save to JSONBin', e);
    alert('Save failed — check your connection.');
  }
}

// ---- GATE ----
const gate = document.getElementById('gate');
const app = document.getElementById('app');
const gateInput = document.getElementById('gateInput');
const gateBtn = document.getElementById('gateBtn');
const gateError = document.getElementById('gateError');
const lockBtn = document.getElementById('lockBtn');

function unlock() {
  const val = gateInput.value.trim().toUpperCase();
  if (val === ACCESS_CODE.toUpperCase()) {
    gate.classList.add('hidden');
    app.classList.remove('hidden');
    gateError.textContent = '';
    gateInput.value = '';
    renderAll();
  } else {
    gateError.textContent = 'VERPISS DICH!';
    gateInput.value = '';
    gateInput.focus();
  }
}

gateBtn.addEventListener('click', unlock);
gateInput.addEventListener('keydown', e => { if (e.key === 'Enter') unlock(); });
document.addEventListener('DOMContentLoaded', () => gateInput.focus());

lockBtn.addEventListener('click', () => {
  app.classList.add('hidden');
  gate.classList.remove('hidden');
  gateInput.focus();
});

// ---- TABS ----
const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    tabContents.forEach(c => c.classList.add('hidden'));
    tab.classList.add('active');
    document.getElementById('tab-' + tab.dataset.tab).classList.remove('hidden');
  });
});

// ---- PROJECTS ----
const projectList = document.getElementById('projectList');
const projectModal = document.getElementById('projectModal');
const addProjectBtn = document.getElementById('addProjectBtn');
const closeProjectModal = document.getElementById('closeProjectModal');
const saveProjectBtn = document.getElementById('saveProjectBtn');
const deleteProjectBtn = document.getElementById('deleteProjectBtn');
const addTaskBtn = document.getElementById('addTaskBtn');
const taskList = document.getElementById('taskList');
const editProjectName = document.getElementById('editProjectName');
const editProjectDeadline = document.getElementById('editProjectDeadline');
const editProjectPriority = document.getElementById('editProjectPriority');
const editProjectDesc = document.getElementById('editProjectDesc');
const modalProjectTitle = document.getElementById('modalProjectTitle');

function renderProjects() {
  let list = [...projects];

  if (currentFilter !== 'all') {
    list = list.filter(p => p.priority === currentFilter);
  }

  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  list.sort((a, b) => {
    if (currentSort === 'priority') return priorityOrder[a.priority] - priorityOrder[b.priority];
    if (currentSort === 'deadline') {
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      return new Date(a.deadline) - new Date(b.deadline);
    }
    if (currentSort === 'name') return (a.name || '').localeCompare(b.name || '');
    return (b.created || 0) - (a.created || 0);
  });

  projectList.classList.toggle('list-view', currentView === 'list');

  if (!list.length) {
    projectList.innerHTML = `<div class="empty-state"><strong>${currentFilter !== 'all' ? 'NO MATCHES' : 'NO PROJECTS YET'}</strong>${currentFilter !== 'all' ? 'try a different filter' : 'hit + NEW PROJECT to get started'}</div>`;
    return;
  }

  projectList.innerHTML = list.map(p => {
    const done = (p.tasks || []).filter(t => t.done).length;
    const total = (p.tasks || []).length;
    const ds = deadlineStatus(p.deadline);
    const dlClass = ds === 'overdue' ? 'overdue' : ds === 'soon' ? 'soon' : '';
    const dlLabel = p.deadline
      ? (ds === 'overdue' ? '⚠ ' : ds === 'soon' ? '→ ' : '') + formatDate(p.deadline)
      : '';

    return `
      <div class="project-card" data-id="${p.id}" data-priority="${p.priority}" onclick="openProject('${p.id}')">
        <div class="project-card-header">
          <div class="project-card-name">${escHtml(p.name || 'Untitled')}</div>
          <span class="priority-badge badge-${p.priority}">${p.priority.toUpperCase()}</span>
        </div>
        ${p.description ? `<div class="project-card-desc">${escHtml(p.description)}</div>` : ''}
        <div class="project-card-meta">
          <div class="task-count">
            <span class="task-done">${done} done</span>
            <span>/ ${total} tasks</span>
          </div>
          ${dlLabel ? `<div class="deadline ${dlClass}">${dlLabel}</div>` : ''}
        </div>
      </div>`;
  }).join('');
}

document.getElementById('sortProjects').addEventListener('change', e => {
  currentSort = e.target.value;
  renderProjects();
});

document.getElementById('filterPriority').addEventListener('change', e => {
  currentFilter = e.target.value;
  renderProjects();
});

document.getElementById('viewGrid').addEventListener('click', () => {
  currentView = 'grid';
  document.getElementById('viewGrid').classList.add('active');
  document.getElementById('viewList').classList.remove('active');
  renderProjects();
});

document.getElementById('viewList').addEventListener('click', () => {
  currentView = 'list';
  document.getElementById('viewList').classList.add('active');
  document.getElementById('viewGrid').classList.remove('active');
  renderProjects();
});

function openProject(id) {
  const p = id ? projects.find(x => x.id === id) : null;
  currentProjectId = id || null;

  if (p) {
    editProjectName.value = p.name || '';
    editProjectDeadline.value = p.deadline || '';
    editProjectPriority.value = p.priority || 'medium';
    editProjectDesc.value = p.description || '';
    modalProjectTitle.textContent = p.name || 'PROJECT';
    deleteProjectBtn.classList.remove('hidden');
    renderTaskList(p.tasks || []);
  } else {
    editProjectName.value = '';
    editProjectDeadline.value = '';
    editProjectPriority.value = 'medium';
    editProjectDesc.value = '';
    modalProjectTitle.textContent = 'NEW PROJECT';
    deleteProjectBtn.classList.add('hidden');
    renderTaskList([]);
  }

  projectModal.classList.remove('hidden');
}

// ---- TASKS ----
let tempTasks = [];

function renderTaskList(tasks) {
  tempTasks = JSON.parse(JSON.stringify(tasks));
  redrawTaskList();
}

function redrawTaskList() {
  taskList.innerHTML = tempTasks.map((t, i) => `
    <div class="task-item" draggable="true" data-index="${i}">
      <input type="checkbox" class="task-check" ${t.done ? 'checked' : ''}
        onchange="toggleTask(${i})" />
      <div class="task-text-wrap">
        <div class="task-text ${t.done ? 'done' : ''}">${escHtml(t.text)}</div>
      </div>
      <button class="task-remove" onclick="removeTask(${i})" title="Remove">✕</button>
    </div>
  `).join('') + `
    <div class="task-add-row">
      <input type="text" id="newTaskInput" placeholder="New task..." onkeydown="taskEnter(event)" />
      <button class="btn-small" onclick="commitTask()">ADD</button>
    </div>
  `;

  let dragSrcIndex = null;

  taskList.querySelectorAll('.task-item').forEach(item => {
    item.addEventListener('dragstart', () => {
      dragSrcIndex = parseInt(item.dataset.index);
      item.classList.add('dragging');
    });
    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      taskList.querySelectorAll('.task-item').forEach(el => el.classList.remove('drag-over'));
    });
    item.addEventListener('dragover', e => {
      e.preventDefault();
      taskList.querySelectorAll('.task-item').forEach(el => el.classList.remove('drag-over'));
      item.classList.add('drag-over');
    });
    item.addEventListener('drop', e => {
      e.preventDefault();
      const targetIndex = parseInt(item.dataset.index);
      if (dragSrcIndex === null || dragSrcIndex === targetIndex) return;
      const moved = tempTasks.splice(dragSrcIndex, 1)[0];
      tempTasks.splice(targetIndex, 0, moved);
      dragSrcIndex = null;
      redrawTaskList();
    });
  });
}

window.toggleTask = function(i) {
  tempTasks[i].done = !tempTasks[i].done;
  redrawTaskList();
};

window.removeTask = function(i) {
  tempTasks.splice(i, 1);
  redrawTaskList();
};

window.taskEnter = function(e) {
  if (e.key === 'Enter') commitTask();
};

function commitTask() {
  const input = document.getElementById('newTaskInput');
  const txt = input.value.trim();
  if (!txt) return;
  tempTasks.push({ id: uid(), text: txt, done: false });
  redrawTaskList();
}

addTaskBtn.addEventListener('click', () => {
  setTimeout(() => { const inp = document.getElementById('newTaskInput'); if(inp) inp.focus(); }, 50);
});

addProjectBtn.addEventListener('click', () => openProject(null));

closeProjectModal.addEventListener('click', () => {
  projectModal.classList.add('hidden');
  currentProjectId = null;
});

saveProjectBtn.addEventListener('click', async () => {
  const name = editProjectName.value.trim() || 'Untitled';
  if (currentProjectId) {
    const idx = projects.findIndex(p => p.id === currentProjectId);
    if (idx >= 0) {
      projects[idx] = {
        ...projects[idx],
        name,
        deadline: editProjectDeadline.value,
        priority: editProjectPriority.value,
        description: editProjectDesc.value.trim(),
        tasks: tempTasks,
      };
    }
  } else {
    projects.push({
      id: uid(),
      name,
      deadline: editProjectDeadline.value,
      priority: editProjectPriority.value,
      description: editProjectDesc.value.trim(),
      tasks: tempTasks,
      created: Date.now(),
    });
  }
  await save();
  renderProjects();
  projectModal.classList.add('hidden');
});

deleteProjectBtn.addEventListener('click', async () => {
  if (!currentProjectId) return;
  if (!confirm('Delete this project? This cannot be undone.')) return;
  projects = projects.filter(p => p.id !== currentProjectId);
  await save();
  renderProjects();
  projectModal.classList.add('hidden');
});

window.openProject = openProject;

// ---- MOOD BOARD ----
const moodGrid = document.getElementById('moodGrid');
const moodModal = document.getElementById('moodModal');
const addCardBtn = document.getElementById('addCardBtn');
const closeMoodModal = document.getElementById('closeMoodModal');
const saveMoodBtn = document.getElementById('saveMoodBtn');
const deleteMoodBtn = document.getElementById('deleteMoodBtn');
const moodTitle = document.getElementById('moodTitle');
const moodText = document.getElementById('moodText');
const moodImage = document.getElementById('moodImage');
const moodAudio = document.getElementById('moodAudio');
const moodTag = document.getElementById('moodTag');

function isSoundCloud(url) {
  return url && url.includes('soundcloud.com');
}

function renderMoodBoard() {
  if (!moodCards.length) {
    moodGrid.innerHTML = `<div class="empty-state"><strong>MOOD BOARD EMPTY</strong>add references, audio, images &amp; notes</div>`;
    return;
  }

  moodGrid.innerHTML = moodCards.map(c => {
    const imgHtml = c.image
      ? `<img class="mood-card-img" src="${escAttr(c.image)}" alt="" loading="lazy" onerror="this.style.display='none'" />`
      : '';

    let audioHtml = '';
    if (c.audio) {
      if (isSoundCloud(c.audio)) {
        const scUrl = encodeURIComponent(c.audio);
        audioHtml = `<div class="mood-card-audio">
          <iframe width="100%" height="60" scrolling="no" frameborder="no" allow="autoplay"
            src="https://w.soundcloud.com/player/?url=${scUrl}&color=%23e8c84a&auto_play=false&hide_related=true&show_comments=false&show_user=false&show_reposts=false&show_teaser=false">
          </iframe>
        </div>`;
      } else {
        audioHtml = `<div class="mood-card-audio">
          <audio controls preload="none">
            <source src="${escAttr(c.audio)}" />
            Audio not supported.
          </audio>
        </div>`;
      }
    }

    return `
      <div class="mood-card" onclick="openMoodCard('${c.id}')">
        ${imgHtml}
        <div class="mood-card-body">
          ${c.tag ? `<div class="mood-card-tag">${escHtml(c.tag)}</div>` : ''}
          <div class="mood-card-title">${escHtml(c.title || 'Untitled')}</div>
          ${c.text ? `<div class="mood-card-text">${escHtml(c.text)}</div>` : ''}
          ${audioHtml}
        </div>
      </div>`;
  }).join('');
}

function openMoodCard(id) {
  const c = id ? moodCards.find(x => x.id === id) : null;
  currentMoodId = id || null;

  if (c) {
    moodTitle.value = c.title || '';
    moodText.value = c.text || '';
    moodImage.value = c.image || '';
    moodAudio.value = c.audio || '';
    moodTag.value = c.tag || '';
    deleteMoodBtn.classList.remove('hidden');
  } else {
    moodTitle.value = '';
    moodText.value = '';
    moodImage.value = '';
    moodAudio.value = '';
    moodTag.value = '';
    deleteMoodBtn.classList.add('hidden');
  }

  moodModal.classList.remove('hidden');
}

addCardBtn.addEventListener('click', () => openMoodCard(null));
closeMoodModal.addEventListener('click', () => { moodModal.classList.add('hidden'); currentMoodId = null; });

saveMoodBtn.addEventListener('click', async () => {
  const card = {
    title: moodTitle.value.trim() || 'Untitled',
    text: moodText.value.trim(),
    image: moodImage.value.trim(),
    audio: moodAudio.value.trim(),
    tag: moodTag.value.trim(),
  };
  if (currentMoodId) {
    const idx = moodCards.findIndex(c => c.id === currentMoodId);
    if (idx >= 0) moodCards[idx] = { ...moodCards[idx], ...card };
  } else {
    moodCards.push({ id: uid(), ...card, created: Date.now() });
  }
  await save();
  renderMoodBoard();
  moodModal.classList.add('hidden');
});

deleteMoodBtn.addEventListener('click', async () => {
  if (!currentMoodId) return;
  if (!confirm('Delete this card?')) return;
  moodCards = moodCards.filter(c => c.id !== currentMoodId);
  await save();
  renderMoodBoard();
  moodModal.classList.add('hidden');
});

window.openMoodCard = openMoodCard;

[projectModal, moodModal].forEach(modal => {
  modal.addEventListener('click', e => {
    if (e.target === modal) modal.classList.add('hidden');
  });
});

// ---- INIT ----
async function renderAll() {
  await load();
  renderProjects();
  renderMoodBoard();
}
