export function notFound(req, res) {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
}
export function errorHandler(err, req, res, next) {
  console.error(err);
  if (err.code === 'P2002') return res.status(409).json({ error: 'A record with that value already exists.' });
  if (err.code === 'P2025') return res.status(404).json({ error: 'Record not found.' });
  if (err.name === 'MulterError' || err.message?.startsWith('Only JPG')) return res.status(400).json({ error: err.message });
  res.status(err.status || 500).json({ error: err.status ? err.message : 'Something went wrong on the server.' });
}
