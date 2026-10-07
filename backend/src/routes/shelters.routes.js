const express = require('express');
const pool = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');
const { optionalAuthenticate } = require('../middleware/auth');
const router = express.Router();

router.get('/', optionalAuthenticate, asyncHandler(async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM v_shelter_capacity');
    res.json(rows);
  } catch (err) {
    const { rows } = await pool.query('SELECT * FROM shelters');
    res.json(rows);
  }
}));

router.get('/suggest', optionalAuthenticate, asyncHandler(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM sp_suggest_shelter($1)', [req.query.request_id]);
  res.json(rows);
}));

module.exports = router;
