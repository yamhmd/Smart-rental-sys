const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('../db/connection');
const { authRequired, requireRole } = require('../middleware/auth');
const {
  isValidEmail,
  isNonEmptyString,
  validatePassword,
  isAllowedRole,
} = require('../utils/validation');

const router = express.Router();

router.use(authRequired, requireRole('admin'));

const PUBLIC_USER_FIELDS =
  'user_id, email, full_name, role, tenant_id, staff_id, created_at';

function parseUserId(param) {
  const id = Number.parseInt(param, 10);
  if (!Number.isInteger(id) || id < 1) return null;
  return id;
}

router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT ${PUBLIC_USER_FIELDS} FROM Users ORDER BY user_id ASC`
    );
    res.json({ users: rows });
  } catch (err) {
    console.error('list users error:', err);
    res.status(500).json({ error: 'Could not load users' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const id = parseUserId(req.params.id);
    if (!id) {
      return res.status(400).json({ error: 'Invalid user id' });
    }

    const [rows] = await pool.query(
      `SELECT ${PUBLIC_USER_FIELDS} FROM Users WHERE user_id = ?`,
      [id]
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user: rows[0] });
  } catch (err) {
    console.error('get user error:', err);
    res.status(500).json({ error: 'Could not load user' });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const id = parseUserId(req.params.id);
    if (!id) {
      return res.status(400).json({ error: 'Invalid user id' });
    }

    const { email, full_name, role, password } = req.body || {};

    const [existingRows] = await pool.query(
      `SELECT user_id, email, role FROM Users WHERE user_id = ?`,
      [id]
    );
    if (!existingRows.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updates = [];
    const params = [];

    if (email !== undefined) {
      if (!isValidEmail(email)) {
        return res.status(400).json({ error: 'Invalid email address' });
      }
      const normalized = email.trim().toLowerCase();
      const [dup] = await pool.query(
        'SELECT user_id FROM Users WHERE email = ? AND user_id <> ?',
        [normalized, id]
      );
      if (dup.length) {
        return res.status(409).json({ error: 'Another account already uses this email' });
      }
      updates.push('email = ?');
      params.push(normalized);
    }

    if (full_name !== undefined) {
      if (!isNonEmptyString(full_name)) {
        return res.status(400).json({ error: 'Full name cannot be empty' });
      }
      if (full_name.trim().length > 150) {
        return res.status(400).json({ error: 'Full name is too long' });
      }
      updates.push('full_name = ?');
      params.push(full_name.trim());
    }

    if (role !== undefined) {
      if (!isAllowedRole(role)) {
        return res.status(400).json({ error: 'role must be tenant, manager, or admin' });
      }
      if (existingRows[0].role === 'admin' && role !== 'admin') {
        const [[cnt]] = await pool.query(
          `SELECT COUNT(*) AS c FROM Users WHERE role = 'admin'`
        );
        if (cnt.c <= 1) {
          return res.status(400).json({ error: 'Cannot remove the last administrator' });
        }
      }
      updates.push('role = ?');
      params.push(role);
    }

    if (password !== undefined && password !== '') {
      const pw = validatePassword(password, { minLength: 6 });
      if (!pw.ok) {
        return res.status(400).json({ error: pw.error });
      }
      const password_hash = await bcrypt.hash(password, 10);
      updates.push('password_hash = ?');
      params.push(password_hash);
    }

    if (!updates.length) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    params.push(id);
    await pool.query(
      `UPDATE Users SET ${updates.join(', ')} WHERE user_id = ?`,
      params
    );

    const [rows] = await pool.query(
      `SELECT ${PUBLIC_USER_FIELDS} FROM Users WHERE user_id = ?`,
      [id]
    );
    res.json({ user: rows[0] });
  } catch (err) {
    console.error('patch user error:', err);
    res.status(500).json({ error: 'Could not update user' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const id = parseUserId(req.params.id);
    if (!id) {
      return res.status(400).json({ error: 'Invalid user id' });
    }

    if (id === req.user.user_id) {
      return res.status(400).json({ error: 'You cannot delete your own account' });
    }

    const [rows] = await pool.query(
      'SELECT role FROM Users WHERE user_id = ?',
      [id]
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (rows[0].role === 'admin') {
      const [[cnt]] = await pool.query(
        `SELECT COUNT(*) AS c FROM Users WHERE role = 'admin'`
      );
      if (cnt.c <= 1) {
        return res.status(400).json({ error: 'Cannot delete the last administrator' });
      }
    }

    await pool.query('DELETE FROM Users WHERE user_id = ?', [id]);
    res.json({ message: 'User deleted', user_id: id });
  } catch (err) {
    console.error('delete user error:', err);
    res.status(500).json({ error: 'Could not delete user' });
  }
});

module.exports = router;
