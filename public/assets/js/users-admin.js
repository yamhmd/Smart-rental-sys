function initUsersAdmin() {
  const SR = window.SR;
  if (!SR || !SR.api) return;

  const tbody = document.querySelector('[data-users-table-body]');
  const statusEl = document.querySelector('[data-users-status]');
  const modal = document.querySelector('[data-user-modal]');
  const form = document.querySelector('[data-user-edit-form]');

  function setStatus(msg, kind) {
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.className = `status-msg show ${kind || ''}`;
  }

  let usersCache = [];

  async function loadUsers() {
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" class="muted">Loading…</td></tr>';
    try {
      const data = await SR.api('/users');
      usersCache = data.users || [];
      tbody.innerHTML = usersCache.map(u => `
        <tr data-user-id="${u.user_id}">
          <td>${u.user_id}</td>
          <td>${SR.escapeHtml(u.email)}</td>
          <td>${SR.escapeHtml(u.full_name)}</td>
          <td><span class="badge">${SR.escapeHtml(u.role)}</span></td>
          <td class="muted">${u.created_at ? new Date(u.created_at).toLocaleString() : '—'}</td>
          <td>
            <button type="button" class="btn btn-light" data-edit-user="${u.user_id}">Edit</button>
            <button type="button" class="btn btn-light" data-delete-user="${u.user_id}" style="color:#b91c1c;">Delete</button>
          </td>
        </tr>`).join('');

      tbody.querySelectorAll('[data-edit-user]').forEach(btn => {
        btn.addEventListener('click', () => openEdit(Number(btn.dataset.editUser)));
      });
      tbody.querySelectorAll('[data-delete-user]').forEach(btn => {
        btn.addEventListener('click', () => removeUser(Number(btn.dataset.deleteUser)));
      });
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="6">${SR.escapeHtml(e.message)}</td></tr>`;
    }
  }

  function openEdit(userId) {
    const u = usersCache.find(x => x.user_id === userId);
    if (!u || !modal || !form) return;
    form.dataset.userId = String(userId);
    form.querySelector('[name="email"]').value = u.email;
    form.querySelector('[name="full_name"]').value = u.full_name;
    form.querySelector('[name="role"]').value = u.role;
    form.querySelector('[name="password"]').value = '';
    modal.hidden = false;
  }

  function closeModal() {
    if (modal) modal.hidden = true;
  }

  if (modal) {
    modal.querySelectorAll('[data-close-modal]').forEach(b => b.addEventListener('click', closeModal));
    modal.addEventListener('click', ev => {
      if (ev.target === modal) closeModal();
    });
  }

  if (form) {
    form.addEventListener('submit', async ev => {
      ev.preventDefault();
      const userId = Number(form.dataset.userId, 10);
      const email = form.querySelector('[name="email"]').value.trim();
      const full_name = form.querySelector('[name="full_name"]').value.trim();
      const role = form.querySelector('[name="role"]').value;
      const password = form.querySelector('[name="password"]').value;

      const err = SR.validateUserForm({
        email,
        full_name,
        password,
        passwordOptional: true,
      });
      if (err) {
        setStatus(err, 'error');
        return;
      }

      const body = { email, full_name, role };
      if (password) body.password = password;

      try {
        await SR.api(`/users/${userId}`, { method: 'PATCH', body: JSON.stringify(body) });
        setStatus('User updated.', 'success');
        closeModal();
        await loadUsers();
      } catch (e) {
        setStatus(e.message, 'error');
      }
    });
  }

  async function removeUser(userId) {
    const me = SR.getUser();
    if (me && me.user_id === userId) {
      setStatus('You cannot delete your own account.', 'error');
      return;
    }
    if (!window.confirm('Delete this user permanently?')) return;
    try {
      await SR.api(`/users/${userId}`, { method: 'DELETE' });
      setStatus('User deleted.', 'success');
      await loadUsers();
    } catch (e) {
      setStatus(e.message, 'error');
    }
  }

  loadUsers();
}
