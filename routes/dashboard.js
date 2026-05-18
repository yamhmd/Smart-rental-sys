const express = require('express');
const pool = require('../db/connection');
const { authRequired, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/activity', async (req, res) => {
  try {
    const [payments] = await pool.query(
      `SELECT 'payment' AS kind, p.payment_id AS id, p.payment_date AS date,
              CONCAT('Payment received · ', pr.name) AS message
       FROM Payment p
       JOIN LeaseContract lc ON p.contract_id = lc.contract_id
       JOIN Unit u           ON lc.unit_id    = u.unit_id
       JOIN Property pr      ON u.property_id = pr.property_id
       WHERE p.payment_status = 'Paid' AND p.payment_date IS NOT NULL
       ORDER BY p.payment_date DESC LIMIT 5`
    );
    const [leases] = await pool.query(
      `SELECT 'lease' AS kind, lc.contract_id AS id, lc.start_date AS date,
              CONCAT('Lease signed · ', pr.name) AS message
       FROM LeaseContract lc
       JOIN Unit u      ON lc.unit_id    = u.unit_id
       JOIN Property pr ON u.property_id = pr.property_id
       ORDER BY lc.start_date DESC LIMIT 5`
    );
    const [maint] = await pool.query(
      `SELECT 'maintenance' AS kind, mr.request_id AS id, mr.request_date AS date,
              CONCAT('Maintenance · ', LEFT(mr.issue_description, 50)) AS message
       FROM MaintenanceRequest mr
       ORDER BY mr.request_date DESC LIMIT 5`
    );

    const activity = [...payments, ...leases, ...maint]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 8);
    res.json({ activity });
  } catch (err) {
    console.error('activity error:', err);
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
});

router.use(authRequired, requireRole('manager', 'admin'));

router.get('/metrics', async (req, res) => {
  try {
    const [[propCount]] = await pool.query(
      'SELECT COUNT(*) AS total_properties FROM Property'
    );
    const [[unitCount]] = await pool.query(
      `SELECT COUNT(*) AS total_units,
              SUM(availability_status = 'Occupied') AS occupied_units
       FROM Unit`
    );
    const [[rev]] = await pool.query(
      `SELECT COALESCE(SUM(monthly_rent), 0) AS monthly_revenue
       FROM LeaseContract WHERE contract_status = 'Active'`
    );
    const [[maint]] = await pool.query(
      `SELECT
         SUM(request_status IN ('Pending','Approved','Scheduled','In Progress')) AS open_maintenance,
         SUM(request_status = 'Pending' AND request_date < CURDATE() - INTERVAL 7 DAY) AS overdue_maintenance
       FROM MaintenanceRequest`
    );

    const total_units = unitCount.total_units || 0;
    const occupied_units = unitCount.occupied_units || 0;
    const occupancy_rate = total_units > 0
      ? Math.round((occupied_units / total_units) * 100) : 0;

    res.json({
      total_properties: propCount.total_properties,
      total_units,
      occupied_units,
      occupancy_rate,
      monthly_revenue: Number(rev.monthly_revenue),
      open_maintenance: maint.open_maintenance || 0,
      overdue_maintenance: maint.overdue_maintenance || 0
    });
  } catch (err) {
    console.error('dashboard metrics error:', err);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

router.get('/revenue-trend', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT DATE_FORMAT(payment_date, '%Y-%m') AS month,
              SUM(amount_paid)                   AS revenue
       FROM Payment
       WHERE payment_status IN ('Paid','Late','Partial')
         AND payment_date IS NOT NULL
       GROUP BY DATE_FORMAT(payment_date, '%Y-%m')
       ORDER BY month DESC
       LIMIT 6`
    );
    res.json({ trend: rows.reverse().map(r => ({
      month: r.month,
      revenue: Number(r.revenue)
    })) });
  } catch (err) {
    console.error('revenue trend error:', err);
    res.status(500).json({ error: 'Failed to fetch revenue trend' });
  }
});

router.get('/occupancy-mix', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT availability_status, COUNT(*) AS count
       FROM Unit
       GROUP BY availability_status`
    );
    res.json({ mix: rows });
  } catch (err) {
    console.error('occupancy mix error:', err);
    res.status(500).json({ error: 'Failed to fetch occupancy mix' });
  }
});

module.exports = router;
