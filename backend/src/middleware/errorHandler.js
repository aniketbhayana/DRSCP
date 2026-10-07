
const mapPgError = (err) => {
  if (err.code === 'P0001') return { status: 409, message: err.message || 'Conflict' };
  if (err.code === '23505') return { status: 409, message: 'Unique violation' };
  if (err.code === '23503') return { status: 400, message: 'FK violation' };
  if (err.code === '42501') return { status: 403, message: 'Insufficient privilege' };
  return { status: 500, message: 'Internal Server Error' };
};

const errorHandler = (err, req, res, next) => {
  console.error(err);
  const errorMap = mapPgError(err);
  res.status(errorMap.status).json({ error: errorMap.message, code: err.code });
};

module.exports = { errorHandler, mapPgError };
