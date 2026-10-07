const express = require('express');
const pool = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');
const { authenticate, optionalAuthenticate, authorize } = require('../middleware/auth');
const router = express.Router();

// Public-ish: all roles can read shelters
router.get('/', optionalAuthenticate, asyncHandler(async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM v_shelter_capacity ORDER BY available_beds DESC');
    res.json(rows);
  } catch (err) {
    const { rows } = await pool.query('SELECT * FROM shelters ORDER BY shelter_id');
    res.json(rows);
  }
}));

// Admin: update shelter status
router.patch('/:id/status', authenticate, authorize(['ADMIN', 'AGENCY_MANAGER']), asyncHandler(async (req, res) => {
  const { status } = req.body;
  await pool.query('UPDATE shelters SET status = $1 WHERE shelter_id = $2', [status, req.params.id]);
  res.json({ shelter_id: req.params.id, status });
}));

// Suggest shelter for a request (Admin/Manager)
router.get('/suggest', authenticate, authorize(['ADMIN', 'AGENCY_MANAGER']), asyncHandler(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM sp_suggest_shelter($1)', [req.query.request_id]);
  res.json(rows);
}));

module.exports = router;
