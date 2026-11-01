const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeUrl = (u) => (/^https?:\/\//i.test(u || '') ? u : null);

async function api(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = res.status === 204 ? null : await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data?.error || 'Erreur réseau'), { data, status: res.status });
  return data;
}

function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('is-visible');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove('is-visible'), 3500);
}

/* ---------- Thème ---------- */
// Le thème initial est appliqué par theme-init.js (dans <head>) pour éviter le flash au chargement.
function initTheme() {
  $('#themeToggle').addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch {}
  });
}

/* ---------- Navigation ---------- */
function initNav() {
  const nav = $('#nav');
  const burger = $('#burger');
  const links = $('#navLinks');
  const onScroll = () => nav.classList.toggle('is-scrolled', scrollY > 20);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const toggle = (open) => {
    links.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', String(open));
  };
  burger.addEventListener('click', () => toggle(!links.classList.contains('is-open')));
  $$('a', links).forEach((a) => a.addEventListener('click', () => toggle(false)));

  // Lien actif selon la section visible
  const sections = $$('main section[id]');
  const spy = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      $$('a', links).forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === `#${e.target.id}`));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  sections.forEach((s) => spy.observe(s));
}

/* ---------- Animations au défilement ---------- */
const revealer = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (!e.isIntersecting) return;
    e.target.classList.add('is-visible');
    $$('.skill__bar i', e.target).forEach((bar) => { bar.style.width = `${bar.dataset.level}%`; });
    revealer.unobserve(e.target);
  });
}, { threshold: 0.15 });
const observeReveals = () => $$('.reveal:not(.is-visible)').forEach((el) => revealer.observe(el));

/* ---------- Effet machine à écrire ---------- */
function typeWriter(el, words) {
  if (!words?.length) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = words[0]; return; }
  let w = 0, i = 0, deleting = false;
  (function tick() {
    const word = words[w];
    el.textContent = word.slice(0, i);
    if (!deleting && i === word.length) { deleting = true; return setTimeout(tick, 1600); }
    if (deleting && i === 0) { deleting = false; w = (w + 1) % words.length; }
    i += deleting ? -1 : 1;
    setTimeout(tick, deleting ? 45 : 90);
  })();
}

/* ---------- Profil ---------- */
const socialLinks = (s = {}) => Object.entries(s)
  .filter(([, url]) => safeUrl(url))
  .map(([k, url]) => `<a href="${esc(url)}" target="_blank" rel="noopener" aria-label="${esc(k)}"><svg class="icon"><use href="#i-${esc(k)}"/></svg></a>`)
  .join('');

// Photo de profil : en cas d'absence du fichier, on garde les initiales
function renderPhoto(src) {
  const img = $('#photo');
  if (!src) return;
  img.addEventListener('load', () => img.closest('.portrait__frame').classList.add('has-photo'), { once: true });
  img.src = src;
}

function renderProfile(p) {
  $$('[data-bind]').forEach((el) => {
    const v = p[el.dataset.bind];
    if (v !== undefined) el.textContent = el.classList.contains('s') ? `'${v}'` : v;
  });
  $$('[data-bind-href="mailto"]').forEach((a) => { a.href = `mailto:${p.email}`; });
  const initials = p.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  $$('[data-bind="initials"]').forEach((el) => { el.textContent = initials; });
  document.title = `${p.name} — ${p.role}`;
  $('#availability').classList.toggle('is-hidden', !p.available);

  // CV : le serveur ne renvoie `cv` que si le fichier existe réellement
  $$('[data-cv]').forEach((a) => {
    a.hidden = !p.cv;
    if (p.cv) a.href = p.cv;
  });

  $('#heroSocials').innerHTML = socialLinks(p.socials);
  $('#contactSocials').innerHTML = socialLinks(p.socials);
  $('#footerSocials').innerHTML = socialLinks(p.socials);
  const github = safeUrl(p.socials?.github);
  if (github) {
    $('#githubMore a').href = github;
    $('#githubMore').hidden = false;
  }
  $('#aboutText').innerHTML = p.about.map((t) => `<p>${esc(t)}</p>`).join('');
  $('#stats').innerHTML = p.stats.map((s) => `<div class="stat"><strong>${esc(s.value)}</strong><span>${esc(s.label)}</span></div>`).join('');

  renderPhoto(p.photo);

  // Compétences : barre de niveau si "level" est fourni, sinon simple puce
  $('#skills').innerHTML = p.skills.map((g) => `
    <article class="skill-card reveal">
      <div class="skill-card__icon"><svg class="icon"><use href="#i-${esc(g.icon)}"/></svg></div>
      <h3>${esc(g.group)}</h3>
      ${g.items.some((s) => s.level) ? g.items.map((s) => `
        <div class="skill">
          <div class="skill__head"><span>${esc(s.name)}</span><span>${Number(s.level)}%</span></div>
          <div class="skill__bar"><i data-level="${Number(s.level)}"></i></div>
        </div>`).join('') : `<ul class="pills">${g.items.map((s) => `<li>${esc(s.name ?? s)}</li>`).join('')}</ul>`}
    </article>`).join('');

  $('#softSkills').innerHTML = (p.softSkills || []).map((s) => `<li><svg class="icon"><use href="#i-check"/></svg>${esc(s)}</li>`).join('');
  $('#languages').innerHTML = (p.languages || []).map((l) => `<li><strong>${esc(l.name)}</strong><span>${esc(l.level)}</span></li>`).join('');

  const timelineItem = (x) => `
    <li class="reveal">
      <span class="timeline__period">${esc(x.period)}</span>
      <h3>${esc(x.title)}</h3>
      <p class="timeline__place">${esc(x.place)}</p>
      <div class="timeline__card">
        ${x.description ? `<p>${esc(x.description)}</p>` : ''}
        ${x.points ? `<ul>${x.points.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
      </div>
    </li>`;
  $('#timeline').innerHTML = p.experience.map(timelineItem).join('');
  $('#education').innerHTML = (p.education || []).map(timelineItem).join('');

  $('#contactList').innerHTML = [
    `<li><a href="mailto:${esc(p.email)}"><span class="contact__icon"><svg class="icon"><use href="#i-mail"/></svg></span><span><small>E-mail</small>${esc(p.email)}</span></a></li>`,
    ...(p.phones || []).map((ph) => {
      const digits = ph.number.replace(/\D/g, '');
      const href = ph.whatsapp ? `https://wa.me/${digits}` : `tel:+${digits}`;
      return `<li><a href="${href}"${ph.whatsapp ? ' target="_blank" rel="noopener"' : ''}><span class="contact__icon"><svg class="icon"><use href="#i-${ph.whatsapp ? 'chat' : 'phone'}"/></svg></span><span><small>${esc(ph.label)}</small>${esc(ph.number)}</span></a></li>`;
    }),
    `<li><span class="contact__item"><span class="contact__icon"><svg class="icon"><use href="#i-pin"/></svg></span><span><small>Localisation</small>${esc(p.location)}</span></span></li>`,
  ].join('');

  if (p.typed?.length) $('#typedSr').textContent = p.typed.join(', ');
  typeWriter($('#typed'), p.typed);
  observeReveals();
}

/* ---------- Projets ---------- */
const CAT_LABEL = { fullstack: 'Full stack', frontend: 'Front-end', backend: 'Back-end', mobile: 'Mobile' };
let allProjects = [];

// Visuel par défaut quand un projet n'a pas de capture : une fenêtre d'application stylisée.
const PROJECT_ICONS = [
  [/market|commerce|boutique|shop/i, '🛒'], [/archive/i, '🗄️'], [/document|pdf/i, '📄'],
  [/établissement|scola|formation|école/i, '🎓'], [/auto|véhicule|voiture/i, '🚗'],
];
const mockCover = (p) => {
  const icon = (PROJECT_ICONS.find(([re]) => re.test(p.title)) || [, '💻'])[1];
  const name = p.title.split(/\s+[—-]\s+/)[0];
  return `
    <div class="mock" aria-hidden="true">
      <div class="mock__bar"><i></i><i></i><i></i></div>
      <div class="mock__body">
        <div class="mock__side"><span></span><span></span><span></span><span></span></div>
        <div class="mock__main">
          <div class="mock__head"><em>${icon}</em><strong>${esc(name)}</strong></div>
          <div class="mock__cards"><span></span><span></span><span></span></div>
          <div class="mock__lines"><span></span><span></span></div>
        </div>
      </div>
    </div>`;
};

// Filtres générés à partir des projets réels : pas de bouton menant à une catégorie vide.
function renderFilters() {
  const counts = allProjects.reduce((acc, p) => ({ ...acc, [p.category]: (acc[p.category] || 0) + 1 }), {});
  const cats = Object.keys(CAT_LABEL).filter((c) => counts[c]);
  const box = $('#filters');
  box.hidden = cats.length < 2;
  box.innerHTML = [['all', 'Tous', allProjects.length], ...cats.map((c) => [c, CAT_LABEL[c], counts[c]])]
    .map(([key, label, n], i) => `<button class="filter${i ? '' : ' is-active'}" data-filter="${key}" aria-pressed="${!i}">${label} <span class="filter__count">${n}</span></button>`)
    .join('');
}

function renderProjects(filter = 'all') {
  const list = filter === 'all' ? allProjects : allProjects.filter((p) => p.category === filter);
  const box = $('#projects');
  if (!list.length) { box.innerHTML = '<p class="empty">Aucun projet dans cette catégorie pour le moment.</p>'; return; }
  box.innerHTML = list.map((p, i) => {
    const repo = safeUrl(p.repo_url);
    const demo = safeUrl(p.demo_url);
    const image = /^(https?:\/\/|\/)/i.test(p.image_url || '') ? p.image_url : null;
    const shots = p.gallery?.length || 0;
    // Couverture : ouvre la galerie si le projet en a une, sinon le site en ligne
    const coverTag = shots ? `button type="button" data-gallery="${p.id}" aria-label="Voir les ${shots} écrans de ${esc(p.title)}"`
      : demo ? `a href="${esc(demo)}" target="_blank" rel="noopener" tabindex="-1" aria-hidden="true"` : 'div';
    return `
      <article class="project" data-delay="${i}">
        <${coverTag} class="project__cover${image ? ' has-image' : ''}" data-cat="${esc(p.category)}" data-id="${p.id}">
          ${p.featured ? '<span class="project__featured">★ À la une</span>' : ''}
          ${demo ? '<span class="project__live"><i></i> En ligne</span>' : ''}
          ${shots ? `<span class="project__shots">🖼 ${shots} écrans</span>` : ''}
          ${image ? `<img src="${esc(image)}" alt="Aperçu du projet ${esc(p.title)}" loading="lazy" decoding="async">` : mockCover(p)}
        </${coverTag.split(' ')[0]}>
        <div class="project__body">
          <span class="project__cat">${esc(CAT_LABEL[p.category] || p.category)}</span>
          <h3>${esc(p.title)}</h3>
          <p>${esc(p.description)}</p>
          <div class="tags">${p.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>
          <div class="project__links">
            ${demo ? `<a class="project__demo" href="${esc(demo)}" target="_blank" rel="noopener" aria-label="Voir le site en ligne de ${esc(p.title)} (nouvel onglet)"><svg class="icon"><use href="#i-external"/></svg> Voir le site en ligne</a>` : ''}
            ${shots ? `<button type="button" class="project__gallery-btn" data-gallery="${p.id}"><svg class="icon"><use href="#i-layout"/></svg> Voir les ${shots} écrans</button>` : ''}
            ${repo ? `<a href="${esc(repo)}" target="_blank" rel="noopener" aria-label="Code source de ${esc(p.title)} (nouvel onglet)"><svg class="icon"><use href="#i-github"/></svg> Code</a>` : ''}
          </div>
        </div>
      </article>`;
  }).join('');
  $$('.project', box).forEach((el) => { el.style.animationDelay = `${el.dataset.delay * 80}ms`; });
  // Si une image de projet ne charge pas, on revient au visuel par défaut
  $$('.project__cover img', box).forEach((img) => img.addEventListener('error', () => {
    const cover = img.parentElement;
    cover.classList.remove('has-image');
    img.outerHTML = mockCover(allProjects.find((x) => x.id === Number(cover.dataset.id)));
  }, { once: true }));
}

/* ---------- Galerie des écrans d'un projet ---------- */
function initLightbox() {
  const dlg = $('#lightbox');
  let shots = [], idx = 0;
  const show = (i) => {
    idx = (i + shots.length) % shots.length;
    const s = shots[idx];
    $('#lightboxImg').src = s.src;
    $('#lightboxImg').alt = s.caption || '';
    $('#lightboxCaption').textContent = `${idx + 1} / ${shots.length} · ${s.caption || ''}`;
    $$('#lightboxThumbs button').forEach((b, j) => b.setAttribute('aria-current', String(j === idx)));
  };
  $('#projects').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-gallery]');
    if (!btn) return;
    const p = allProjects.find((x) => x.id === Number(btn.dataset.gallery));
    shots = (p?.gallery || []).filter((s) => /^(https?:\/\/|\/)/i.test(s.src || ''));
    if (!shots.length) return;
    $('#lightboxTitle').textContent = p.title;
    $('#lightboxThumbs').innerHTML = shots.map((s, j) => `<button type="button" data-i="${j}" aria-label="${esc(s.caption)}"><img src="${esc(s.src)}" alt="" loading="lazy"></button>`).join('');
    show(0);
    dlg.showModal();
  });
  dlg.addEventListener('click', (e) => {
    const t = e.target.closest('[data-lb], [data-i]');
    if (e.target === dlg || t?.dataset.lb === 'close') return dlg.close();
    if (t?.dataset.lb) show(idx + (t.dataset.lb === 'next' ? 1 : -1));
    else if (t) show(Number(t.dataset.i));
  });
  dlg.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') show(idx + 1);
    if (e.key === 'ArrowLeft') show(idx - 1);
  });
}

function initFilters() {
  $('#filters').addEventListener('click', (e) => {
    const btn = e.target.closest('.filter');
    if (!btn) return;
    $$('.filter').forEach((b) => {
      b.classList.toggle('is-active', b === btn);
      b.setAttribute('aria-pressed', String(b === btn));
    });
    renderProjects(btn.dataset.filter);
  });
}

/* ---------- Formulaire de contact ---------- */
function initContact() {
  const form = $('#contactForm');
  const status = $('#formStatus');
  const btn = $('#submitBtn');

  const setErrors = (errors = {}) => {
    $$('[data-error]', form).forEach((el) => {
      const msg = errors[el.dataset.error] || '';
      el.textContent = msg;
      el.closest('.field').classList.toggle('has-error', !!msg);
    });
  };

  const validate = (d) => {
    const e = {};
    if (d.name.trim().length < 2) e.name = 'Nom trop court.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email.trim())) e.email = 'Adresse e-mail invalide.';
    if (!d.subject?.trim()) e.subject = 'Veuillez choisir un sujet.';
    if (d.message.trim().length < 10) e.message = 'Message trop court (10 caractères minimum).';
    return e;
  };

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    const errors = validate(data);
    setErrors(errors);
    status.className = 'form__status';
    status.textContent = '';
    if (Object.keys(errors).length) { form.elements[Object.keys(errors)[0]]?.focus(); return; }

    btn.disabled = true;
    btn.firstElementChild.textContent = 'Envoi en cours…';
    try {
      // Le message est toujours enregistré en base : la notification e-mail ne concerne que le propriétaire.
      await api('/contact', { method: 'POST', body: JSON.stringify(data) });
      form.reset();
      status.classList.add('is-ok');
      status.textContent = '✔ Merci ! Votre message a bien été envoyé. Je vous réponds sous 24 h.';
      toast('Message envoyé avec succès 🚀');
    } catch (err) {
      setErrors(err.data?.errors);
      status.classList.add('is-err');
      status.textContent = err.status === 429 ? 'Trop de messages envoyés. Réessayez dans quelques minutes ou écrivez-moi directement par e-mail.' : err.message;
    } finally {
      btn.disabled = false;
      btn.firstElementChild.textContent = 'Envoyer le message';
    }
  });
}

/* ---------- Démarrage ---------- */
initTheme();
initNav();
initFilters();
initLightbox();
initContact();
observeReveals();
$('#year').textContent = new Date().getFullYear();

api('/profile').then(renderProfile).catch(() => toast('Impossible de charger le profil.'));
api('/projects')
  .then((p) => { allProjects = p; renderFilters(); renderProjects(); })
  .catch(() => { $('#projects').innerHTML = '<p class="empty">Impossible de charger les projets.</p>'; });
