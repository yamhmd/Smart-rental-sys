const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db/connection');
const { authRequired, JWT_SECRET } = require('../middleware/auth');
const {
  isValidEmail,
  isNonEmptyString,
  validatePassword,
} = require('../utils/validation');

const router = express.Router();

function buildUserPayload(row) {
  return {
    user_id: row.user_id,
    email: row.email,
    full_name: row.full_name,
    role: row.role,
    tenant_id: row.tenant_id != null ? row.tenant_id : null,
    staff_id: row.staff_id != null ? row.staff_id : null,
  };
}

function normalizeRegistrationRole(role) {
  const normalized = typeof role === 'string' ? role.trim().toLowerCase() : '';
  if (normalized === 'owner') return 'owner';
  if (normalized === 'tenant') return 'tenant';
  return 'tenant';
}

router.post('/register', async (req, res) => {
  try {
    const { email, password, full_name, role: requestedRole } = req.body || {};
    const role = normalizeRegistrationRole(requestedRole);

    if (!isNonEmptyString(full_name)) {
      return res.status(400).json({ error: 'Full name is required' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'A valid email address is required' });
    }
    const pw = validatePassword(password, { minLength: 6 });
    if (!pw.ok) {
      return res.status(400).json({ error: pw.error });
    }
    if (full_name.trim().length > 150) {
      return res.status(400).json({ error: 'Full name is too long' });
    }
    if (!['tenant', 'owner'].includes(role)) {
      return res.status(400).json({ error: 'Role must be tenant or owner' });
    }

    const [existing] = await pool.query(
      'SELECT user_id FROM Users WHERE email = ?',
      [email.trim().toLowerCase()]
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: 'This email is already registered' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO Users (email, password_hash, full_name, role) VALUES (?, ?, ?, ?)',
      [email.trim().toLowerCase(), password_hash, full_name.trim(), role]
    );

    const [rows] = await pool.query(
      'SELECT user_id, email, full_name, role, tenant_id, staff_id FROM Users WHERE user_id = ?',
      [result.insertId]
    );
    const dbUser = rows[0];
    const user = buildUserPayload(dbUser);
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({ token, user });
  } catch (err) {
    console.error('register error:', err.message, err.code);
    
    // Provide specific error messages
    if (err.code === 'ER_ACCESS_DENIED_ERROR' || err.code === 'ER_BAD_DB_ERROR') {
      return res.status(500).json({ error: 'Database connection failed. Please check server logs.' });
    }
    if (err.code === 'ER_NO_REFERENCED_ROW_2' || err.code === 'ER_NO_REFERENCED_ROW') {
      return res.status(400).json({ error: 'Invalid data provided' });
    }
    
    res.status(500).json({ error: 'Registration could not be completed' });
  }
});


router.post('/logout', (req, res) => {
  res.json({ message: 'Signed out successfully.' });
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'A valid email address is required' });
    }
    if (typeof password !== 'string' || !password.length) {
      return res.status(400).json({ error: 'Password is required' });
    }

    const [rows] = await pool.query(
      'SELECT user_id, email, password_hash, full_name, role, tenant_id, staff_id FROM Users WHERE email = ?',
      [email.trim().toLowerCase()]
    );
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const dbUser = rows[0];
    const match = await bcrypt.compare(password, dbUser.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = buildUserPayload(dbUser);
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });

    res.json({ token, user });
  } catch (err) {
    console.error('login error:', err);
    res.status(500).json({ error: 'Sign-in could not be completed' });
  }
});

router.get('/me', authRequired, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT user_id, email, full_name, role, tenant_id, staff_id FROM Users WHERE user_id = ?',
      [req.user.user_id]
    );
    if (!rows.length) {
      return res.status(401).json({ error: 'Account no longer exists' });
    }
    res.json({ user: buildUserPayload(rows[0]) });
  } catch (err) {
    console.error('me error:', err);
    res.status(500).json({ error: 'Could not load profile' });
  }
});

module.exports = router;
