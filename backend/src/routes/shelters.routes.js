
const express = require('express');
const pool = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

router.get('/', authenticate, asyncHandler(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM v_shelter_capacity');
  res.json(rows);
}));

router.get('/suggest', authenticate, asyncHandler(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM sp_suggest_shelter($1)', [req.query.request_id]);
  res.json(rows);
}));

module.exports = router;
