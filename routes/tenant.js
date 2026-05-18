const express = require('express');
const pool = require('../db/connection');
const { authRequired, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(authRequired, requireRole('tenant'));

async function resolveTenantId(userId) {
  const [[row]] = await pool.query(
    'SELECT tenant_id FROM Users WHERE user_id = ?',
    [userId]
  );
  return row && row.tenant_id != null ? row.tenant_id : null;
}

async function resolveTenantLikeRecord(userId) {
  const [[row]] = await pool.query(
    'SELECT tenant_id, full_name, email FROM Users WHERE user_id = ?',
    [userId]
  );
  return row || null;
}

router.get('/overview', async (req, res) => {
  try {
    const tenantId = await resolveTenantId(req.user.user_id);
    if (!tenantId) {
      return res.json({
        tenant_id: null,
        active_leases: 0,
        upcoming_payments: 0,
        open_maintenance: 0,
        message: 'Your account is not linked to a tenant record yet. Contact support to connect your leases.',
      });
    }

    const [[leasesRow]] = await pool.query(
      `SELECT COUNT(*) AS c FROM LeaseContract WHERE tenant_id = ? AND contract_status = 'Active'`,
      [tenantId]
    );
    const [[payRow]] = await pool.query(
      `SELECT COUNT(*) AS c
       FROM Payment p
       JOIN LeaseContract lc ON p.contract_id = lc.contract_id
       WHERE lc.tenant_id = ? AND IFNULL(p.payment_status, '') <> 'Paid'`,
      [tenantId]
    );

    const [[mRow]] = await pool.query(
      `SELECT COUNT(*) AS c
       FROM MaintenanceRequest mr
       JOIN LeaseContract lc ON mr.contract_id = lc.contract_id
       WHERE lc.tenant_id = ? AND mr.request_status IN ('Pending','Approved','Scheduled','In Progress')`,
      [tenantId]
    );
    const openMaint = mRow.c || 0;

    res.json({
      tenant_id: tenantId,
      active_leases: leasesRow.c || 0,
      upcoming_payments: payRow.c || 0,
      open_maintenance: openMaint,
    });
  } catch (err) {
    console.error('tenant overview error:', err);
    res.status(500).json({ error: 'Could not load tenant overview' });
  }
});

router.get('/leases', async (req, res) => {
  try {
    const tenantId = await resolveTenantId(req.user.user_id);
    if (!tenantId) {
      return res.json({ leases: [] });
    }

    const [rows] = await pool.query(
      `SELECT lc.contract_id, lc.start_date, lc.end_date, lc.monthly_rent, lc.contract_status,
              u.unit_code, p.name AS property_name, p.city
       FROM LeaseContract lc
       JOIN Unit u ON lc.unit_id = u.unit_id
       JOIN Property p ON u.property_id = p.property_id
       WHERE lc.tenant_id = ?
       ORDER BY lc.contract_status = 'Active' DESC, lc.start_date DESC`,
      [tenantId]
    );

    res.json({
      leases: rows.map(r => ({
        ...r,
        monthly_rent: Number(r.monthly_rent),
      })),
    });
  } catch (err) {
    console.error('tenant leases error:', err);
    res.status(500).json({ error: 'Could not load leases' });
  }
});

router.get('/payments', async (req, res) => {
  try {
    const tenantId = await resolveTenantId(req.user.user_id);
    if (!tenantId) {
      return res.json({ payments: [] });
    }

    const [rows] = await pool.query(
      `SELECT p.payment_id, p.payment_date, p.amount_paid, p.payment_status,
              pr.name AS property_name, u.unit_code
       FROM Payment p
       JOIN LeaseContract lc ON p.contract_id = lc.contract_id
       JOIN Unit u ON lc.unit_id = u.unit_id
       JOIN Property pr ON u.property_id = pr.property_id
       WHERE lc.tenant_id = ?
       ORDER BY p.payment_date DESC
       LIMIT 25`,
      [tenantId]
    );

    res.json({
      payments: rows.map(r => ({
        ...r,
        amount_paid: Number(r.amount_paid),
      })),
    });
  } catch (err) {
    console.error('tenant payments error:', err);
    res.status(500).json({ error: 'Could not load payments' });
  }
});

router.get('/maintenance', async (req, res) => {
  try {
    const tenantId = await resolveTenantId(req.user.user_id);
    if (!tenantId) {
      return res.json({ requests: [] });
    }

    const [rows] = await pool.query(
      `SELECT mr.request_id, mr.request_date, mr.issue_description, mr.request_status,
              pr.name AS property_name
       FROM MaintenanceRequest mr
       JOIN LeaseContract lc ON mr.contract_id = lc.contract_id
       JOIN Unit u ON lc.unit_id = u.unit_id
       JOIN Property pr ON u.property_id = pr.property_id
       WHERE lc.tenant_id = ?
       ORDER BY mr.request_date DESC
       LIMIT 25`,
      [tenantId]
    );

    res.json({ requests: rows });
  } catch (err) {
    console.error('tenant maintenance error:', err);
    res.status(500).json({ error: 'Could not load maintenance requests' });
  }
});

router.get('/inquiries', async (req, res) => {
  try {
    const tenantRow = await resolveTenantLikeRecord(req.user.user_id);
    if (!tenantRow) {
      return res.json({ inquiries: [] });
    }

    const [rows] = await pool.query(
      `SELECT pi.inquiry_id, pi.unit_id, pi.full_name, pi.email, pi.phone, pi.address, pi.message, pi.created_at,
              u.unit_code, p.name AS property_name, p.city
       FROM PropertyInquiry pi
       JOIN Unit u ON pi.unit_id = u.unit_id
       JOIN Property p ON u.property_id = p.property_id
       WHERE (pi.tenant_id = ? AND ? IS NOT NULL) OR pi.user_id = ?
       ORDER BY pi.created_at DESC, pi.inquiry_id DESC
       LIMIT 25`,
      [tenantRow.tenant_id, tenantRow.tenant_id, req.user.user_id]
    );

    res.json({
      inquiries: rows.map(row => ({
        inquiry_id: row.inquiry_id,
        unit_id: row.unit_id,
        unit_code: row.unit_code,
        property_name: row.property_name,
        city: row.city,
        full_name: row.full_name,
        email: row.email,
        phone: row.phone,
        address: row.address,
        message: row.message,
        created_at: row.created_at,
      })),
    });
  } catch (err) {
    console.error('tenant inquiries error:', err);
    res.status(500).json({ error: 'Could not load property inquiries' });
  }
});

module.exports = router;
