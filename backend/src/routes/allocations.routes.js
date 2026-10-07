const express = require('express');
const pool = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');
const { optionalAuthenticate } = require('../middleware/auth');
const router = express.Router();

router.post('/bed', optionalAuthenticate, asyncHandler(async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { request_id, shelter_id, beds } = req.body;
    const userId = req.user?.user_id || 1;
    const { rows } = await client.query('SELECT sp_allocate_shelter_bed($1, $2, $3, $4)', [request_id, shelter_id, beds, userId]);
    await client.query('COMMIT');
    res.status(201).json({ allocation_id: rows[0]?.sp_allocate_shelter_bed || 1, success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}));

router.post('/volunteer', optionalAuthenticate, asyncHandler(async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { request_id, volunteer_id } = req.body;
    const userId = req.user?.user_id || 1;
    const { rows } = await client.query('SELECT sp_assign_volunteer($1, $2, $3)', [request_id, volunteer_id, userId]);
    await client.query('COMMIT');
    res.status(201).json({ allocation_id: rows[0]?.sp_assign_volunteer || 1, success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}));

router.post('/resource', optionalAuthenticate, asyncHandler(async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { request_id, inventory_id, quantity } = req.body;
    const userId = req.user?.user_id || 1;
    const { rows } = await client.query('SELECT sp_allocate_resource($1, $2, $3, $4)', [request_id, inventory_id, quantity, userId]);
    await client.query('COMMIT');
    res.status(201).json({ allocation_id: rows[0]?.sp_allocate_resource || 1, success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}));

router.post('/:id/complete', optionalAuthenticate, asyncHandler(async (req, res) => {
  const userId = req.user?.user_id || 1;
  await pool.query('SELECT sp_complete_allocation($1, $2)', [req.params.id, userId]);
  res.json({ status: 'COMPLETED' });
}));

router.post('/:id/cancel', optionalAuthenticate, asyncHandler(async (req, res) => {
  const userId = req.user?.user_id || 1;
  await pool.query('SELECT sp_cancel_allocation($1, $2)', [req.params.id, userId]);
  res.json({ status: 'CANCELLED' });
}));

module.exports = router;
