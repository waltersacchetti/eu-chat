const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../../config/database');
const crypto = require('crypto');
const emailService = require('../services/emailService');

const router = express.Router();

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'tu_jwt_secret_super_seguro_2024';

// Generar token de verificación
function generateVerificationToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Generar token de recuperación de contraseña
function generateResetToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Ruta de registro con verificación de email
router.post('/register', async (req, res) => {
  const { email, username, password, firstName, lastName } = req.body;

  try {
    // Validaciones
    if (!email || !username || !password || !firstName || !lastName) {
      return res.status(400).json({
        success: false,
        message: 'Todos los campos son requeridos'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'La contraseña debe tener al menos 6 caracteres'
      });
    }

    if (username.length < 3) {
      return res.status(400).json({
        success: false,
        message: 'El nombre de usuario debe tener al menos 3 caracteres'
      });
    }

    // Verificar si el usuario ya existe
    const userExists = await query(
      'SELECT id FROM eu_chat_users WHERE email = $1 OR username = $2',
      [email, username]
    );

    if (userExists.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Ya existe un usuario con este email o username'
      });
    }

    // Hash de la contraseña
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Generar token de verificación
    const verificationToken = generateVerificationToken();
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas

    // Insertar usuario
    const result = await query(
      `INSERT INTO eu_chat_users (email, username, password_hash, first_name, last_name, verification_token, verification_expires, email_verified, created_at, updated_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()) 
       RETURNING id, email, username, first_name, last_name`,
      [email, username, hashedPassword, firstName, lastName, verificationToken, verificationExpires, false]
    );

    const user = result.rows[0];

    // Enviar email de verificación
    try {
      await emailService.sendVerificationEmail(email, username, verificationToken);
    } catch (emailError) {
      console.error('Error enviando email de verificación:', emailError);
      // No fallar el registro si el email falla
    }

    res.status(201).json({
      success: true,
      message: 'Usuario registrado exitosamente. Por favor verifica tu email.',
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name
      }
    });

  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// Ruta de verificación de email
router.get('/verify', async (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.status(400).json({
      success: false,
      message: 'Token de verificación requerido'
    });
  }

  try {
    // Buscar usuario con el token
    const result = await query(
      'SELECT id, email, username, first_name, verification_expires FROM eu_chat_users WHERE verification_token = $1',
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Token de verificación inválido'
      });
    }

    const user = result.rows[0];

    // Verificar si el token ha expirado
    if (new Date() > user.verification_expires) {
      return res.status(400).json({
        success: false,
        message: 'Token de verificación expirado'
      });
    }

    // Marcar email como verificado
    await query(
      'UPDATE eu_chat_users SET email_verified = TRUE, verification_token = NULL, verification_expires = NULL, updated_at = NOW() WHERE id = $1',
      [user.id]
    );

    // Enviar email de bienvenida
    try {
      await emailService.sendWelcomeEmail(user.email, user.username, user.first_name);
    } catch (emailError) {
      console.error('Error enviando email de bienvenida:', emailError);
    }

    res.json({
      success: true,
      message: 'Email verificado exitosamente. Ya puedes iniciar sesión.',
      user: {
        id: user.id,
        email: user.email,
        username: user.username
      }
    });

  } catch (error) {
    console.error('Error en verificación:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// Ruta de login (solo usuarios verificados)
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // Validaciones
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email y contraseña son requeridos'
      });
    }

    // Buscar usuario
    const result = await query(
      'SELECT id, email, username, password_hash, first_name, last_name, email_verified FROM eu_chat_users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Email o password incorrectos'
      });
    }

    const user = result.rows[0];

    // Verificar si el email está verificado
    if (!user.email_verified) {
      return res.status(401).json({
        success: false,
        message: 'Por favor verifica tu email antes de iniciar sesión'
      });
    }

    // Verificar contraseña
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Email o password incorrectos'
      });
    }

    // Generar JWT
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        username: user.username 
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Login exitoso',
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name
      }
    });

  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// Ruta para reenviar email de verificación
router.post('/resend-verification', async (req, res) => {
  const { email } = req.body;

  try {
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email requerido'
      });
    }

    // Buscar usuario
    const result = await query(
      'SELECT id, username, email_verified FROM eu_chat_users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    const user = result.rows[0];

    if (user.email_verified) {
      return res.status(400).json({
        success: false,
        message: 'El email ya está verificado'
      });
    }

    // Generar nuevo token de verificación
    const verificationToken = generateVerificationToken();
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas

    // Actualizar token
    await query(
      'UPDATE eu_chat_users SET verification_token = $1, verification_expires = $2, updated_at = NOW() WHERE id = $3',
      [verificationToken, verificationExpires, user.id]
    );

    // Enviar nuevo email de verificación
    try {
      await emailService.sendVerificationEmail(email, user.username, verificationToken);
    } catch (emailError) {
      console.error('Error enviando email de verificación:', emailError);
      return res.status(500).json({
        success: false,
        message: 'Error enviando email de verificación'
      });
    }

    res.json({
      success: true,
      message: 'Email de verificación reenviado exitosamente'
    });

  } catch (error) {
    console.error('Error reenviando verificación:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// Ruta para solicitar recuperación de contraseña
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;

  try {
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email requerido'
      });
    }

    // Buscar usuario
    const result = await query(
      'SELECT id, username FROM eu_chat_users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      // Por seguridad, no revelar si el email existe o no
      return res.json({
        success: true,
        message: 'Si el email existe, recibirás un enlace de recuperación'
      });
    }

    const user = result.rows[0];

    // Generar token de recuperación
    const resetToken = generateResetToken();
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    // Actualizar token
    await query(
      'UPDATE eu_chat_users SET reset_token = $1, reset_expires = $2, updated_at = NOW() WHERE id = $3',
      [resetToken, resetExpires, user.id]
    );

    // Enviar email de recuperación
    try {
      await emailService.sendPasswordResetEmail(email, user.username, resetToken);
    } catch (emailError) {
      console.error('Error enviando email de recuperación:', emailError);
      return res.status(500).json({
        success: false,
        message: 'Error enviando email de recuperación'
      });
    }

    res.json({
      success: true,
      message: 'Si el email existe, recibirás un enlace de recuperación'
    });

  } catch (error) {
    console.error('Error en recuperación de contraseña:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// Ruta para resetear contraseña
router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;

  try {
    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Token y nueva contraseña son requeridos'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'La contraseña debe tener al menos 6 caracteres'
      });
    }

    // Buscar usuario con el token
    const result = await query(
      'SELECT id, reset_expires FROM eu_chat_users WHERE reset_token = $1',
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Token de recuperación inválido'
      });
    }

    const user = result.rows[0];

    // Verificar si el token ha expirado
    if (new Date() > user.reset_expires) {
      return res.status(400).json({
        success: false,
        message: 'Token de recuperación expirado'
      });
    }

    // Hash de la nueva contraseña
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Actualizar contraseña y limpiar token
    await query(
      'UPDATE eu_chat_users SET password_hash = $1, reset_token = NULL, reset_expires = NULL, updated_at = NOW() WHERE id = $1',
      [hashedPassword, user.id]
    );

    res.json({
      success: true,
      message: 'Contraseña actualizada exitosamente'
    });

  } catch (error) {
    console.error('Error reseteando contraseña:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

module.exports = router;
