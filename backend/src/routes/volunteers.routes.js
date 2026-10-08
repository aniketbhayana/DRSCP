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

// Volunteer: view own profile and current availability
router.get('/profile', authenticate, asyncHandler(async (req, res) => {
  const { rows } = await pool.query(`
    SELECT v.*, a.name AS agency_name, au.username
    FROM volunteers v
    JOIN app_users au ON au.volunteer_id = v.volunteer_id
    LEFT JOIN agencies a ON v.agency_id = a.agency_id
    WHERE au.user_id = $1
  `, [req.user.user_id]);

  if (!rows.length) {
    return res.status(404).json({ error: 'Volunteer profile not found for this account' });
  }
  res.json(rows[0]);
}));

// Volunteer: view own assignments (defaults to ACTIVE, can pass ?status=ALL)
router.get('/me', authenticate, asyncHandler(async (req, res) => {
  const statusFilter = req.query.status || 'ACTIVE';
  let query = `
    SELECT a.*,
      hr.request_type, hr.location_text, hr.district, hr.priority_score, hr.description, hr.household_size, hr.created_at AS request_created_at,
      r.full_name AS requester_name, r.phone AS requester_phone,
      v.full_name AS volunteer_name, v.skill AS volunteer_skill, v.availability_status,
      (
        SELECT string_agg(vt.name, ', ')
        FROM requester_vulnerabilities rv
        JOIN vulnerability_types vt ON rv.vuln_type_id = vt.vuln_type_id
        WHERE rv.requester_id = r.requester_id
      ) AS vulnerabilities
    FROM allocations a
    JOIN help_requests hr ON a.request_id = hr.request_id
    JOIN requesters r ON hr.requester_id = r.requester_id
    JOIN volunteers v ON a.volunteer_id = v.volunteer_id
    JOIN app_users au ON au.volunteer_id = v.volunteer_id
    WHERE au.user_id = $1
  `;
  const params = [req.user.user_id];

  if (statusFilter.toUpperCase() !== 'ALL') {
    query += ' AND a.status = $2';
    params.push(statusFilter.toUpperCase());
  }

  query += ' ORDER BY a.allocated_at DESC';

  const { rows } = await pool.query(query, params);
  res.json(rows);
}));

module.exports = router;
