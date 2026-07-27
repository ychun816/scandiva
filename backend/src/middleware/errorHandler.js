const multer = require('multer');

// Reject non-numeric :id params before they reach Prisma (parseInt(NaN) -> 500).
// Registered per-router via router.param('id', idParam).
const idParam = (req, res, next, raw) => {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    return res.status(404).json({ error: 'Not found' });
  }
  next();
};

// Terminal error handler — turns malformed requests into clean 4xx JSON.
const errorHandler = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  }
  if (err.message && /files are allowed/i.test(err.message)) {
    return res.status(400).json({ error: err.message });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body too large' });
  }
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
};

module.exports = { idParam, errorHandler };
