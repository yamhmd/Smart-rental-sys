const express = require('express');
const pool = require('../db/connection');
const { authRequired, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(authRequired, requireRole('admin'));

router.get('/metrics', async (req, res) => {
  try {
    const [[usersRow]] = await pool.query('SELECT COUNT(*) AS total_users FROM Users');
    const [[activeLeasesRow]] = await pool.query(
      `SELECT COUNT(*) AS active_leases FROM LeaseContract WHERE contract_status = 'Active'`
    );
    const [[pendingRow]] = await pool.query(
      `SELECT COUNT(*) AS pending_approvals FROM Application WHERE status = 'Pending'`
    );
    const [[revRow]] = await pool.query(
      `SELECT COALESCE(SUM(amount_paid), 0) AS collected_revenue
       FROM Payment WHERE payment_status IN ('Paid','Late','Partial')`
    );

    res.json({
      total_users:       usersRow.total_users,
      active_leases:     activeLeasesRow.active_leases,
      pending_approvals: pendingRow.pending_approvals,
      collected_revenue: Number(revRow.collected_revenue)
    });
  } catch (err) {
    console.error('admin metrics error:', err);
    res.status(500).json({ error: 'Failed to fetch admin metrics' });
  }
});

router.get('/recent-leases', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT lc.contract_id, t.full_name AS tenant, p.name AS property,
              lc.start_date, lc.contract_status AS status, lc.monthly_rent
       FROM LeaseContract lc
       JOIN Tenant t   ON lc.tenant_id = t.tenant_id
       JOIN Unit u     ON lc.unit_id   = u.unit_id
       JOIN Property p ON u.property_id = p.property_id
       ORDER BY lc.start_date DESC LIMIT 10`
    );
    res.json({ leases: rows.map(r => ({ ...r, monthly_rent: Number(r.monthly_rent) })) });
  } catch (err) {
    console.error('recent leases error:', err);
    res.status(500).json({ error: 'Failed to fetch leases' });
  }
});

router.get('/user-distribution', async (req, res) => {
  try {
    const [[t]] = await pool.query('SELECT COUNT(*) AS c FROM Tenant');
    const [[o]] = await pool.query('SELECT COUNT(*) AS c FROM Owner');
    const [staffByRole] = await pool.query(
      'SELECT role, COUNT(*) AS c FROM Staff GROUP BY role'
    );

    const distribution = {
      Landlords: o.c,
      Tenants:   t.c
    };
    staffByRole.forEach(r => {
      distribution[r.role + 's'] = r.c;
    });
    res.json({ distribution });
  } catch (err) {
    console.error('user distribution error:', err);
    res.status(500).json({ error: 'Failed to fetch user distribution' });
  }
});

router.get('/lease-trend', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT DATE_FORMAT(start_date, '%Y-%m-%d') AS day, COUNT(*) AS count
       FROM LeaseContract
       GROUP BY DATE_FORMAT(start_date, '%Y-%m-%d')
       ORDER BY day DESC LIMIT 7`
    );
    res.json({ trend: rows.reverse() });
  } catch (err) {
    console.error('lease trend error:', err);
    res.status(500).json({ error: 'Failed to fetch lease trend' });
  }
});

module.exports = router;
