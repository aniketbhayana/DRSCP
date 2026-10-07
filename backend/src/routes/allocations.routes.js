const express = require('express');
const pool = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');
const { authenticate, authorize } = require('../middleware/auth');
const router = express.Router();

// ── GET /api/allocations (Admin/Manager: all active allocations with full details)
router.get('/', authenticate, authorize(['ADMIN', 'AGENCY_MANAGER']), asyncHandler(async (req, res) => {
  const { rows } = await pool.query(`
    SELECT a.*,
      hr.request_type, hr.priority_score, hr.location_text, hr.district AS request_district,
      r.full_name AS requester_name, r.phone AS requester_phone,
      s.name AS shelter_name, s.district AS shelter_district,
      v.full_name AS volunteer_name, v.skill AS volunteer_skill,
      au.username AS allocated_by_username
    FROM allocations a
    JOIN help_requests hr ON a.request_id = hr.request_id
    JOIN requesters r ON hr.requester_id = r.requester_id
    LEFT JOIN shelters s ON a.shelter_id = s.shelter_id
    LEFT JOIN volunteers v ON a.volunteer_id = v.volunteer_id
    LEFT JOIN app_users au ON a.allocated_by = au.user_id
    ORDER BY a.allocated_at DESC
    LIMIT 200
  `);
  res.json(rows);
}));

// ── POST /api/allocations/bed (Admin/Manager: manual bed allocation)
router.post('/bed', authenticate, authorize(['ADMIN', 'AGENCY_MANAGER']), asyncHandler(async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { request_id, shelter_id, beds } = req.body;
    const { rows } = await client.query('SELECT sp_allocate_shelter_bed($1, $2, $3, $4)', [request_id, shelter_id, beds, req.user.user_id]);
    await client.query('COMMIT');
    res.status(201).json({ allocation_id: rows[0]?.sp_allocate_shelter_bed || 1, success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}));

// ── POST /api/allocations/volunteer (Admin/Manager: manual volunteer dispatch)
router.post('/volunteer', authenticate, authorize(['ADMIN', 'AGENCY_MANAGER']), asyncHandler(async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { request_id, volunteer_id } = req.body;
    const { rows } = await client.query('SELECT sp_assign_volunteer($1, $2, $3)', [request_id, volunteer_id, req.user.user_id]);
    await client.query('COMMIT');
    res.status(201).json({ allocation_id: rows[0]?.sp_assign_volunteer || 1, success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}));

// ── POST /api/allocations/resource (Admin/Manager: resource dispatch)
router.post('/resource', authenticate, authorize(['ADMIN', 'AGENCY_MANAGER']), asyncHandler(async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { request_id, inventory_id, quantity } = req.body;
    const { rows } = await client.query('SELECT sp_allocate_resource($1, $2, $3, $4)', [request_id, inventory_id, quantity, req.user.user_id]);
    await client.query('COMMIT');
    res.status(201).json({ allocation_id: rows[0]?.sp_allocate_resource || 1, success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}));

// ── POST /api/allocations/:id/complete
router.post('/:id/complete', authenticate, authorize(['ADMIN', 'AGENCY_MANAGER']), asyncHandler(async (req, res) => {
  await pool.query('SELECT sp_complete_allocation($1, $2)', [req.params.id, req.user.user_id]);
  res.json({ status: 'COMPLETED' });
}));

// ── POST /api/allocations/:id/cancel
router.post('/:id/cancel', authenticate, authorize(['ADMIN', 'AGENCY_MANAGER']), asyncHandler(async (req, res) => {
  await pool.query('SELECT sp_cancel_allocation($1, $2)', [req.params.id, req.user.user_id]);
  res.json({ status: 'CANCELLED' });
}));

module.exports = router;
