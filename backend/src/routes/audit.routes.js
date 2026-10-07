
const express = require('express');
const pool = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

router.get('/', authenticate, asyncHandler(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM v_allocation_history');
  res.json(rows);
}));

module.exports = router;
