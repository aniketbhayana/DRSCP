const express = require('express');
const pool = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');
const { optionalAuthenticate } = require('../middleware/auth');
const router = express.Router();

router.get('/', optionalAuthenticate, asyncHandler(async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM v_inventory_status');
    res.json(rows);
  } catch (err) {
    const { rows } = await pool.query(`
      SELECT ri.*, s.name AS shelter_name, rt.name AS resource_name, rt.category, rt.unit
      FROM resource_inventory ri
      JOIN shelters s ON ri.shelter_id = s.shelter_id
      JOIN resource_types rt ON ri.resource_type_id = rt.resource_type_id
    `);
    res.json(rows);
  }
}));

module.exports = router;
