const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDate = (d) => new Date(d.replace(' ', 'T') + 'Z').toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });

let token = null;
try { token = sessionStorage.getItem('adminToken'); } catch {}
let projects = [];


function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('is-visible');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove('is-visible'), 3000);
}

async function api(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
  });
  const data = res.status === 204 ? null : await res.json().catch(() => ({}));
  if (res.status === 401 && token) { logout(); throw new Error('Session expirée'); }
  if (!res.ok) throw Object.assign(new Error(data?.error || 'Erreur'), { data });
  return data;
}

/* ---------- Session ---------- */
function showDash(on) {
  $('#loginView').hidden = on;
  $('#dashView').hidden = !on;
  if (on) refresh();
}
function logout() {
  token = null;
  try { sessionStorage.removeItem('adminToken'); } catch {}
  showDash(false);
}

$('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#loginStatus').textContent = '';
  try {
    const { token: t } = await api('/auth/login', { method: 'POST', body: JSON.stringify({ password: e.target.password.value }) });
    token = t;
    try { sessionStorage.setItem('adminToken', t); } catch {}
    e.target.reset();
    showDash(true);
  } catch (err) {
    $('#loginStatus').textContent = err.message;
  }
});
$('#logoutBtn').addEventListener('click', logout);

/* ---------- Onglets ---------- */
$('.tabs').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-tab]');
  if (!btn) return;
  $$('[data-tab]').forEach((b) => b.classList.toggle('is-active', b === btn));
  $$('[data-panel]').forEach((p) => { p.hidden = p.dataset.panel !== btn.dataset.tab; });
});

/* ---------- Données ---------- */
async function refresh() {
  await Promise.all([loadStats(), loadMessages(), loadProjects()]).catch((err) => toast(err.message));
}

async function loadStats() {
  const s = await api('/admin/stats');
  $('#kpis').innerHTML = [
    [s.unread, 'messages non lus'],
    [s.messages, 'messages au total'],
    [s.projects, 'projets publiés'],
  ].map(([v, l]) => `<div class="kpi"><strong>${v}</strong><span>${l}</span></div>`).join('');
  $('#unreadBadge').textContent = s.unread;
  $('#unreadBadge').hidden = !s.unread;
}

async function loadMessages() {
  const list = await api('/admin/messages');
  $('#messages').innerHTML = list.length ? list.map((m) => `
    <article class="item ${m.is_read ? '' : 'is-unread'}">
      <div class="item__head">
        <div>
          <h3>${esc(m.subject)}</h3>
          <div class="item__meta">${esc(m.name)} · <a href="mailto:${esc(m.email)}">${esc(m.email)}</a> · ${fmtDate(m.created_at)}</div>
        </div>
        <div class="item__actions">
          <a class="btn btn--sm btn--primary" href="mailto:${esc(m.email)}?subject=${encodeURIComponent('Re : ' + m.subject)}" data-reply="${m.id}">Répondre</a>
          <button class="btn btn--sm btn--ghost" data-read="${m.id}" data-value="${m.is_read ? 0 : 1}">${m.is_read ? 'Marquer non lu' : 'Marquer lu'}</button>
          <button class="btn btn--sm btn--danger" data-del-msg="${m.id}">Supprimer</button>
        </div>
      </div>
      <p class="item__body">${esc(m.body)}</p>
    </article>`).join('') : '<p class="muted">Aucun message pour le moment.</p>';
}

async function loadProjects() {
  projects = await api('/projects');
  $('#projectList').innerHTML = projects.map((p) => `
    <article class="item">
      <div class="item__head">
        <div>
          <h3>${p.featured ? '★ ' : ''}${esc(p.title)}</h3>
          <div class="item__meta">${esc(p.category)} · ${p.tags.map(esc).join(', ')}</div>
        </div>
        <div class="item__actions">
          <button class="btn btn--sm btn--ghost" data-edit="${p.id}">Modifier</button>
          <button class="btn btn--sm btn--danger" data-del-proj="${p.id}">Supprimer</button>
        </div>
      </div>
    </article>`).join('');
}

/* ---------- Actions sur les messages ---------- */
$('#messages').addEventListener('click', async (e) => {
  // Répondre ouvre la messagerie et marque le message comme lu
  const reply = e.target.closest('[data-reply]');
  if (reply) {
    api(`/admin/messages/${reply.dataset.reply}`, { method: 'PATCH', body: JSON.stringify({ is_read: true }) })
      .then(() => Promise.all([loadMessages(), loadStats()])).catch(() => {});
    return;
  }
  const read = e.target.closest('[data-read]');
  const del = e.target.closest('[data-del-msg]');
  try {
    if (read) {
      await api(`/admin/messages/${read.dataset.read}`, { method: 'PATCH', body: JSON.stringify({ is_read: read.dataset.value === '1' }) });
    } else if (del) {
      if (!confirm('Supprimer définitivement ce message ?')) return;
      await api(`/admin/messages/${del.dataset.delMsg}`, { method: 'DELETE' });
      toast('Message supprimé');
    } else return;
    await Promise.all([loadMessages(), loadStats()]);
  } catch (err) { toast(err.message); }
});

/* ---------- Formulaire projet ---------- */
const form = $('#projectForm');

function resetForm() {
  form.reset();
  form.elements.id.value = '';
  $('#projectFormTitle').textContent = 'Nouveau projet';
  $('#projectSubmit').textContent = 'Ajouter le projet';
  $('#projectCancel').hidden = true;
  setErrors();
}
function setErrors(errors = {}) {
  $$('[data-error]', form).forEach((el) => {
    el.textContent = errors[el.dataset.error] || '';
    el.closest('.field').classList.toggle('has-error', !!errors[el.dataset.error]);
  });
}

$('#projectCancel').addEventListener('click', resetForm);

$('#projectList').addEventListener('click', async (e) => {
  const edit = e.target.closest('[data-edit]');
  const del = e.target.closest('[data-del-proj]');
  if (edit) {
    const p = projects.find((x) => x.id === Number(edit.dataset.edit));
    form.elements.id.value = p.id;
    form.elements.title.value = p.title;
    form.elements.description.value = p.description;
    form.elements.category.value = p.category;
    form.elements.tags.value = p.tags.join(', ');
    form.elements.repo_url.value = p.repo_url || '';
    form.elements.demo_url.value = p.demo_url || '';
    form.elements.image_url.value = p.image_url || '';
    form.elements.featured.checked = p.featured;
    $('#projectFormTitle').textContent = 'Modifier le projet';
    $('#projectSubmit').textContent = 'Enregistrer';
    $('#projectCancel').hidden = false;
    form.scrollIntoView({ behavior: 'smooth' });
  } else if (del) {
    if (!confirm('Supprimer ce projet ?')) return;
    try {
      await api(`/admin/projects/${del.dataset.delProj}`, { method: 'DELETE' });
      toast('Projet supprimé');
      await Promise.all([loadProjects(), loadStats()]);
    } catch (err) { toast(err.message); }
  }
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  data.featured = form.elements.featured.checked;
  const id = data.id;
  delete data.id;
  try {
    await api(id ? `/admin/projects/${id}` : '/admin/projects', { method: id ? 'PUT' : 'POST', body: JSON.stringify(data) });
    toast(id ? 'Projet mis à jour' : 'Projet ajouté');
    resetForm();
    await Promise.all([loadProjects(), loadStats()]);
  } catch (err) {
    setErrors(err.data?.errors);
    toast(err.message);
  }
});

showDash(!!token);
