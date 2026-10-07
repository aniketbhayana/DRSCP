
const express = require('express');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');
const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';

router.post('/login', asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  const { rows } = await pool.query('SELECT * FROM app_users WHERE username = $1', [username]);
  if (rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
  const user = rows[0];
  if (user.password_hash !== password) return res.status(401).json({ error: 'Invalid credentials' });
  
  const token = jwt.sign({ user_id: user.user_id, username: user.username, role: user.role_name }, JWT_SECRET, { expiresIn: '24h' });
  res.json({ token, user: { user_id: user.user_id, username: user.username, role: user.role_name } });
}));

module.exports = router;
