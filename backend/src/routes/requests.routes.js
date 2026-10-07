const express = require('express');
const pool = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');
const { authenticate, optionalAuthenticate, authorize } = require('../middleware/auth');
const router = express.Router();

// GET /api/requests (Admin: paginated requests)
router.get('/', authenticate, authorize(['ADMIN', 'AGENCY_MANAGER']), asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const offset = parseInt(req.query.offset) || 0;
  const status = req.query.status;

  let query = `
    SELECT hr.*, r.full_name AS requester_name, r.phone AS requester_phone, r.district AS requester_district
    FROM help_requests hr
    JOIN requesters r ON hr.requester_id = r.requester_id
    ORDER BY hr.priority_score DESC, hr.created_at DESC
    LIMIT $1 OFFSET $2
  `;
  const params = [limit, offset];
  if (status) {
    query = `
      SELECT hr.*, r.full_name AS requester_name, r.phone AS requester_phone, r.district AS requester_district
      FROM help_requests hr
      JOIN requesters r ON hr.requester_id = r.requester_id
      WHERE hr.status = $3
      ORDER BY hr.priority_score DESC, hr.created_at DESC
      LIMIT $1 OFFSET $2
    `;
    params.push(status);
  }
  const { rows } = await pool.query(query, params);
  res.json(rows);
}));

// GET /api/requests/urgent (Admin/Manager: urgent ranked)
router.get('/urgent', optionalAuthenticate, asyncHandler(async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM v_urgent_requests_ranked LIMIT 100');
    res.json(rows);
  } catch (err) {
    const { rows } = await pool.query(`
      SELECT hr.*, r.full_name AS requester_name, r.phone AS requester_phone, r.district AS requester_district
      FROM help_requests hr
      JOIN requesters r ON hr.requester_id = r.requester_id
      WHERE hr.status = 'PENDING'
      ORDER BY hr.priority_score DESC
    `);
    res.json(rows);
  }
}));

// GET /api/requests/my (Requester: own requests with allocation details)
router.get('/my', authenticate, asyncHandler(async (req, res) => {
  const { rows } = await pool.query(`
    SELECT hr.*, r.full_name AS requester_name,
      a.allocation_id, a.status AS alloc_status, a.beds_allocated,
      s.name AS shelter_name, s.district AS shelter_district,
      v.full_name AS volunteer_name, v.skill AS volunteer_skill, v.phone AS volunteer_phone,
      rt.name AS resource_name, a.quantity AS resource_quantity
    FROM help_requests hr
    JOIN requesters r ON hr.requester_id = r.requester_id
    LEFT JOIN allocations a ON a.request_id = hr.request_id AND a.status = 'ACTIVE'
    LEFT JOIN shelters s ON a.shelter_id = s.shelter_id
    LEFT JOIN volunteers v ON a.volunteer_id = v.volunteer_id
    LEFT JOIN resource_types rt ON a.resource_type_id = rt.resource_type_id
    LEFT JOIN app_users au ON au.requester_id = r.requester_id
    WHERE au.user_id = $1
    ORDER BY hr.created_at DESC
  `, [req.user.user_id]);
  res.json(rows);
}));

// POST /api/requests (Submit + instant auto-allocation via stored procedures & math formula)
router.post('/', authenticate, asyncHandler(async (req, res) => {
  let { request_type, household_size, location_text, district, description } = req.body;

  // Map SHELTER to EVACUATION (db constraint allows: EVACUATION, FOOD, WATER, MEDICAL, RESCUE)
  if (request_type === 'SHELTER') {
    request_type = 'EVACUATION';
  }

  // Resolve requester profile for this user
  let requester_id;
  const { rows: userRows } = await pool.query(
    'SELECT requester_id FROM app_users WHERE user_id = $1', [req.user.user_id]
  );
  if (userRows.length && userRows[0].requester_id) {
    requester_id = userRows[0].requester_id;
  } else {
    const { rows: newReq } = await pool.query(
      'INSERT INTO requesters (full_name, phone, district) VALUES ($1, $2, $3) RETURNING requester_id',
      [req.user.username || 'Citizen', '9840123456', district || 'Chennai']
    );
    requester_id = newReq[0].requester_id;
    await pool.query('UPDATE app_users SET requester_id = $1 WHERE user_id = $2', [requester_id, req.user.user_id]);
  }

  // Insert the request (trigger auto-computes priority_score formula)
  let newRequest;
  try {
    const { rows: reqRows } = await pool.query(`
      INSERT INTO help_requests (requester_id, request_type, household_size, location_text, district, description)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [requester_id, request_type, parseInt(household_size) || 1, location_text, district || 'Chennai', description || '']);
    newRequest = reqRows[0];
  } catch (insertErr) {
    if (insertErr.code === 'P0010') {
      return res.status(409).json({
        error: `You already have an active ${request_type} request within the last 60 minutes. Please see your active requests below.`
      });
    }
    throw insertErr;
  }

  let autoAlloc = null;
  const adminUserId = 1;

  try {
    // 1. RESCUE / MEDICAL / EVACUATION -> auto-assign available volunteer
    if (['RESCUE', 'EVACUATION', 'MEDICAL'].includes(request_type)) {
      const targetSkill = request_type === 'MEDICAL' ? 'MEDICAL' : 'RESCUE';
      const { rows: vols } = await pool.query(`
        SELECT volunteer_id, full_name, phone, skill FROM volunteers
        WHERE availability_status = 'AVAILABLE'
        ORDER BY CASE WHEN skill = $1 THEN 0 ELSE 1 END, volunteer_id ASC
        LIMIT 1
      `, [targetSkill]);

      if (vols.length > 0) {
        await pool.query(
          'SELECT sp_assign_volunteer($1, $2, $3)',
          [newRequest.request_id, vols[0].volunteer_id, adminUserId]
        );
        autoAlloc = {
          type: 'volunteer',
          volunteer_id: vols[0].volunteer_id,
          volunteer_name: vols[0].full_name,
          volunteer_phone: vols[0].phone
        };
      }
    }

    // 2. EVACUATION -> also auto-assign beds in open shelter
    if (['EVACUATION'].includes(request_type)) {
      const bedsNeeded = parseInt(household_size) || 1;
      const { rows: openShelters } = await pool.query(`
        SELECT shelter_id, name, district, (total_capacity - current_occupancy) AS available_beds
        FROM shelters
        WHERE status = 'OPEN' AND (total_capacity - current_occupancy) >= $1
        ORDER BY CASE WHEN district = $2 THEN 0 ELSE 1 END, (total_capacity - current_occupancy) DESC
        LIMIT 1
      `, [bedsNeeded, district]);

      if (openShelters.length > 0) {
        try {
          await pool.query(
            'SELECT sp_allocate_shelter_bed($1, $2, $3, $4)',
            [newRequest.request_id, openShelters[0].shelter_id, bedsNeeded, adminUserId]
          );
          autoAlloc = {
            ...(autoAlloc || {}),
            type: autoAlloc ? 'multi' : 'bed',
            shelter_id: openShelters[0].shelter_id,
            shelter_name: openShelters[0].name,
            beds_allocated: bedsNeeded
          };
        } catch (_) {}
      }
    }

    // 3. FOOD / WATER -> auto-allocate from shelter inventory
    if (['FOOD', 'WATER'].includes(request_type)) {
      const category = request_type === 'FOOD' ? 'FOOD' : 'WATER';
      const { rows: inv } = await pool.query(`
        SELECT ri.inventory_id, ri.quantity_available, rt.name AS resource_name, s.name AS shelter_name
        FROM resource_inventory ri
        JOIN resource_types rt ON ri.resource_type_id = rt.resource_type_id
        JOIN shelters s ON ri.shelter_id = s.shelter_id
        WHERE rt.category = $1 AND ri.quantity_available > 0 AND s.status = 'OPEN'
        ORDER BY CASE WHEN s.district = $2 THEN 0 ELSE 1 END, ri.quantity_available DESC
        LIMIT 1
      `, [category, district]);

      if (inv.length > 0) {
        const qty = Math.min((parseInt(household_size) || 1) * 2, inv[0].quantity_available);
        await pool.query(
          'SELECT sp_allocate_resource($1, $2, $3, $4)',
          [newRequest.request_id, inv[0].inventory_id, qty, adminUserId]
        );
        autoAlloc = {
          type: 'resource',
          inventory_id: inv[0].inventory_id,
          resource_name: inv[0].resource_name,
          shelter_name: inv[0].shelter_name,
          quantity: qty
        };
      }
    }
  } catch (allocErr) {
    console.warn('[Auto-Alloc Exception]:', allocErr.message);
  }

  // Fetch updated request details including joined allocation
  const { rows: finalRows } = await pool.query(`
    SELECT hr.*,
      a.allocation_id, a.status AS alloc_status, a.beds_allocated,
      s.name AS shelter_name, s.district AS shelter_district,
      v.full_name AS volunteer_name, v.skill AS volunteer_skill, v.phone AS volunteer_phone
    FROM help_requests hr
    LEFT JOIN allocations a ON a.request_id = hr.request_id AND a.status = 'ACTIVE'
    LEFT JOIN shelters s ON a.shelter_id = s.shelter_id
    LEFT JOIN volunteers v ON a.volunteer_id = v.volunteer_id
    WHERE hr.request_id = $1
  `, [newRequest.request_id]);

  res.status(201).json({
    request: finalRows[0] || newRequest,
    auto_allocated: autoAlloc !== null,
    allocation: autoAlloc
  });
}));

// GET /api/requests/:id
router.get('/:id', authenticate, asyncHandler(async (req, res) => {
  const { rows } = await pool.query(`
    SELECT hr.*, r.full_name AS requester_name,
      a.allocation_id, a.status AS alloc_status, a.beds_allocated,
      s.name AS shelter_name, v.full_name AS volunteer_name
    FROM help_requests hr
    JOIN requesters r ON hr.requester_id = r.requester_id
    LEFT JOIN allocations a ON a.request_id = hr.request_id AND a.status = 'ACTIVE'
    LEFT JOIN shelters s ON a.shelter_id = s.shelter_id
    LEFT JOIN volunteers v ON a.volunteer_id = v.volunteer_id
    WHERE hr.request_id = $1
  `, [req.params.id]);
  if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
  res.json(rows[0]);
}));

// PATCH /api/requests/:id/cancel (Admin/Manager)
router.patch('/:id/cancel', authenticate, authorize(['ADMIN', 'AGENCY_MANAGER']), asyncHandler(async (req, res) => {
  await pool.query("UPDATE help_requests SET status = 'CANCELLED' WHERE request_id = $1", [req.params.id]);
  res.json({ status: 'CANCELLED' });
}));

module.exports = router;
