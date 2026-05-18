// API base URL - use relative path (works for both local and Railway)
// Both local dev and Railway use same domain, so relative /api path works
const API_BASE = '/api';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getToken() { return localStorage.getItem('smartRentalToken'); }
function setToken(t) { localStorage.setItem('smartRentalToken', t); }
function clearAuth() {
  localStorage.removeItem('smartRentalToken');
  localStorage.removeItem('smartRentalUser');
}
function getUser() {
  try {
    return JSON.parse(localStorage.getItem('smartRentalUser') || 'null');
  } catch {
    return null;
  }
}
function setUser(u) { localStorage.setItem('smartRentalUser', JSON.stringify(u)); }

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isTenantLikeRole(role) {
  return role === 'tenant' || role === 'student' || role === 'owner';
}

function roleDashboardHref(role) {
  if (role === 'admin') return 'admin.html';
  if (role === 'owner' || role === 'landlord') return 'owner.html';
  if (role === 'manager') return 'dashboard.html';
  if (isTenantLikeRole(role)) return 'tenant.html';
  return 'tenant.html';
}

function propertyDetailHref(propertyId) {
  return `property-detail.html?id=${encodeURIComponent(propertyId)}`;
}

function validateAuthForm({ mode, email, password, full_name }) {
  if (!email || !EMAIL_RE.test(email.trim())) return 'Enter a valid email address.';
  if (!password || password.length < 6) return 'Password must be at least 6 characters.';
  if (password.length > 200) return 'Password is too long.';
  if (mode === 'register') {
    if (!full_name || full_name.trim().length < 2) return 'Please enter your full name (at least 2 characters).';
    if (full_name.trim().length > 150) return 'Full name is too long.';
  }
  return '';
}

function validateUserForm({ email, full_name, password, passwordOptional }) {
  if (!email || !EMAIL_RE.test(email.trim())) return 'Enter a valid email address.';
  if (!full_name || full_name.trim().length < 2) return 'Full name is required.';
  if (full_name.trim().length > 150) return 'Full name is too long.';
  if (!passwordOptional && (!password || password.length < 6)) return 'Password must be at least 6 characters.';
  if (password && password.length > 0 && password.length < 6) return 'Password must be at least 6 characters.';
  if (password && password.length > 200) return 'Password is too long.';
  return '';
}

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(API_BASE + path, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

function formatPrice(value) {
  return `EGP ${Number(value).toLocaleString()}`;
}
function formatShort(value) {
  const n = Number(value);
  if (n >= 1_000_000) return `EGP ${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `EGP ${(n / 1_000).toFixed(1)}k`;
  return `EGP ${n}`;
}

function setActiveNav() {
  const page = document.body.dataset.page;
  document.querySelectorAll('[data-nav]').forEach(link => {
    link.classList.toggle('active', link.dataset.nav === page);
  });
}
function mountYear() {
  document.querySelectorAll('[data-year]').forEach(node => {
    node.textContent = new Date().getFullYear();
  });
}

function enhanceNavigation() {
  const user = getUser();
  document.querySelectorAll('[data-show-roles]').forEach(el => {
    const roles = (el.dataset.showRoles || '').split(',').map(s => s.trim()).filter(Boolean);
    const show = user && roles.some(role => role === user.role || (role === 'tenant' && isTenantLikeRole(user.role)));
    el.style.display = show ? '' : 'none';
  });
  document.querySelectorAll('[data-show-authed]').forEach(el => {
    el.style.display = user ? '' : 'none';
  });
  document.querySelectorAll('[data-show-guest]').forEach(el => {
    el.style.display = user ? 'none' : '';
  });
}

function guardPage() {
  const page = document.body.dataset.page;
  const token = getToken();
  const user = getUser();

  const allowedNext = new Set(['tenant.html', 'dashboard.html', 'admin.html', 'owner.html', 'users.html', 'properties.html']);

  if (page === 'auth') {
    if (token && user) {
      const params = new URLSearchParams(window.location.search);
      const next = params.get('next');
      const dest = next && allowedNext.has(next) ? next : roleDashboardHref(user.role);
      window.location.replace(dest);
      return false;
    }
    return true;
  }

  const needsAuth = ['dashboard', 'admin', 'tenant', 'users', 'owner'].includes(page);
  if (needsAuth && (!token || !user)) {
    window.location.href = `auth.html?next=${encodeURIComponent(`${page}.html`)}`;
    return false;
  }

  if (page === 'admin' && user && user.role !== 'admin') {
    window.location.replace(roleDashboardHref(user.role));
    return false;
  }
  if (page === 'users' && user && user.role !== 'admin') {
    window.location.replace(roleDashboardHref(user.role));
    return false;
  }
  if (page === 'dashboard' && user && user.role !== 'manager' && user.role !== 'admin') {
    window.location.replace(roleDashboardHref(user.role));
    return false;
  }
  if (page === 'owner' && user && user.role !== 'owner' && user.role !== 'landlord') {
    window.location.replace(roleDashboardHref(user.role));
    return false;
  }
  if (page === 'tenant' && user && user.role === 'owner') {
    window.location.replace(roleDashboardHref(user.role));
    return false;
  }
  if (page === 'tenant' && user && !isTenantLikeRole(user.role)) {
    window.location.replace(roleDashboardHref(user.role));
    return false;
  }
  return true;
}

function handleAuthTabs() {
  const tabs = document.querySelectorAll('.auth-tab');
  const title = document.querySelector('[data-auth-title]');
  const subtitle = document.querySelector('[data-auth-subtitle]');
  const submit = document.querySelector('[data-auth-submit]');
  const nameField = document.querySelector('[data-auth-name]');
  const roleField = document.querySelector('[data-auth-role]');
  if (!tabs.length) return;

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const loginMode = tab.dataset.mode === 'login';
      if (title) title.textContent = loginMode ? 'Welcome back' : 'Create your account';
      if (subtitle) {
        subtitle.textContent = loginMode
          ? 'Sign in to access your rental workspace.'
          : 'Register as a tenant or student to browse leases and payments in one place.';
      }
      if (submit) submit.textContent = loginMode ? 'Sign In' : 'Create Account';
      if (nameField) nameField.style.display = loginMode ? 'none' : 'block';
      if (roleField) roleField.style.display = loginMode ? 'none' : 'block';
    });
  });

  const form = document.querySelector('[data-auth-form]');
  const status = document.querySelector('[data-auth-status]');
  if (!form || !status) return;

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const mode = document.querySelector('.auth-tab.active')?.dataset.mode || 'login';
    const email = document.querySelector('#email').value.trim();
    const password = document.querySelector('#password').value;
    const full_name = document.querySelector('#fullName')?.value.trim() || '';
    const role = document.querySelector('#role')?.value || 'tenant';

    const validationError = validateAuthForm({ mode, email, password, full_name });
    if (validationError) {
      status.className = 'status-msg error show';
      status.textContent = validationError;
      return;
    }

    status.className = 'status-msg show';
    status.textContent = 'Please wait...';

    try {
      const allowedNext = new Set(['tenant.html', 'dashboard.html', 'admin.html', 'owner.html', 'users.html', 'properties.html']);
      const params = new URLSearchParams(window.location.search);
      const nextParam = params.get('next');

      const data = mode === 'login'
        ? await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
        : await api('/auth/register', { method: 'POST', body: JSON.stringify({ email, password, full_name, role }) });

      setToken(data.token);
      setUser(data.user);

      status.textContent = `Welcome, ${data.user.full_name}! Redirecting…`;
      status.className = 'status-msg success show';

      setTimeout(() => {
        const defaultDest = roleDashboardHref(data.user.role);
        const dest = nextParam && allowedNext.has(nextParam) ? nextParam : defaultDest;
        window.location.href = dest;
      }, 600);
    } catch (err) {
      status.textContent = err.message || 'Authentication failed';
      status.className = 'status-msg error show';
    }
  });
}

function renderProperties(list) {
  const grid = document.querySelector('[data-properties-grid]');
  if (!grid) return;
  if (!list.length) {
    grid.innerHTML = '<div class="data-card" style="grid-column: 1 / -1;"><h3>No properties match the current filters.</h3><p class="muted">Try clearing one of the filters or broadening the search.</p></div>';
    return;
  }
  grid.innerHTML = list.map(p => {
    const badgeClass = p.status === 'Available' ? 'success'
      : p.status === 'Reserved' ? 'warning'
        : 'danger';
    const detailHref = propertyDetailHref(p.id);
    const meta = encodeURIComponent(JSON.stringify({
      id: p.id,
      title: p.title,
      unit_code: p.unit_code,
      location: p.location,
      price: p.price,
      type: p.type,
      beds: p.beds,
      detailHref,
    }));
    return `
      <article class="property-card card-hover" role="button" tabindex="0" data-property-meta="${meta}" data-property-detail="${detailHref}">
        <div class="property-image ${p.accent}">
          <span class="badge ${badgeClass}">${p.badge}</span>
        </div>
        <div class="property-body">
          <h3>${escapeHtml(p.title)} <span class="muted" style="font-weight:500;">· ${escapeHtml(p.unit_code)}</span></h3>
          <div class="muted">📍 ${escapeHtml(p.location)}</div>
          <p style="margin: 12px 0 16px;">${escapeHtml(p.description)}</p>
          <div class="owner-row">
            <div class="owner-chip">
              <span class="avatar">${escapeHtml(p.owner)}</span>
              <span>${escapeHtml(p.type)} · ${p.beds} bed${p.beds === 1 ? '' : 's'}</span>
            </div>
            <div class="price">${formatPrice(p.price)} <span>/mo</span></div>
          </div>
          <div class="modal-actions" style="justify-content: space-between; margin-top: 16px;">
            <a class="btn btn-primary btn-block" href="${detailHref}">View details</a>
          </div>
        </div>
      </article>
    `;
  }).join('');
}

function setupPropertyInquiryModal() {
  const page = document.body.dataset.page;
  if (page !== 'properties') return;

  const modal = document.querySelector('[data-property-modal]');
  const form = document.querySelector('[data-property-inquiry-form]');
  const metaEl = document.querySelector('[data-property-modal-meta]');
  const status = document.querySelector('[data-property-inquiry-status]');
  const grid = document.querySelector('[data-properties-grid]');
  const user = getUser();
  let selectedProperty = null;

  if (!modal || !form || !metaEl || !status || !grid) return;

  function closeModal() {
    modal.hidden = true;
  }

  function openModal(propertyMeta) {
    selectedProperty = propertyMeta;
    metaEl.textContent =
      `${propertyMeta.title} (${propertyMeta.unit_code}) - ${propertyMeta.location} - ${formatPrice(propertyMeta.price)}/mo`;

    const fullNameInput = form.querySelector('[name="full_name"]');
    const emailInput = form.querySelector('[name="email"]');
    if (fullNameInput && !fullNameInput.value && user?.full_name) fullNameInput.value = user.full_name;
    if (emailInput && !emailInput.value && user?.email) emailInput.value = user.email;

    status.className = 'status-msg';
    status.textContent = '';
    modal.hidden = false;
  }

  function tryOpenFromCard(card) {
    const raw = card?.dataset?.propertyMeta;
    if (!raw) return;
    try {
      const decoded = JSON.parse(decodeURIComponent(raw));
      openModal(decoded);
    } catch {}
  }

  function navigateToDetail(card) {
    const href = card?.dataset?.propertyDetail;
    if (href) window.location.href = href;
  }

  grid.addEventListener('click', event => {
    const inquiryButton = event.target.closest('[data-open-property-inquiry]');
    if (inquiryButton) {
      const card = inquiryButton.closest('.property-card');
      if (card) tryOpenFromCard(card);
      return;
    }

    const detailLink = event.target.closest('a[href]');
    if (detailLink) return;

    const card = event.target.closest('.property-card');
    if (!card) return;
    navigateToDetail(card);
  });

  grid.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const card = event.target.closest('.property-card');
    if (!card) return;
    event.preventDefault();
    navigateToDetail(card);
  });

  modal.querySelectorAll('[data-close-property-modal]').forEach(btn => {
    btn.addEventListener('click', closeModal);
  });
  modal.addEventListener('click', event => {
    if (event.target === modal) closeModal();
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!selectedProperty) return;

    const full_name = form.querySelector('[name="full_name"]').value.trim();
    const email = form.querySelector('[name="email"]').value.trim();
    const phone = form.querySelector('[name="phone"]').value.trim();
    const address = form.querySelector('[name="address"]').value.trim();

    if (!full_name || !email || !phone || !address) {
      status.className = 'status-msg error show';
      status.textContent = 'Please fill in all fields.';
      return;
    }

    try {
      await api('/inquiries', {
        method: 'POST',
        body: JSON.stringify({
          unit_id: selectedProperty.id,
          full_name,
          email,
          phone,
          address,
        }),
      });
      status.className = 'status-msg success show';
      status.textContent = `Inquiry sent for ${selectedProperty.title}. We will contact you soon.`;
      form.reset();
      setTimeout(closeModal, 1000);
    } catch (err) {
      status.className = 'status-msg error show';
      status.textContent = err.message || 'Could not submit inquiry.';
    }
  });
}

function setupPropertyDetailInquiry() {
  const page = document.body.dataset.page;
  if (page !== 'property-detail') return;

  const modal = document.querySelector('[data-property-detail-modal]');
  const form = document.querySelector('[data-property-detail-inquiry-form]');
  const metaEl = document.querySelector('[data-property-detail-modal-meta]');
  const status = document.querySelector('[data-property-detail-inquiry-status]');
  const openBtn = document.querySelector('[data-open-detail-inquiry]');
  const user = getUser();
  let selectedProperty = null;

  if (!modal || !form || !metaEl || !status || !openBtn) return;

  function closeModal() {
    modal.hidden = true;
  }

  function openModal(property) {
    selectedProperty = property;
    metaEl.textContent = `${property.title} (${property.unit_code}) - ${property.location}`;

    const fullNameInput = form.querySelector('[name="full_name"]');
    const emailInput = form.querySelector('[name="email"]');
    if (fullNameInput && !fullNameInput.value && user?.full_name) fullNameInput.value = user.full_name;
    if (emailInput && !emailInput.value && user?.email) emailInput.value = user.email;

    status.className = 'status-msg';
    status.textContent = '';
    modal.hidden = false;
  }

  // Get property details from URL params
  const params = new URLSearchParams(window.location.search);
  const unitId = params.get('id');

  openBtn.addEventListener('click', () => {
    if (!selectedProperty && unitId) {
      api(`/units/${encodeURIComponent(unitId)}`)
        .then(data => {
          const unit = data.unit || {};
          const property = data.property || {};
          openModal({
            title: property.name || 'Property',
            unit_code: unit.unit_code || '',
            location: property.city || 'Unknown',
            id: unitId,
          });
        })
        .catch(() => {
          status.className = 'status-msg error show';
          status.textContent = 'Could not load property details.';
        });
    } else if (selectedProperty) {
      openModal(selectedProperty);
    }
  });

  document.querySelectorAll('[data-close-detail-modal]').forEach(btn => {
    btn.addEventListener('click', closeModal);
  });

  modal.addEventListener('click', event => {
    if (event.target === modal) closeModal();
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!selectedProperty && !unitId) return;

    const full_name = form.querySelector('[name="full_name"]').value.trim();
    const email = form.querySelector('[name="email"]').value.trim();
    const phone = form.querySelector('[name="phone"]').value.trim();
    const address = form.querySelector('[name="address"]').value.trim();

    if (!full_name || !email || !phone || !address) {
      status.className = 'status-msg error show';
      status.textContent = 'Please fill in all fields.';
      return;
    }

    try {
      await api('/inquiries', {
        method: 'POST',
        body: JSON.stringify({
          unit_id: selectedProperty?.id || unitId,
          full_name,
          email,
          phone,
          address,
        }),
      });
      status.className = 'status-msg success show';
      status.textContent = `Inquiry sent for ${selectedProperty?.title || 'property'}. We will contact you soon.`;
      form.reset();
      setTimeout(closeModal, 1000);
    } catch (err) {
      status.className = 'status-msg error show';
      status.textContent = err.message || 'Could not submit inquiry.';
    }
  });
}

function renderStars(rating) {
  const value = Math.max(0, Math.min(5, Number(rating) || 0));
  const full = '★'.repeat(Math.floor(value));
  const empty = '☆'.repeat(5 - Math.floor(value));
  return `<span style="color:#f59e0b; font-size:1.05rem; letter-spacing:1px;">${full}${empty}</span>`;
}

async function mountPropertyDetail() {
  if (document.body.dataset.page !== 'property-detail') return;

  const params = new URLSearchParams(window.location.search);
  const unitId = params.get('id');
  const titleEl = document.querySelector('[data-property-title]');
  const subtitleEl = document.querySelector('[data-property-subtitle]');
  const statusEl = document.querySelector('[data-property-status]');
  const overviewEl = document.querySelector('[data-property-overview]');
  const reviewCountEl = document.querySelector('[data-property-review-count]');
  const ratingEl = document.querySelector('[data-property-rating]');
  const reviewsEl = document.querySelector('[data-property-reviews]');

  if (!unitId) {
    if (titleEl) titleEl.textContent = 'Property not found';
    if (subtitleEl) subtitleEl.textContent = 'Missing property identifier in the URL.';
    if (overviewEl) overviewEl.innerHTML = '<p class="muted">Use the listings page to open a property detail card.</p>';
    if (reviewsEl) reviewsEl.innerHTML = '<p class="muted">No reviews available.</p>';
    return;
  }

  try {
    const data = await api(`/units/${encodeURIComponent(unitId)}`);
    const unit = data.unit || {};
    const property = data.property || {};
    const reviews = Array.isArray(data.reviews) ? data.reviews : [];
    const rating = Number(data.average_rating || 0);
    const reviewCount = Number(data.review_count || reviews.length || 0);

    if (titleEl) titleEl.textContent = `${property.name || 'Property details'} · ${unit.unit_code || ''}`.trim();
    if (subtitleEl) subtitleEl.textContent = property.description || 'Property information and tenant reviews.';
    if (statusEl) {
      statusEl.textContent = unit.availability_status || 'Unknown';
      statusEl.className = 'muted';
    }

    if (overviewEl) {
      overviewEl.innerHTML = `
        <div class="form-grid" style="gap: 16px;">
          <p><strong>Address:</strong> ${escapeHtml(property.address || '—')}, ${escapeHtml(property.city || '—')}</p>
          <p><strong>Type:</strong> ${escapeHtml(property.type || unit.unit_type || '—')}</p>
          <p><strong>Unit:</strong> ${escapeHtml(unit.unit_code || '—')}</p>
          <p><strong>Beds:</strong> ${Number(unit.beds || 0)}</p>
          <p><strong>Monthly rent:</strong> ${formatPrice(unit.monthly_rent || 0)}</p>
          <p><strong>Owner:</strong> ${escapeHtml(property.owner_name || '—')}</p>
          <div class="status-msg show" style="background:#f8fafc; color: inherit; margin-top: 4px;">
            ${escapeHtml(property.description || 'No additional description is available for this property.')}
          </div>
        </div>
      `;
    }

    if (reviewCountEl) reviewCountEl.textContent = `${reviewCount} review${reviewCount === 1 ? '' : 's'}`;
    if (ratingEl) {
      ratingEl.innerHTML = `
        <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
          ${renderStars(rating)}
          <strong style="font-size:1.2rem;">${rating.toFixed(1)}</strong>
          <span class="muted">${reviewCount ? 'Average rating from tenant reviews' : 'No ratings yet'}</span>
        </div>
      `;
    }

    if (reviewsEl) {
      if (!reviews.length) {
        reviewsEl.innerHTML = '<p class="muted">No reviews have been posted for this property yet.</p>';
      } else {
        reviewsEl.innerHTML = `
          <div class="activity-list">
            ${reviews.map(review => `
              <article class="data-card" style="padding: 18px; background:#f8fafc;">
                <div class="card-head" style="margin-bottom:10px;">
                  <strong>${escapeHtml(review.reviewer_name || 'Anonymous')}</strong>
                  <span class="muted">${new Date(review.created_at).toLocaleDateString()}</span>
                </div>
                <div style="display:flex; align-items:center; gap:10px; margin-bottom: 8px;">
                  ${renderStars(review.rating)}
                  <span class="muted">${Number(review.rating).toFixed(1)}/5</span>
                </div>
                <p>${escapeHtml(review.comment || '')}</p>
              </article>
            `).join('')}
          </div>
        `;
      }
    }
  } catch (err) {
    if (titleEl) titleEl.textContent = 'Property details unavailable';
    if (subtitleEl) subtitleEl.textContent = err.message || 'Could not load property information.';
    if (overviewEl) overviewEl.innerHTML = `<p class="muted">${escapeHtml(err.message || 'Could not load property information.')}</p>`;
    if (reviewsEl) reviewsEl.innerHTML = '<p class="muted">Could not load reviews.</p>';
  }
}

async function handlePropertyFilters() {
  const form = document.querySelector('[data-property-filters]');
  if (!form) return;

  let debounce;
  async function fetchAndRender() {
    const query = form.querySelector('[name="query"]')?.value.trim() || '';
    const type = form.querySelector('[name="type"]')?.value || '';
    const beds = form.querySelector('[name="beds"]')?.value || '';
    const maxPrice = form.querySelector('[name="price"]')?.value || 9999999;

    try {
      const qs = new URLSearchParams({ query, type, beds, maxPrice }).toString();
      const data = await api(`/units?${qs}`);
      renderProperties(data.units);
    } catch (err) {
      console.error(err);
      const grid = document.querySelector('[data-properties-grid]');
      if (grid) {
        grid.innerHTML = `<div class="data-card" style="grid-column: 1 / -1;"><h3>Could not load properties.</h3><p class="muted">${escapeHtml(err.message)}</p></div>`;
      }
    }
  }

  await fetchAndRender();
  form.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(fetchAndRender, 200);
  });
}

async function mountHomeStats() {
  if (document.body.dataset.page !== 'home') return;
  try {
    const s = await api('/stats/home-stats');
    const values = document.querySelectorAll('.stat-value');
    if (values[0]) values[0].textContent = formatShort(s.monthly_revenue);
    if (values[1]) values[1].textContent = `${s.occupancy}%`;
    if (values[2]) values[2].textContent = s.open_tickets;
    if (values[3]) values[3].textContent = s.active_leases;
  } catch (err) {
    console.warn('Could not load home stats:', err.message);
  }

  try {
    const { activity } = await api('/dashboard/activity');
    const list = document.querySelector('.hero-visual .activity-list');
    if (list && activity.length) {
      list.innerHTML = activity.slice(0, 3).map(a => `
        <div class="activity-item">
          <span>${escapeHtml(a.message)}</span>
          <span class="muted">${new Date(a.date).toLocaleDateString()}</span>
        </div>
      `).join('');
    }
  } catch (err) {
    console.warn('Could not load home activity:', err.message);
  }
}

async function mountDashboard() {
  if (document.body.dataset.page !== 'dashboard') return;

  try {
    const m = await api('/dashboard/metrics');
    const cards = document.querySelectorAll('.metrics-grid .metric-card strong');
    if (cards[0]) cards[0].textContent = m.total_properties;
    if (cards[1]) cards[1].textContent = `${m.occupancy_rate}%`;
    if (cards[2]) cards[2].textContent = formatShort(m.monthly_revenue);
    if (cards[3]) cards[3].textContent = m.open_maintenance;

    const subLabels = document.querySelectorAll('.metrics-grid .metric-card span');
    if (subLabels[3]) {
      subLabels[3].textContent = m.overdue_maintenance > 0
        ? `${m.overdue_maintenance} overdue` : 'All on schedule';
      subLabels[3].className = m.overdue_maintenance > 0 ? 'neg' : 'pos';
    }
  } catch (err) { console.warn(err.message); }

  try {
    const { activity } = await api('/dashboard/activity');
    const list = document.querySelector('.activity-list');
    if (list && activity.length) {
      list.innerHTML = activity.map(a => `
        <div class="activity-item">
          <span>${escapeHtml(a.message)}</span>
          <span class="muted">${new Date(a.date).toLocaleDateString()}</span>
        </div>
      `).join('');
    }
  } catch (err) { console.warn(err.message); }

  try {
    const { trend } = await api('/dashboard/revenue-trend');
    const ctx = document.getElementById('revenueChart');
    if (ctx && trend.length && typeof Chart !== 'undefined') {
      new Chart(ctx, {
        type: 'line',
        data: {
          labels: trend.map(t => t.month),
          datasets: [{
            label: 'Revenue (EGP)',
            data: trend.map(t => t.revenue),
            tension: 0.35, borderWidth: 3, fill: false,
            borderColor: '#99aa00', pointBackgroundColor: '#99aa00'
          }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
      });
    }
  } catch (err) { console.warn(err.message); }

  try {
    const { mix } = await api('/dashboard/occupancy-mix');
    const ctx = document.getElementById('occupancyChart');
    if (ctx && mix.length && typeof Chart !== 'undefined') {
      new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: mix.map(m => m.availability_status),
          datasets: [{
            data: mix.map(m => m.count),
            borderWidth: 0,
            backgroundColor: ['#d4e600', '#94a3b8', '#fb923c', '#60a5fa']
          }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
      });
    }
  } catch (err) { console.warn(err.message); }
}

async function mountAdmin() {
  if (document.body.dataset.page !== 'admin') return;

  try {
    const m = await api('/admin/metrics');
    const cards = document.querySelectorAll('.metrics-grid .metric-card strong');
    if (cards[0]) cards[0].textContent = m.total_users.toLocaleString();
    if (cards[1]) cards[1].textContent = m.active_leases.toLocaleString();
    if (cards[2]) cards[2].textContent = m.pending_approvals.toLocaleString();
    if (cards[3]) cards[3].textContent = formatShort(m.collected_revenue);
  } catch (err) { console.warn(err.message); }

  try {
    const { leases } = await api('/admin/recent-leases');
    const tbody = document.querySelector('.table tbody');
    if (tbody && leases.length) {
      tbody.innerHTML = leases.map(l => {
        const badgeClass = l.status === 'Active' ? 'success'
          : l.status === 'Expired' ? 'warning'
            : 'danger';
        return `<tr>
          <td>${escapeHtml(l.tenant)}</td>
          <td>${escapeHtml(l.property)}</td>
          <td>${new Date(l.start_date).toLocaleDateString()}</td>
          <td><span class="badge ${badgeClass}">${escapeHtml(l.status)}</span></td>
          <td>${formatPrice(l.monthly_rent)}</td>
        </tr>`;
      }).join('');
    }
  } catch (err) { console.warn(err.message); }

  try {
    const { distribution } = await api('/admin/user-distribution');
    const sideCardBody = document.querySelector('.side-card > div[style*="grid"]');
    if (sideCardBody) {
      const max = Math.max(...Object.values(distribution), 1);
      sideCardBody.innerHTML = Object.entries(distribution).map(([label, count]) => `
        <div>
          <strong>${escapeHtml(label)} <span class="muted" style="font-weight:500;">(${count})</span></strong>
          <div class="progress"><span style="width: ${Math.round((count / max) * 100)}%;"></span></div>
        </div>
      `).join('');
    }
  } catch (err) { console.warn(err.message); }

  try {
    const { trend } = await api('/admin/lease-trend');
    const ctx = document.getElementById('adminTrendChart');
    if (ctx && trend.length && typeof Chart !== 'undefined') {
      new Chart(ctx, {
        type: 'bar',
        data: {
          labels: trend.map(t => t.day),
          datasets: [{
            label: 'New leases',
            data: trend.map(t => t.count),
            borderWidth: 0,
            backgroundColor: '#d4e600'
          }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
      });
    }
  } catch (err) { console.warn(err.message); }
}

function mountUserLabel() {
  const user = getUser();
  document.querySelectorAll('[data-user-name]').forEach(node => {
    node.textContent = user?.full_name || 'Guest User';
  });
}

function handleCardHover() {
  document.querySelectorAll('.card-hover').forEach(card => {
    card.addEventListener('mouseenter', () => { card.style.boxShadow = '0 18px 40px rgba(15, 23, 42, 0.12)'; });
    card.addEventListener('mouseleave', () => { card.style.boxShadow = ''; });
  });
}

function handleLogout() {
  document.querySelectorAll('[data-logout]').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.preventDefault();
      try {
        await fetch(`${API_BASE}/auth/logout`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      } catch (_) {}
      clearAuth();
      window.location.href = 'auth.html';
    });
  });
}

window.SR = {
  api,
  getToken,
  getUser,
  setUser,
  clearAuth,
  formatPrice,
  formatShort,
  escapeHtml,
  validateUserForm,
  roleDashboardHref,
};

document.addEventListener('DOMContentLoaded', () => {
  const ok = guardPage();
  if (!ok) return;

  setActiveNav();
  mountYear();
  mountUserLabel();
  enhanceNavigation();
  handleAuthTabs();
  handlePropertyFilters();
  setupPropertyInquiryModal();
  setupPropertyDetailInquiry();
  handleCardHover();
  handleLogout();
  mountHomeStats();
  mountDashboard();
  mountAdmin();
  mountPropertyDetail();

  if (typeof initTenantDashboard === 'function') initTenantDashboard();
  if (typeof initUsersAdmin === 'function') initUsersAdmin();
});
