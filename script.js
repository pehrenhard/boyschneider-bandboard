/* =============================================
   BAND BOARD v2 — Script
   ============================================= */

// ---- CONFIG ----
const USERS = {
  'BAND2025': { id: 'neutral', label: '',   chipClass: 'chip-neutral' },
  'CODERBO':  { id: 'BO',      label: 'BO', chipClass: 'chip-bo-active' },
  'CODERMK':  { id: 'MK',      label: 'MK', chipClass: 'chip-mk-active' },
  'CODERMG':  { id: 'MG',      label: 'MG', chipClass: 'chip-mg-active' },
};

const JB_BIN_ID  = '6a08e1b9c0954111d833cc82';
const JB_API_KEY = '$2a$10$mKABUNWen4x.00rTvx0kc.WCGi6RCFrW6Dzv2IS7eug/v4rqeIaAW';
const JB_API     = `https://api.jsonbin.io/v3/b/${JB_BIN_ID}`;

// ---- STATE ----
let projects   = [];
let moodCards  = [];
let notes      = [];
let archive    = { projects: [], moodCards: [] };
let currentProjectId = null;
let currentMoodId    = null;
let currentNoteId    = null;
let currentUser      = null;
let projectIsNew     = false;
let currentSort   = 'created';
let currentFilter = 'all';
let currentView   = 'grid';

// ---- UTILS ----
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/\n/g,'<br>');
}
function escAttr(str) { return String(str).replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }

function deadlineStatus(dateStr) {
  if (!dateStr) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  const diff = Math.ceil((new Date(dateStr) - today) / 86400000);
  if (diff < 0) return 'overdue';
  if (diff <= 7) return 'soon';
  return 'ok';
}
function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
}

function personChipHtml(person) {
  const map = { BO: 'chip-bo-display', MK: 'chip-mk-display', MG: 'chip-mg-display' };
  return `<span class="${map[person]}" style="font-size:9px;font-weight:700;letter-spacing:0.08em;padding:2px 6px;border-radius:2px;">${person}</span>`;
}

function authorClass(userId) {
  if (userId === 'BO') return 'author-bo';
  if (userId === 'MK') return 'author-mk';
  if (userId === 'MG') return 'author-mg';
  return 'author-neutral';
}

// ---- STORAGE ----
async function load() {
  try {
    const res = await fetch(JB_API + '/latest', { headers: { 'X-Access-Key': JB_API_KEY } });
    const data = await res.json();
    projects  = data.record.projects   || [];
    moodCards = data.record.moodCards  || [];
    notes     = data.record.notes      || [];
    archive   = data.record.archive    || { projects: [], moodCards: [] };
  } catch(e) {
    console.error('Load failed', e);
    projects = []; moodCards = []; notes = []; archive = { projects: [], moodCards: [] };
  }
}

async function save() {
  try {
    await fetch(JB_API, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Access-Key': JB_API_KEY },
      body: JSON.stringify({ projects, moodCards, notes, archive }),
    });
  } catch(e) {
    console.error('Save failed', e);
    alert('Save failed — check your connection.');
  }
}

// ---- GATE ----
const gate      = document.getElementById('gate');
const app       = document.getElementById('app');
const gateInput = document.getElementById('gateInput');
const gateBtn   = document.getElementById('gateBtn');
const gateError = document.getElementById('gateError');
const lockBtn   = document.getElementById('lockBtn');
const reloadBtn = document.getElementById('reloadBtn');
const userChip  = document.getElementById('userChip');

function unlock() {
  const val = gateInput.value.trim().toUpperCase();
  const user = USERS[val];
  if (user) {
    currentUser = user;
    gate.classList.add('hidden');
    app.classList.remove('hidden');
    gateError.textContent = '';
    gateInput.value = '';
    if (user.label) {
      userChip.textContent = user.label;
      userChip.className = `user-chip ${user.chipClass}`;
    } else {
      userChip.textContent = '';
      userChip.className = 'user-chip';
    }
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
  currentUser = null;
  app.classList.add('hidden');
  gate.classList.remove('hidden');
  gateInput.focus();
});
reloadBtn.addEventListener('click', () => location.reload(true));

// ---- TABS ----
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
    tab.classList.add('active');
    document.getElementById('tab-' + tab.dataset.tab).classList.remove('hidden');
  });
});

// ---- COLOUR PICKER ----
function initColourPicker(pickerId) {
  const picker = document.getElementById(pickerId);
  if (!picker) return;
  picker.querySelectorAll('.colour-dot').forEach(dot => {
    dot.addEventListener('click', () => {
      picker.querySelectorAll('.colour-dot').forEach(d => d.classList.remove('selected'));
      dot.classList.add('selected');
    });
  });
}

function getSelectedColour(pickerId) {
  const picker = document.getElementById(pickerId);
  if (!picker) return '';
  const sel = picker.querySelector('.colour-dot.selected');
  return sel ? sel.dataset.colour : '';
}

function setSelectedColour(pickerId, colour) {
  const picker = document.getElementById(pickerId);
  if (!picker) return;
  picker.querySelectorAll('.colour-dot').forEach(d => {
    d.classList.toggle('selected', d.dataset.colour === (colour || ''));
  });
}

// ---- PROJECTS ----
const projectList       = document.getElementById('projectList');
const projectModal      = document.getElementById('projectModal');
const modalProjectTitle = document.getElementById('modalProjectTitle');
const addProjectBtn     = document.getElementById('addProjectBtn');
const closeProjectModal = document.getElementById('closeProjectModal');
const saveProjectBtn    = document.getElementById('saveProjectBtn');
const editProjectBtn    = document.getElementById('editProjectBtn');
const archiveProjectBtn = document.getElementById('archiveProjectBtn');
const addTaskBtn        = document.getElementById('addTaskBtn');
const taskListEl        = document.getElementById('taskList');

const editProjectName     = document.getElementById('editProjectName');
const editProjectDeadline = document.getElementById('editProjectDeadline');
const editProjectPriority = document.getElementById('editProjectPriority');
const editProjectDesc     = document.getElementById('editProjectDesc');
const editProjectPeopleEl = document.getElementById('editProjectPeople');

const projectViewMode     = document.getElementById('projectViewMode');
const projectEditMode     = document.getElementById('projectEditMode');
const viewProjectName     = document.getElementById('viewProjectName');
const viewProjectDeadline = document.getElementById('viewProjectDeadline');
const viewProjectPriority = document.getElementById('viewProjectPriority');
const viewProjectDesc     = document.getElementById('viewProjectDesc');
const viewProjectPeople   = document.getElementById('viewProjectPeople');

// People chip toggle
editProjectPeopleEl.querySelectorAll('.person-chip').forEach(btn => {
  btn.addEventListener('click', () => btn.classList.toggle('selected'));
});

// Init colour pickers
initColourPicker('editProjectColour');
initColourPicker('editNoteColour');

function getSelectedPeople() {
  return Array.from(editProjectPeopleEl.querySelectorAll('.person-chip.selected')).map(b => b.dataset.person);
}
function setSelectedPeople(people) {
  editProjectPeopleEl.querySelectorAll('.person-chip').forEach(btn => {
    btn.classList.toggle('selected', (people || []).includes(btn.dataset.person));
  });
}

function showProjectViewMode(p) {
  projectViewMode.classList.remove('hidden');
  projectEditMode.classList.add('hidden');
  editProjectBtn.classList.remove('hidden');
  saveProjectBtn.classList.add('hidden');

  viewProjectName.textContent = p.name || 'Untitled';
  const ds = deadlineStatus(p.deadline);
  viewProjectDeadline.textContent = p.deadline ? formatDate(p.deadline) + (ds === 'overdue' ? ' ⚠' : ds === 'soon' ? ' →' : '') : '—';
  viewProjectPriority.innerHTML = `<span class="priority-badge badge-${p.priority}">${(p.priority||'medium').toUpperCase()}</span>`;
  viewProjectDesc.textContent = p.description || '—';
  viewProjectPeople.innerHTML = (p.people || []).length ? p.people.map(personChipHtml).join(' ') : '—';
}

function showProjectEditMode() {
  projectViewMode.classList.add('hidden');
  projectEditMode.classList.remove('hidden');
  editProjectBtn.classList.add('hidden');
  saveProjectBtn.classList.remove('hidden');
}

function renderProjects() {
  let list = [...projects];
  if (currentFilter !== 'all') list = list.filter(p => p.priority === currentFilter);
  const po = { critical:0, high:1, medium:2, low:3 };
  list.sort((a,b) => {
    if (currentSort === 'priority') return po[a.priority] - po[b.priority];
    if (currentSort === 'deadline') { if (!a.deadline) return 1; if (!b.deadline) return -1; return new Date(a.deadline)-new Date(b.deadline); }
    if (currentSort === 'name') return (a.name||'').localeCompare(b.name||'');
    return (b.created||0)-(a.created||0);
  });
  projectList.classList.toggle('list-view', currentView === 'list');
  if (!list.length) {
    projectList.innerHTML = `<div class="empty-state"><strong>${currentFilter!=='all'?'NO MATCHES':'NO PROJECTS YET'}</strong>${currentFilter!=='all'?'try a different filter':'hit + NEW PROJECT to get started'}</div>`;
    return;
  }
  projectList.innerHTML = list.map(p => {
    const done  = (p.tasks||[]).filter(t=>t.done).length;
    const total = (p.tasks||[]).length;
    const ds    = deadlineStatus(p.deadline);
    const dlClass = ds==='overdue'?'overdue':ds==='soon'?'soon':'';
    const dlLabel = p.deadline ? (ds==='overdue'?'⚠ ':ds==='soon'?'→ ':'')+formatDate(p.deadline) : '';
    const peopleHtml = (p.people||[]).length ? `<div class="project-card-people">${p.people.map(personChipHtml).join('')}</div>` : '';
    const colourStyle = p.colour ? `style="--card-colour:${p.colour}"` : '';
    const colourClass = p.colour ? 'has-colour' : '';
    return `
      <div class="project-card ${colourClass}" ${colourStyle} data-id="${p.id}" data-priority="${p.priority}" onclick="openProject('${p.id}')">
        <div class="project-card-header">
          <div class="project-card-name">${escHtml(p.name||'Untitled')}</div>
          <span class="priority-badge badge-${p.priority}">${(p.priority||'medium').toUpperCase()}</span>
        </div>
        ${p.description?`<div class="project-card-desc">${escHtml(p.description)}</div>`:''}
        <div class="project-card-meta">
          <div class="task-count"><span class="task-done">${done} done</span><span>/ ${total} tasks</span></div>
          ${dlLabel?`<div class="deadline ${dlClass}">${dlLabel}</div>`:''}
        </div>
        ${peopleHtml}
      </div>`;
  }).join('');
}

document.getElementById('sortProjects').addEventListener('change', e => { currentSort=e.target.value; renderProjects(); });
document.getElementById('filterPriority').addEventListener('change', e => { currentFilter=e.target.value; renderProjects(); });
document.getElementById('viewGrid').addEventListener('click', () => { currentView='grid'; document.getElementById('viewGrid').classList.add('active'); document.getElementById('viewList').classList.remove('active'); renderProjects(); });
document.getElementById('viewList').addEventListener('click', () => { currentView='list'; document.getElementById('viewList').classList.add('active'); document.getElementById('viewGrid').classList.remove('active'); renderProjects(); });

function openProject(id) {
  const p = id ? projects.find(x=>x.id===id) : null;
  currentProjectId = id || null;
  projectIsNew = !id;

  if (p) {
    modalProjectTitle.textContent = p.name || 'PROJECT';
    archiveProjectBtn.classList.remove('hidden');
    showProjectViewMode(p);
    renderTaskList(p.tasks||[]);
  } else {
    modalProjectTitle.textContent = 'NEW PROJECT';
    archiveProjectBtn.classList.add('hidden');
    editProjectName.value = '';
    editProjectDeadline.value = '';
    editProjectPriority.value = 'medium';
    editProjectDesc.value = '';
    setSelectedPeople([]);
    setSelectedColour('editProjectColour', '');
    showProjectEditMode();
    renderTaskList([]);
  }
  projectModal.classList.remove('hidden');
}

editProjectBtn.addEventListener('click', () => {
  const p = projects.find(x=>x.id===currentProjectId);
  if (!p) return;
  editProjectName.value = p.name||'';
  editProjectDeadline.value = p.deadline||'';
  editProjectPriority.value = p.priority||'medium';
  editProjectDesc.value = p.description||'';
  setSelectedPeople(p.people||[]);
  setSelectedColour('editProjectColour', p.colour||'');
  showProjectEditMode();
});

closeProjectModal.addEventListener('click', () => { projectModal.classList.add('hidden'); currentProjectId=null; });
addProjectBtn.addEventListener('click', () => openProject(null));

saveProjectBtn.addEventListener('click', async () => {
  const name   = editProjectName.value.trim() || 'Untitled';
  const people = getSelectedPeople();
  const colour = getSelectedColour('editProjectColour');
  if (currentProjectId) {
    const idx = projects.findIndex(p=>p.id===currentProjectId);
    if (idx>=0) projects[idx] = { ...projects[idx], name, deadline:editProjectDeadline.value, priority:editProjectPriority.value, description:editProjectDesc.value.trim(), people, colour, tasks:tempTasks };
  } else {
    const newP = { id:uid(), name, deadline:editProjectDeadline.value, priority:editProjectPriority.value, description:editProjectDesc.value.trim(), people, colour, tasks:tempTasks, created:Date.now(), createdBy:currentUser?.id||'neutral' };
    projects.push(newP);
    currentProjectId = newP.id;
  }
  await save();
  renderProjects();
  const saved = projects.find(x=>x.id===currentProjectId);
  if (saved) { modalProjectTitle.textContent = saved.name; showProjectViewMode(saved); }
});

archiveProjectBtn.addEventListener('click', async () => {
  if (!currentProjectId) return;
  if (!confirm('Archive this project?')) return;
  const p = projects.find(x=>x.id===currentProjectId);
  if (p) { archive.projects.push({ ...p, archivedAt: Date.now() }); projects = projects.filter(x=>x.id!==currentProjectId); }
  await save();
  renderProjects();
  renderArchive();
  projectModal.classList.add('hidden');
});

window.openProject = openProject;

// ---- TASKS ----
let tempTasks = [];

function renderTaskList(tasks) { tempTasks = JSON.parse(JSON.stringify(tasks)); redrawTaskList(); }

window.editTask = function(i) {
  const textEl = taskListEl.querySelectorAll('.task-text')[i];
  if (!textEl) return;
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'task-edit-input';
  input.value = tempTasks[i].text;
  textEl.replaceWith(input);
  input.focus();
  input.select();

  function commit() {
    const val = input.value.trim();
    if (val) tempTasks[i].text = val;
    redrawTaskList();
  }

  input.addEventListener('blur', commit);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); commit(); }
    if (e.key === 'Escape') { redrawTaskList(); }
  });
};

function redrawTaskList() {
  taskListEl.innerHTML = tempTasks.map((t,i) => {
    const authorLabel = t.author && t.author !== 'neutral' ? t.author : '';
    const aClass = authorClass(t.author);
    return `
    <div class="task-item" draggable="true" data-index="${i}">
      <input type="checkbox" class="task-check" ${t.done?'checked':''} onchange="toggleTask(${i})" />
      <div class="task-text-wrap">
        <div class="task-text ${t.done?'done':''}" ondblclick="editTask(${i})">${escHtml(t.text)}</div>
      </div>
      ${authorLabel ? `<span class="task-author ${aClass}">${authorLabel}</span>` : ''}
      <button class="task-remove" onclick="removeTask(${i})" title="Remove">✕</button>
    </div>`;
  }).join('') + `
    <div class="task-add-row">
      <input type="text" id="newTaskInput" placeholder="New task..." onkeydown="taskEnter(event)" />
      <button class="btn-small" onclick="commitTask()">ADD</button>
    </div>`;

  let dragSrcIndex = null;
  taskListEl.querySelectorAll('.task-item').forEach(item => {
    item.addEventListener('dragstart', () => { dragSrcIndex=parseInt(item.dataset.index); item.classList.add('dragging'); });
    item.addEventListener('dragend', () => { item.classList.remove('dragging'); taskListEl.querySelectorAll('.task-item').forEach(el=>el.classList.remove('drag-over')); });
    item.addEventListener('dragover', e => { e.preventDefault(); taskListEl.querySelectorAll('.task-item').forEach(el=>el.classList.remove('drag-over')); item.classList.add('drag-over'); });
    item.addEventListener('drop', e => {
      e.preventDefault();
      const ti = parseInt(item.dataset.index);
      if (dragSrcIndex===null||dragSrcIndex===ti) return;
      const moved = tempTasks.splice(dragSrcIndex,1)[0];
      tempTasks.splice(ti,0,moved);
      dragSrcIndex=null; redrawTaskList();
    });
  });
  initTaskTouchDrag();
}

window.toggleTask = function(i) { tempTasks[i].done=!tempTasks[i].done; redrawTaskList(); };
window.removeTask = function(i) { tempTasks.splice(i,1); redrawTaskList(); };
window.taskEnter = function(e) { if(e.key==='Enter') commitTask(); };

function commitTask() {
  const input = document.getElementById('newTaskInput');
  const txt = input.value.trim();
  if (!txt) return;
  tempTasks.push({ id:uid(), text:txt, done:false, author:currentUser?.id||'neutral', createdAt:Date.now() });
  redrawTaskList();
}

addTaskBtn.addEventListener('click', () => { setTimeout(()=>{ const i=document.getElementById('newTaskInput'); if(i) i.focus(); },50); });

// ---- MOOD BOARD ----
const moodGrid       = document.getElementById('moodGrid');
const moodModal      = document.getElementById('moodModal');
const addCardBtn     = document.getElementById('addCardBtn');
const closeMoodModal = document.getElementById('closeMoodModal');
const saveMoodBtn    = document.getElementById('saveMoodBtn');
const archiveMoodBtn = document.getElementById('archiveMoodBtn');
const moodTitle      = document.getElementById('moodTitle');
const moodText       = document.getElementById('moodText');
const moodImage      = document.getElementById('moodImage');
const moodAudio      = document.getElementById('moodAudio');
const moodTag        = document.getElementById('moodTag');

function isSoundCloud(url) { return url && url.includes('soundcloud.com'); }

function renderMoodBoard() {
  if (!moodCards.length) { moodGrid.innerHTML=`<div class="empty-state"><strong>MOOD BOARD EMPTY</strong>add references, audio, images &amp; notes</div>`; return; }
  moodGrid.innerHTML = moodCards.map(c => {
    const imgHtml = c.image ? `<img class="mood-card-img" src="${escAttr(c.image)}" alt="" loading="lazy" onerror="this.style.display='none'" />` : '';
    let audioHtml = '';
    if (c.audio) {
      if (isSoundCloud(c.audio)) {
        audioHtml = `<div class="mood-card-audio"><iframe width="100%" height="60" scrolling="no" frameborder="no" allow="autoplay" src="https://w.soundcloud.com/player/?url=${encodeURIComponent(c.audio)}&color=%23e8c84a&auto_play=false&hide_related=true&show_comments=false&show_user=false&show_reposts=false&show_teaser=false"></iframe></div>`;
      } else {
        audioHtml = `<div class="mood-card-audio"><audio controls preload="none"><source src="${escAttr(c.audio)}" />Audio not supported.</audio></div>`;
      }
    }
    return `<div class="mood-card" onclick="openMoodCard('${c.id}')">${imgHtml}<div class="mood-card-body">${c.tag?`<div class="mood-card-tag">${escHtml(c.tag)}</div>`:''}<div class="mood-card-title">${escHtml(c.title||'Untitled')}</div>${c.text?`<div class="mood-card-text">${escHtml(c.text)}</div>`:''}${audioHtml}</div></div>`;
  }).join('');
}

function openMoodCard(id) {
  const c = id ? moodCards.find(x=>x.id===id) : null;
  currentMoodId = id||null;
  if (c) { moodTitle.value=c.title||''; moodText.value=c.text||''; moodImage.value=c.image||''; moodAudio.value=c.audio||''; moodTag.value=c.tag||''; archiveMoodBtn.classList.remove('hidden'); }
  else   { moodTitle.value=''; moodText.value=''; moodImage.value=''; moodAudio.value=''; moodTag.value=''; archiveMoodBtn.classList.add('hidden'); }
  moodModal.classList.remove('hidden');
}

addCardBtn.addEventListener('click', ()=>openMoodCard(null));
closeMoodModal.addEventListener('click', ()=>{ moodModal.classList.add('hidden'); currentMoodId=null; });

saveMoodBtn.addEventListener('click', async ()=>{
  const card = { title:moodTitle.value.trim()||'Untitled', text:moodText.value.trim(), image:moodImage.value.trim(), audio:moodAudio.value.trim(), tag:moodTag.value.trim() };
  if (currentMoodId) { const idx=moodCards.findIndex(c=>c.id===currentMoodId); if(idx>=0) moodCards[idx]={...moodCards[idx],...card}; }
  else moodCards.push({ id:uid(), ...card, created:Date.now(), createdBy:currentUser?.id||'neutral' });
  await save(); renderMoodBoard(); moodModal.classList.add('hidden');
});

archiveMoodBtn.addEventListener('click', async ()=>{
  if (!currentMoodId) return;
  if (!confirm('Archive this card?')) return;
  const c = moodCards.find(x=>x.id===currentMoodId);
  if (c) { archive.moodCards.push({...c, archivedAt:Date.now()}); moodCards=moodCards.filter(x=>x.id!==currentMoodId); }
  await save(); renderMoodBoard(); renderArchive(); moodModal.classList.add('hidden');
});

window.openMoodCard = openMoodCard;

// ---- NOTES ----
const noteGrid       = document.getElementById('noteGrid');
const noteModal      = document.getElementById('noteModal');
const addNoteBtn     = document.getElementById('addNoteBtn');
const closeNoteModal = document.getElementById('closeNoteModal');
const saveNoteBtn    = document.getElementById('saveNoteBtn');
const deleteNoteBtn  = document.getElementById('deleteNoteBtn');
const noteTitleEl    = document.getElementById('noteTitle');
const noteTagEl      = document.getElementById('noteTag');
const noteContentEl  = document.getElementById('noteContent');

function renderNotes() {
  if (!notes.length) { noteGrid.innerHTML=`<div class="empty-state"><strong>NO NOTES YET</strong>hit + NEW NOTE to start writing</div>`; return; }
  noteGrid.innerHTML = notes.map(n => {
    const colourStyle = n.colour ? `style="border-left:3px solid ${n.colour}"` : '';
    return `
    <div class="note-card" ${colourStyle} onclick="openNote('${n.id}')">
      ${n.tag?`<div class="note-card-tag">${escHtml(n.tag)}</div>`:''}
      <div class="note-card-title">${escHtml(n.title||'Untitled')}</div>
      <div class="note-card-preview">${escHtml(n.content||'')}</div>
      <div class="note-card-meta">${formatDate(new Date(n.created).toISOString().split('T')[0])}</div>
    </div>`;
  }).join('');
}

function openNote(id) {
  const n = id ? notes.find(x=>x.id===id) : null;
  currentNoteId = id||null;
  if (n) {
    noteTitleEl.value=n.title||''; noteTagEl.value=n.tag||''; noteContentEl.value=n.content||'';
    setSelectedColour('editNoteColour', n.colour||'');
    deleteNoteBtn.classList.remove('hidden');
  } else {
    noteTitleEl.value=''; noteTagEl.value=''; noteContentEl.value='';
    setSelectedColour('editNoteColour', '');
    deleteNoteBtn.classList.add('hidden');
  }
  noteModal.classList.remove('hidden');
}

addNoteBtn.addEventListener('click', ()=>openNote(null));
closeNoteModal.addEventListener('click', ()=>{ noteModal.classList.add('hidden'); currentNoteId=null; });

saveNoteBtn.addEventListener('click', async ()=>{
  const colour = getSelectedColour('editNoteColour');
  const n = { title:noteTitleEl.value.trim()||'Untitled', tag:noteTagEl.value.trim(), content:noteContentEl.value.trim(), colour };
  if (currentNoteId) { const idx=notes.findIndex(x=>x.id===currentNoteId); if(idx>=0) notes[idx]={...notes[idx],...n}; }
  else notes.push({ id:uid(), ...n, created:Date.now(), createdBy:currentUser?.id||'neutral' });
  await save(); renderNotes(); noteModal.classList.add('hidden');
});

deleteNoteBtn.addEventListener('click', async ()=>{
  if (!currentNoteId) return;
  if (!confirm('Delete this note permanently?')) return;
  notes=notes.filter(x=>x.id!==currentNoteId);
  await save(); renderNotes(); noteModal.classList.add('hidden');
});

window.openNote = openNote;

// ---- ARCHIVE ----
const archiveProjectList = document.getElementById('archiveProjectList');
const archiveMoodList    = document.getElementById('archiveMoodList');

function renderArchive() {
  if (!archive.projects.length) {
    archiveProjectList.innerHTML=`<div class="empty-state" style="padding:20px 20px"><strong style="font-size:18px">EMPTY</strong></div>`;
  } else {
    archiveProjectList.innerHTML = archive.projects.map(p => `
      <div class="project-card archived" data-priority="${p.priority||'medium'}">
        <div class="project-card-header">
          <div class="project-card-name">${escHtml(p.name||'Untitled')}</div>
          <span class="priority-badge badge-${p.priority||'medium'}">${(p.priority||'medium').toUpperCase()}</span>
        </div>
        ${p.description?`<div class="project-card-desc">${escHtml(p.description)}</div>`:''}
        <div class="archive-actions">
          <button class="btn-outline" onclick="restoreProject('${p.id}')">RESTORE</button>
          <button class="btn-danger" onclick="deleteArchivedProject('${p.id}')">DELETE</button>
        </div>
      </div>`).join('');
  }
  if (!archive.moodCards.length) {
    archiveMoodList.innerHTML=`<div class="empty-state" style="padding:20px 20px"><strong style="font-size:18px">EMPTY</strong></div>`;
  } else {
    archiveMoodList.innerHTML = archive.moodCards.map(c => `
      <div class="mood-card archived">
        ${c.image?`<img class="mood-card-img" src="${escAttr(c.image)}" alt="" loading="lazy" onerror="this.style.display='none'" />`:''}
        <div class="mood-card-body">
          ${c.tag?`<div class="mood-card-tag">${escHtml(c.tag)}</div>`:''}
          <div class="mood-card-title">${escHtml(c.title||'Untitled')}</div>
          ${c.text?`<div class="mood-card-text">${escHtml(c.text)}</div>`:''}
          <div class="archive-actions">
            <button class="btn-outline" onclick="restoreMoodCard('${c.id}')">RESTORE</button>
            <button class="btn-danger" onclick="deleteArchivedMood('${c.id}')">DELETE</button>
          </div>
        </div>
      </div>`).join('');
  }
}

window.restoreProject = async function(id) {
  const p = archive.projects.find(x=>x.id===id);
  if (!p) return;
  const { archivedAt, ...restored } = p;
  projects.push(restored);
  archive.projects = archive.projects.filter(x=>x.id!==id);
  await save(); renderProjects(); renderArchive();
};
window.deleteArchivedProject = async function(id) {
  if (!confirm('Permanently delete? This cannot be undone.')) return;
  archive.projects = archive.projects.filter(x=>x.id!==id);
  await save(); renderArchive();
};
window.restoreMoodCard = async function(id) {
  const c = archive.moodCards.find(x=>x.id===id);
  if (!c) return;
  const { archivedAt, ...restored } = c;
  moodCards.push(restored);
  archive.moodCards = archive.moodCards.filter(x=>x.id!==id);
  await save(); renderMoodBoard(); renderArchive();
};
window.deleteArchivedMood = async function(id) {
  if (!confirm('Permanently delete? This cannot be undone.')) return;
  archive.moodCards = archive.moodCards.filter(x=>x.id!==id);
  await save(); renderArchive();
};

// ---- TOUCH DRAG (tasks only) ----
function addTouchDrag(getItems, onReorder) {
  let ghost=null, srcIndex=null, overIndex=null;
  function createGhost(text,x,y) {
    ghost=document.createElement('div'); ghost.className='drag-ghost';
    ghost.textContent=text; ghost.style.left=x+'px'; ghost.style.top=y+'px';
    document.body.appendChild(ghost);
  }
  function moveGhost(x,y) { if(!ghost)return; ghost.style.left=(x+12)+'px'; ghost.style.top=(y-20)+'px'; }
  function removeGhost() { if(ghost){ghost.remove();ghost=null;} }
  function itemUnder(x,y) {
    if(ghost) ghost.style.display='none';
    const el=document.elementFromPoint(x,y);
    if(ghost) ghost.style.display='';
    return el?el.closest('[data-index]'):null;
  }
  document.addEventListener('touchstart', e=>{
    const item=e.target.closest('[data-index]');
    if(!item||!getItems().includes(item)) return;
    if(e.target.closest('input,button')) return;
    srcIndex=parseInt(item.dataset.index);
    const t=e.touches[0];
    const label=item.querySelector('.task-text,.project-card-name');
    createGhost(label?label.textContent.trim():'…',t.clientX,t.clientY);
    item.classList.add('touch-dragging');
  },{passive:true});
  document.addEventListener('touchmove', e=>{
    if(srcIndex===null) return;
    e.preventDefault();
    const t=e.touches[0]; moveGhost(t.clientX,t.clientY);
    getItems().forEach(el=>el.classList.remove('touch-drag-over'));
    const target=itemUnder(t.clientX,t.clientY);
    if(target&&getItems().includes(target)) { overIndex=parseInt(target.dataset.index); if(overIndex!==srcIndex) target.classList.add('touch-drag-over'); }
    else overIndex=null;
  },{passive:false});
  document.addEventListener('touchend', ()=>{
    if(srcIndex===null) return;
    removeGhost();
    getItems().forEach(el=>el.classList.remove('touch-dragging','touch-drag-over'));
    if(overIndex!==null&&overIndex!==srcIndex) onReorder(srcIndex,overIndex);
    srcIndex=null; overIndex=null;
  });
}

function initTaskTouchDrag() {
  addTouchDrag(
    ()=>Array.from(taskListEl.querySelectorAll('.task-item')),
    (from,to)=>{ const moved=tempTasks.splice(from,1)[0]; tempTasks.splice(to,0,moved); redrawTaskList(); initTaskTouchDrag(); }
  );
}

// ---- MODAL BACKDROP ----
[projectModal, moodModal, noteModal].forEach(modal=>{
  modal.addEventListener('click', e=>{ if(e.target===modal) modal.classList.add('hidden'); });
});

// ---- INIT ----
async function renderAll() {
  await load();
  renderProjects();
  renderMoodBoard();
  renderNotes();
  renderArchive();
}
