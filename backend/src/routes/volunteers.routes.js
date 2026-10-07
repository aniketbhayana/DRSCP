const express = require('express');
const pool = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');
const { authenticate, optionalAuthenticate, authorize } = require('../middleware/auth');
const router = express.Router();

// All authenticated: list volunteers
router.get('/', optionalAuthenticate, asyncHandler(async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM v_volunteer_availability ORDER BY availability_status, full_name');
    res.json(rows);
  } catch (err) {
    const { rows } = await pool.query('SELECT * FROM volunteers ORDER BY full_name');
    res.json(rows);
  }
}));

// Volunteer: view own assignments
router.get('/me', authenticate, asyncHandler(async (req, res) => {
  const { rows } = await pool.query(`
    SELECT a.*, hr.request_type, hr.location_text, hr.district, hr.priority_score,
      r.full_name AS requester_name, r.phone AS requester_phone
    FROM allocations a
    JOIN help_requests hr ON a.request_id = hr.request_id
    JOIN requesters r ON hr.requester_id = r.requester_id
    LEFT JOIN app_users au ON au.volunteer_id = a.volunteer_id
    WHERE au.user_id = $1 AND a.status = 'ACTIVE'
    ORDER BY a.allocated_at DESC
  `, [req.user.user_id]);
  res.json(rows);
}));

module.exports = router;
