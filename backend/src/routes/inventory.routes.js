const express = require('express');
const pool = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');
const { authenticate, optionalAuthenticate, authorize } = require('../middleware/auth');
const router = express.Router();

// Admin/Manager: view all inventory with stock alerts
router.get('/', optionalAuthenticate, asyncHandler(async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM v_inventory_status ORDER BY is_low_stock DESC, shelter_name');
    res.json(rows);
  } catch (err) {
    const { rows } = await pool.query(`
      SELECT ri.*, s.name AS shelter_name, rt.name AS resource_name, rt.category, rt.unit
      FROM resource_inventory ri
      JOIN shelters s ON ri.shelter_id = s.shelter_id
      JOIN resource_types rt ON ri.resource_type_id = rt.resource_type_id
      ORDER BY ri.quantity_available ASC
    `);
    res.json(rows);
  }
}));

// Admin/Manager: update stock level
router.patch('/:id/stock', authenticate, authorize(['ADMIN', 'AGENCY_MANAGER']), asyncHandler(async (req, res) => {
  const { quantity } = req.body;
  await pool.query('UPDATE resource_inventory SET quantity_available = $1 WHERE inventory_id = $2', [quantity, req.params.id]);
  res.json({ inventory_id: req.params.id, quantity_available: quantity });
}));

// Stock alerts (Admin/Manager)
router.get('/alerts', authenticate, authorize(['ADMIN', 'AGENCY_MANAGER']), asyncHandler(async (req, res) => {
  const { rows } = await pool.query(`
    SELECT sa.*, ri.quantity_available, rt.name AS resource_name, s.name AS shelter_name
    FROM stock_alerts sa
    JOIN resource_inventory ri ON sa.inventory_id = ri.inventory_id
    JOIN resource_types rt ON ri.resource_type_id = rt.resource_type_id
    JOIN shelters s ON ri.shelter_id = s.shelter_id
    WHERE sa.resolved = false
    ORDER BY sa.created_at DESC
  `);
  res.json(rows);
}));

module.exports = router;
