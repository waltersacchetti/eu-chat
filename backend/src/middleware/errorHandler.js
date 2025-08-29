// Middleware centralizado para manejo de errores
const errorHandler = (err, req, res, next) => {
  console.error('❌ Error no manejado:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString()
  });

  // Errores de validación
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Error de validación',
      message: err.message,
      details: err.details || []
    });
  }

  // Errores de JWT
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Token inválido',
      message: 'El token de autenticación no es válido'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Token expirado',
      message: 'El token de autenticación ha expirado'
    });
  }

  // Errores de base de datos
  if (err.code === '23505') { // Unique violation
    return res.status(409).json({
      error: 'Conflicto de datos',
      message: 'Ya existe un registro con estos datos'
    });
  }

  if (err.code === '23503') { // Foreign key violation
    return res.status(400).json({
      error: 'Referencia inválida',
      message: 'Los datos referenciados no existen'
    });
  }

  if (err.code === '42P01') { // Undefined table
    return res.status(500).json({
      error: 'Error de base de datos',
      message: 'Tabla no encontrada'
    });
  }

  // Errores de rate limiting
  if (err.status === 429) {
    return res.status(429).json({
      error: 'Demasiadas requests',
      message: 'Has excedido el límite de requests permitidos'
    });
  }

  // Errores de archivo no encontrado
  if (err.code === 'ENOENT') {
    return res.status(404).json({
      error: 'Archivo no encontrado',
      message: 'El recurso solicitado no existe'
    });
  }

  // Errores de permisos
  if (err.code === 'EACCES') {
    return res.status(403).json({
      error: 'Permisos insuficientes',
      message: 'No tienes permisos para acceder a este recurso'
    });
  }

  // Errores de timeout
  if (err.code === 'ETIMEDOUT') {
    return res.status(504).json({
      error: 'Timeout',
      message: 'La operación tardó demasiado en completarse'
    });
  }

  // Errores de conexión
  if (err.code === 'ECONNREFUSED') {
    return res.status(503).json({
      error: 'Servicio no disponible',
      message: 'No se puede conectar con el servicio requerido'
    });
  }

  // Errores de WhatsApp API
  if (err.response && err.response.status === 401) {
    return res.status(401).json({
      error: 'Error de autenticación WhatsApp',
      message: 'Token de WhatsApp inválido o expirado'
    });
  }

  if (err.response && err.response.status === 403) {
    return res.status(403).json({
      error: 'Error de permisos WhatsApp',
      message: 'No tienes permisos para realizar esta acción'
    });
  }

  if (err.response && err.response.status === 429) {
    return res.status(429).json({
      error: 'Rate limit WhatsApp',
      message: 'Has excedido el límite de requests de WhatsApp API'
    });
  }

  // Error por defecto
  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Error interno del servidor';

  res.status(statusCode).json({
    error: 'Error interno del servidor',
    message: process.env.NODE_ENV === 'production' ? 'Algo salió mal' : message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

module.exports = errorHandler;
