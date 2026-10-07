
const express = require('express');
const pool = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

router.get('/', authenticate, asyncHandler(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM v_volunteer_availability');
  res.json(rows);
}));

router.get('/me', authenticate, asyncHandler(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM allocations WHERE allocated_to = $1', [req.user.user_id]);
  res.json(rows);
}));

module.exports = router;
