const express = require('express');
const pool = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');
const { authenticate, optionalAuthenticate } = require('../middleware/auth');
const router = express.Router();

router.post('/', optionalAuthenticate, asyncHandler(async (req, res) => {
  const { requester_id, request_type, household_size, location_text, district, description } = req.body;
  const result = await pool.query(
    `INSERT INTO help_requests (requester_id, request_type, household_size, location_text, district, description) 
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING request_id, priority_score, status`,
    [requester_id || 1, request_type, household_size || 1, location_text, district, description]
  );
  res.status(201).json(result.rows[0]);
}));

router.get('/', optionalAuthenticate, asyncHandler(async (req, res) => {
  const { limit, offset } = req.query;
  const { rows } = await pool.query('SELECT * FROM help_requests ORDER BY priority_score DESC LIMIT $1 OFFSET $2', [limit || 50, offset || 0]);
  res.json(rows);
}));

router.get('/urgent', optionalAuthenticate, asyncHandler(async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM v_urgent_requests_ranked LIMIT 50');
    res.json(rows);
  } catch (err) {
    const { rows } = await pool.query(`
      SELECT hr.*, r.full_name AS requester_name 
      FROM help_requests hr 
      JOIN requesters r ON hr.requester_id = r.requester_id 
      WHERE hr.status = 'PENDING' 
      ORDER BY hr.priority_score DESC
    `);
    res.json(rows);
  }
}));

router.get('/:id', optionalAuthenticate, asyncHandler(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM help_requests WHERE request_id = $1', [req.params.id]);
  if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
  res.json(rows[0]);
}));

router.patch('/:id/cancel', optionalAuthenticate, asyncHandler(async (req, res) => {
  await pool.query("UPDATE help_requests SET status = 'CANCELLED' WHERE request_id = $1", [req.params.id]);
  res.json({ status: 'CANCELLED' });
}));

module.exports = router;
