const jwt = require('jsonwebtoken');
const { query } = require('../../config/database');

// Middleware de autenticación JWT
const authenticateToken = async (req, res, next) => {
  try {
    // Obtener token del header Authorization
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        error: 'Token de acceso requerido',
        message: 'Debes incluir un token de autenticación en el header Authorization'
      });
    }

    // Verificar token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Verificar que el usuario existe y está activo
    const userResult = await query(
      'SELECT id, email, username, first_name, last_name, is_active, is_verified FROM eu_chat_users WHERE id = $1 AND is_active = true',
      [decoded.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        error: 'Token inválido',
        message: 'El usuario asociado al token no existe o no está activo'
      });
    }

    const user = userResult.rows[0];
    
    if (!user.is_verified) {
      return res.status(403).json({
        error: 'Cuenta no verificada',
        message: 'Debes verificar tu cuenta antes de acceder a este recurso'
      });
    }

    // Agregar información del usuario al request
    req.user = {
      id: user.id,
      email: user.email,
      username: user.username,
      firstName: user.first_name,
      lastName: user.last_name
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Token inválido',
        message: 'El token proporcionado no es válido'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expirado',
        message: 'El token ha expirado, debes iniciar sesión nuevamente'
      });
    }

    console.error('❌ Error en middleware de autenticación:', error);
    return res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error procesando la autenticación'
    });
  }
};

// Middleware opcional de autenticación (para rutas que pueden funcionar con o sin usuario)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userResult = await query(
          'SELECT id, email, username, first_name, last_name, is_active, is_verified FROM eu_chat_users WHERE id = $1 AND is_active = true',
          [decoded.userId]
        );

        if (userResult.rows.length > 0) {
          const user = userResult.rows[0];
          req.user = {
            id: user.id,
            email: user.email,
            username: user.username,
            firstName: user.first_name,
            lastName: user.last_name
          };
        }
      } catch (error) {
        // Si hay error con el token, simplemente continuamos sin usuario
        console.log('⚠️ Token inválido en autenticación opcional:', error.message);
      }
    }

    next();
  } catch (error) {
    console.error('❌ Error en autenticación opcional:', error);
    next(); // Continuar sin usuario en caso de error
  }
};

// Middleware para verificar roles (para futuras implementaciones)
const requireRole = (role) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Autenticación requerida',
        message: 'Debes iniciar sesión para acceder a este recurso'
      });
    }

    // Aquí se implementaría la lógica de roles
    // Por ahora, todos los usuarios autenticados tienen acceso
    next();
  };
};

module.exports = {
  authenticateToken,
  optionalAuth,
  requireRole
};
