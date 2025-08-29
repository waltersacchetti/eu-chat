const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../../config/database');
const router = express.Router();

// Registro de usuario
router.post('/register', async (req, res) => {
  try {
    const { email, username, password, firstName, lastName, phoneNumber } = req.body;

    // Validaciones básicas
    if (!email || !username || !password) {
      return res.status(400).json({
        error: 'Datos requeridos',
        message: 'Email, username y password son obligatorios'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: 'Password inválido',
        message: 'El password debe tener al menos 6 caracteres'
      });
    }

    // Verificar si el usuario ya existe
    const existingUser = await query(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [email, username]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        error: 'Usuario ya existe',
        message: 'Ya existe un usuario con este email o username'
      });
    }

    // Hash del password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Crear usuario
    const newUser = await query(
      `INSERT INTO users (email, username, password_hash, first_name, last_name, phone_number, is_verified)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       RETURNING id, email, username, first_name, last_name, created_at`,
      [email, username, passwordHash, firstName || null, lastName || null, phoneNumber || null]
    );

    const user = newUser.rows[0];

    // Generar tokens
    const accessToken = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    const refreshToken = jwt.sign(
      { userId: user.id, tokenVersion: Date.now() },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
    );

    // Guardar refresh token en la base de datos
    await query(
      'UPDATE users SET refresh_token = $1 WHERE id = $2',
      [refreshToken, user.id]
    );

    console.log(`✅ Usuario registrado exitosamente: ${user.email}`);

    res.status(201).json({
      message: 'Usuario registrado exitosamente',
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
        createdAt: user.created_at
      },
      tokens: {
        accessToken,
        refreshToken
      }
    });

  } catch (error) {
    console.error('❌ Error en registro:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error creando el usuario'
    });
  }
});

// Login de usuario
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Datos requeridos',
        message: 'Email y password son obligatorios'
      });
    }

    // Buscar usuario
    const userResult = await query(
      'SELECT id, email, username, password_hash, first_name, last_name, is_active, is_verified FROM users WHERE email = $1',
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        error: 'Credenciales inválidas',
        message: 'Email o password incorrectos'
      });
    }

    const user = userResult.rows[0];

    if (!user.is_active) {
      return res.status(403).json({
        error: 'Cuenta desactivada',
        message: 'Tu cuenta ha sido desactivada'
      });
    }

    if (!user.is_verified) {
      return res.status(403).json({
        error: 'Cuenta no verificada',
        message: 'Debes verificar tu cuenta antes de iniciar sesión'
      });
    }

    // Verificar password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Credenciales inválidas',
        message: 'Email o password incorrectos'
      });
    }

    // Generar tokens
    const accessToken = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    const refreshToken = jwt.sign(
      { userId: user.id, tokenVersion: Date.now() },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
    );

    // Actualizar refresh token y último login
    await query(
      'UPDATE users SET refresh_token = $1, last_login = NOW() WHERE id = $2',
      [refreshToken, user.id]
    );

    console.log(`✅ Usuario autenticado exitosamente: ${user.email}`);

    res.json({
      message: 'Login exitoso',
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name
      },
      tokens: {
        accessToken,
        refreshToken
      }
    });

  } catch (error) {
    console.error('❌ Error en login:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error durante el login'
    });
  }
});

// Refresh token
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        error: 'Token requerido',
        message: 'Refresh token es obligatorio'
      });
    }

    // Verificar refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    // Verificar que el token existe en la base de datos
    const userResult = await query(
      'SELECT id, email, username, first_name, last_name, refresh_token FROM users WHERE id = $1 AND is_active = true',
      [decoded.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        error: 'Token inválido',
        message: 'Usuario no encontrado o inactivo'
      });
    }

    const user = userResult.rows[0];

    if (user.refresh_token !== refreshToken) {
      return res.status(401).json({
        error: 'Token inválido',
        message: 'Refresh token no válido'
      });
    }

    // Generar nuevo access token
    const newAccessToken = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    res.json({
      message: 'Token refrescado exitosamente',
      accessToken: newAccessToken
    });

  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Token inválido',
        message: 'Refresh token no válido'
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expirado',
        message: 'Refresh token ha expirado'
      });
    }

    console.error('❌ Error refrescando token:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error refrescando el token'
    });
  }
});

// Logout
router.post('/logout', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      // Invalidar refresh token en la base de datos
      await query(
        'UPDATE users SET refresh_token = NULL WHERE refresh_token = $1',
        [refreshToken]
      );
    }

    res.json({
      message: 'Logout exitoso'
    });

  } catch (error) {
    console.error('❌ Error en logout:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error durante el logout'
    });
  }
});

// Verificar token
router.get('/verify', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        error: 'Token requerido',
        message: 'Token de acceso es obligatorio'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const userResult = await query(
      'SELECT id, email, username, first_name, last_name, is_active, is_verified FROM users WHERE id = $1 AND is_active = true',
      [decoded.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        error: 'Token inválido',
        message: 'Usuario no encontrado o inactivo'
      });
    }

    const user = userResult.rows[0];

    res.json({
      message: 'Token válido',
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
        isVerified: user.is_verified
      }
    });

  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Token inválido',
        message: 'Token no válido'
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expirado',
        message: 'Token ha expirado'
      });
    }

    console.error('❌ Error verificando token:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error verificando el token'
    });
  }
});

module.exports = router;
