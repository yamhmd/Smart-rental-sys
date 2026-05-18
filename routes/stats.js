const express = require('express');
const pool    = require('../db/connection');

const router = express.Router();

router.get('/home-stats', async (req, res) => {
  try {
    const [[rev]] = await pool.query(
      `SELECT COALESCE(SUM(monthly_rent), 0) AS monthly_revenue
       FROM LeaseContract WHERE contract_status = 'Active'`
    );
    const [[u]] = await pool.query(
      `SELECT COUNT(*) AS total_units,
              SUM(availability_status = 'Occupied') AS occupied_units
       FROM Unit`
    );
    const [[m]] = await pool.query(
      `SELECT SUM(request_status IN ('Pending','Approved','Scheduled','In Progress')) AS open_tickets
       FROM MaintenanceRequest`
    );
    const [[l]] = await pool.query(
      `SELECT COUNT(*) AS active_leases FROM LeaseContract WHERE contract_status = 'Active'`
    );

    res.json({
      monthly_revenue: Number(rev.monthly_revenue),
      occupancy:       u.total_units > 0
                         ? Math.round((u.occupied_units / u.total_units) * 100) : 0,
      open_tickets:    m.open_tickets   || 0,
      active_leases:   l.active_leases || 0
    });
  } catch (err) {
    console.error('home stats error:', err);
    res.status(500).json({ error: 'Failed to fetch home stats' });
  }
});

module.exports = router;
