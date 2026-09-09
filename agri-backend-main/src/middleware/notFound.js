const notFound = (req, res, _next) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.originalUrl} not found`
    },
    timestamp: new Date().toISOString()
  });
};

module.exports = notFound;