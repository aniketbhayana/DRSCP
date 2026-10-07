
const express = require('express');
const pool = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

router.post('/bed', authenticate, asyncHandler(async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { request_id, shelter_id, beds } = req.body;
    const { rows } = await client.query('SELECT sp_allocate_shelter_bed($1, $2, $3, $4)', [request_id, shelter_id, beds, req.user.user_id]);
    await client.query('COMMIT');
    res.status(201).json({ allocation_id: rows[0].sp_allocate_shelter_bed });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}));

router.post('/volunteer', authenticate, asyncHandler(async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { request_id, volunteer_id } = req.body;
    const { rows } = await client.query('SELECT sp_assign_volunteer($1, $2, $3)', [request_id, volunteer_id, req.user.user_id]);
    await client.query('COMMIT');
    res.status(201).json({ allocation_id: rows[0].sp_assign_volunteer });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}));

router.post('/resource', authenticate, asyncHandler(async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { request_id, inventory_id, quantity } = req.body;
    const { rows } = await client.query('SELECT sp_allocate_resource($1, $2, $3, $4)', [request_id, inventory_id, quantity, req.user.user_id]);
    await client.query('COMMIT');
    res.status(201).json({ allocation_id: rows[0].sp_allocate_resource });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}));

router.post('/:id/complete', authenticate, asyncHandler(async (req, res) => {
  await pool.query('SELECT sp_complete_allocation($1, $2)', [req.params.id, req.user.user_id]);
  res.json({ status: 'COMPLETED' });
}));

router.post('/:id/cancel', authenticate, asyncHandler(async (req, res) => {
  await pool.query('SELECT sp_cancel_allocation($1, $2)', [req.params.id, req.user.user_id]);
  res.json({ status: 'CANCELLED' });
}));

module.exports = router;
