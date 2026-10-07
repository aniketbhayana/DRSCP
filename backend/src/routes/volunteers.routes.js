const express = require('express');
const pool = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');
const { optionalAuthenticate } = require('../middleware/auth');
const router = express.Router();

router.get('/', optionalAuthenticate, asyncHandler(async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM v_volunteer_availability');
    res.json(rows);
  } catch (err) {
    const { rows } = await pool.query('SELECT * FROM volunteers');
    res.json(rows);
  }
}));

router.get('/me', optionalAuthenticate, asyncHandler(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM allocations WHERE volunteer_id = $1', [req.user.user_id]);
  res.json(rows);
}));

module.exports = router;
