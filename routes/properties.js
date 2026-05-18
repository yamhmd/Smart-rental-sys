const express = require('express');
const pool = require('../db/connection');

const router = express.Router();

const ACCENTS = ['seattle', 'bellevue', 'loft', 'nordic', 'garden', 'harbor'];
let inquirySchemaReady = false;
let reviewSchemaReady = false;

function pickAccent(id) {
  return ACCENTS[(Number(id) - 1) % ACCENTS.length];
}

function ownerInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase();
}

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

async function columnExists(tableName, columnName) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS c
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?`,
    [tableName, columnName]
  );
  return rows[0] && rows[0].c > 0;
}

async function addColumnIfMissing(tableName, columnName, definition) {
  const exists = await columnExists(tableName, columnName);
  if (exists) return;
  await pool.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
}

async function ensureInquiryTable() {
  if (inquirySchemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS PropertyInquiry (
      inquiry_id INT PRIMARY KEY AUTO_INCREMENT,
      unit_id INT NOT NULL,
      user_id INT NULL,
      tenant_id INT NULL,
      full_name VARCHAR(150) NOT NULL,
      email VARCHAR(150) NOT NULL,
      phone VARCHAR(30) NOT NULL,
      address VARCHAR(255) NOT NULL,
      message TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await addColumnIfMissing('PropertyInquiry', 'user_id', 'INT NULL');
  await addColumnIfMissing('PropertyInquiry', 'tenant_id', 'INT NULL');
  await addColumnIfMissing('PropertyInquiry', 'message', 'TEXT NULL');
  inquirySchemaReady = true;
}

async function ensureReviewTable() {
  if (reviewSchemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS PropertyReview (
      review_id INT PRIMARY KEY AUTO_INCREMENT,
      property_id INT NOT NULL,
      reviewer_name VARCHAR(150) NOT NULL,
      rating INT NOT NULL,
      comment TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  reviewSchemaReady = true;
}

function normalizeInquiryPayload(body = {}) {
  return {
    unit_id: body.unit_id,
    full_name: typeof body.full_name === 'string' ? body.full_name.trim() : '',
    email: typeof body.email === 'string' ? body.email.trim().toLowerCase() : '',
    phone: typeof body.phone === 'string' ? body.phone.trim() : '',
    address: typeof body.address === 'string' ? body.address.trim() : '',
    message: typeof body.message === 'string' ? body.message.trim() : '',
  };
}

async function loadReviewsForProperty(propertyId) {
  await ensureReviewTable();
  const [rows] = await pool.query(
    `SELECT review_id, property_id, reviewer_name, rating, comment, created_at
     FROM PropertyReview
     WHERE property_id = ?
     ORDER BY created_at DESC, review_id DESC`,
    [propertyId]
  );

  const count = rows.length;
  const averageRating = count
    ? Number((rows.reduce((sum, row) => sum + Number(row.rating || 0), 0) / count).toFixed(1))
    : 0;

  return {
    reviews: rows.map(row => ({
      review_id: row.review_id,
      property_id: row.property_id,
      reviewer_name: row.reviewer_name,
      rating: Number(row.rating),
      comment: row.comment,
      created_at: row.created_at,
    })),
    review_count: count,
    average_rating: averageRating,
  };
}

router.get('/units', async (req, res) => {
  try {
    const {
      query = '',
      type = '',
      beds = '',
      maxPrice = 9999999,
      status = ''
    } = req.query;

    let sql = `
      SELECT
        u.unit_id, u.unit_code, u.unit_type, u.beds,
        u.monthly_rent, u.availability_status,
        p.property_id, p.name AS property_name,
        p.address, p.city, p.type AS property_type,
        o.name AS owner_name
      FROM Unit u
      JOIN Property p ON u.property_id = p.property_id
      JOIN Owner o ON p.owner_id = o.owner_id
      WHERE 1=1
    `;
    const params = [];

    if (query) {
      sql += ' AND (p.name LIKE ? OR p.city LIKE ? OR p.address LIKE ? OR u.unit_code LIKE ?)';
      const q = `%${query}%`;
      params.push(q, q, q, q);
    }
    if (type) {
      sql += ' AND u.unit_type = ?';
      params.push(type);
    }
    if (beds) {
      sql += ' AND u.beds >= ?';
      params.push(Number(beds));
    }
    if (maxPrice) {
      sql += ' AND u.monthly_rent <= ?';
      params.push(Number(maxPrice));
    }
    if (status) {
      sql += ' AND u.availability_status = ?';
      params.push(status);
    }

    sql += ' ORDER BY u.unit_id';

    const [rows] = await pool.query(sql, params);

    const units = rows.map(row => ({
      id: row.unit_id,
      title: row.property_name,
      unit_code: row.unit_code,
      location: `${row.address}, ${row.city}`,
      type: row.unit_type,
      beds: row.beds,
      price: Number(row.monthly_rent),
      status: row.availability_status,
      owner: ownerInitials(row.owner_name),
      owner_name: row.owner_name,
      accent: pickAccent(row.unit_id),
      badge: row.availability_status === 'Available'
        ? 'AVAILABLE'
        : row.availability_status.toUpperCase(),
      description: `${row.unit_type} unit (${row.beds} bed${row.beds === 1 ? '' : 's'}) at ${row.property_name} on ${row.address} in ${row.city}.`
    }));

    res.json({ units, count: units.length });
  } catch (err) {
    console.error('GET /units error:', err);
    res.status(500).json({ error: 'Failed to fetch units' });
  }
});

router.get('/units/:id', async (req, res) => {
  try {
    const unitId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(unitId) || unitId < 1) {
      return res.status(400).json({ error: 'Invalid unit id' });
    }

    const [rows] = await pool.query(
      `SELECT
         u.unit_id, u.unit_code, u.unit_type, u.beds, u.monthly_rent, u.availability_status,
         p.property_id, p.name AS property_name, p.address, p.city, p.type AS property_type,
         o.name AS owner_name
       FROM Unit u
       JOIN Property p ON u.property_id = p.property_id
       JOIN Owner o ON p.owner_id = o.owner_id
       WHERE u.unit_id = ?`,
      [unitId]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Unit not found' });
    }

    const unit = rows[0];
    const reviewStats = await loadReviewsForProperty(unit.property_id);

    res.json({
      unit: {
        unit_id: unit.unit_id,
        unit_code: unit.unit_code,
        unit_type: unit.unit_type,
        beds: unit.beds,
        monthly_rent: Number(unit.monthly_rent),
        availability_status: unit.availability_status,
      },
      property: {
        property_id: unit.property_id,
        name: unit.property_name,
        address: unit.address,
        city: unit.city,
        type: unit.property_type,
        owner_name: unit.owner_name,
        description: `${unit.property_name} is a ${unit.property_type} property located at ${unit.address}, ${unit.city}. It offers ${unit.unit_type.toLowerCase()} accommodation with ${unit.beds} bed${unit.beds === 1 ? '' : 's'}.`,
      },
      reviews: reviewStats.reviews,
      review_count: reviewStats.review_count,
      average_rating: reviewStats.average_rating,
    });
  } catch (err) {
    console.error('GET /units/:id error:', err);
    res.status(500).json({ error: 'Failed to fetch unit' });
  }
});

router.post('/inquiries', async (req, res) => {
  try {
    const payload = normalizeInquiryPayload(req.body);
    await ensureInquiryTable();

    const unitId = Number.parseInt(payload.unit_id, 10);
    if (!Number.isInteger(unitId) || unitId < 1) {
      return res.status(400).json({ error: 'A valid unit_id is required' });
    }
    if (payload.full_name.length < 2 || payload.full_name.length > 150) {
      return res.status(400).json({ error: 'Full name must be 2-150 characters' });
    }
    if (!isValidEmail(payload.email)) {
      return res.status(400).json({ error: 'A valid email is required' });
    }
    if (payload.phone.length < 6 || payload.phone.length > 30) {
      return res.status(400).json({ error: 'Phone number must be 6-30 characters' });
    }
    if (payload.address.length < 5 || payload.address.length > 255) {
      return res.status(400).json({ error: 'Address must be 5-255 characters' });
    }
    if (payload.message.length > 2000) {
      return res.status(400).json({ error: 'Message is too long' });
    }

    const [unitRows] = await pool.query('SELECT unit_id FROM Unit WHERE unit_id = ?', [unitId]);
    if (!unitRows.length) {
      return res.status(404).json({ error: 'Selected property unit was not found' });
    }

    const userId = req.user && Number.isInteger(Number(req.user.user_id)) ? Number(req.user.user_id) : null;
    const tenantId = req.user && Number.isInteger(Number(req.user.tenant_id)) ? Number(req.user.tenant_id) : null;

    const [result] = await pool.query(
      `INSERT INTO PropertyInquiry
        (unit_id, user_id, tenant_id, full_name, email, phone, address, message)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        unitId,
        userId,
        tenantId,
        payload.full_name,
        payload.email,
        payload.phone,
        payload.address,
        payload.message || null,
      ]
    );

    res.status(201).json({
      message: 'Inquiry submitted successfully',
      inquiry_id: result.insertId,
    });
  } catch (err) {
    console.error('POST /inquiries error:', err);
    res.status(500).json({ error: 'Failed to submit inquiry' });
  }
});

module.exports = router;
