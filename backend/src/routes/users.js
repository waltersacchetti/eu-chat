const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../../config/database');
const router = express.Router();

// Obtener perfil del usuario autenticado
router.get('/profile', async (req, res) => {
  try {
    const userId = req.user.id;

    const userResult = await query(
      `SELECT id, email, username, first_name, last_name, 
              avatar_url, is_active, is_verified, last_login, created_at
       FROM eu_chat_users WHERE id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Usuario no encontrado',
        message: 'El usuario solicitado no existe'
      });
    }

    const user = userResult.rows[0];

    res.json({
      message: 'Perfil obtenido exitosamente',
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
        phoneNumber: user.phone_number,
        avatarUrl: user.avatar_url,
        isActive: user.is_active,
        isVerified: user.is_verified,
        lastLogin: user.last_login,
        createdAt: user.created_at
      }
    });

  } catch (error) {
    console.error('❌ Error obteniendo perfil:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error obteniendo el perfil del usuario'
    });
  }
});

// Actualizar perfil del usuario
router.put('/profile', async (req, res) => {
  try {
    const userId = req.user.id;
    const { firstName, lastName, phoneNumber, avatarUrl } = req.body;

    // Validar que al menos un campo se esté actualizando
    if (!firstName && !lastName && !phoneNumber && !avatarUrl) {
      return res.status(400).json({
        error: 'Datos requeridos',
        message: 'Debes proporcionar al menos un campo para actualizar'
      });
    }

    // Construir query dinámicamente
    let updateFields = [];
    let values = [];
    let paramCount = 1;

    if (firstName !== undefined) {
      updateFields.push(`first_name = $${paramCount}`);
      values.push(firstName);
      paramCount++;
    }

    if (lastName !== undefined) {
      updateFields.push(`last_name = $${paramCount}`);
      values.push(lastName);
      paramCount++;
    }

    if (phoneNumber !== undefined) {
      updateFields.push(`phone_number = $${paramCount}`);
      values.push(phoneNumber);
      paramCount++;
    }

    if (avatarUrl !== undefined) {
      updateFields.push(`avatar_url = $${paramCount}`);
      values.push(avatarUrl);
      paramCount++;
    }

    // Agregar updated_at y user_id
    updateFields.push(`updated_at = NOW()`);
    values.push(userId);

    const updateQuery = `
      UPDATE users 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, email, username, first_name, last_name, phone_number, avatar_url, updated_at
    `;

    const result = await query(updateQuery, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Usuario no encontrado',
        message: 'El usuario solicitado no existe'
      });
    }

    const updatedUser = result.rows[0];

    console.log(`✅ Perfil actualizado exitosamente para usuario: ${updatedUser.email}`);

    res.json({
      message: 'Perfil actualizado exitosamente',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        username: updatedUser.username,
        firstName: updatedUser.first_name,
        lastName: updatedUser.last_name,
        phoneNumber: updatedUser.phone_number,
        avatarUrl: updatedUser.avatar_url,
        updatedAt: updatedUser.updated_at
      }
    });

  } catch (error) {
    console.error('❌ Error actualizando perfil:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error actualizando el perfil del usuario'
    });
  }
});

// Cambiar contraseña
router.put('/change-password', async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        error: 'Datos requeridos',
        message: 'Contraseña actual y nueva contraseña son obligatorias'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        error: 'Contraseña inválida',
        message: 'La nueva contraseña debe tener al menos 6 caracteres'
      });
    }

    // Obtener contraseña actual
    const currentPasswordResult = await query(
      'SELECT password_hash FROM eu_chat_users WHERE id = $1',
      [userId]
    );

    if (currentPasswordResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Usuario no encontrado',
        message: 'El usuario solicitado no existe'
      });
    }

    // Verificar contraseña actual
    const isValidCurrentPassword = await bcrypt.compare(
      currentPassword, 
      currentPasswordResult.rows[0].password_hash
    );

    if (!isValidCurrentPassword) {
      return res.status(401).json({
        error: 'Contraseña incorrecta',
        message: 'La contraseña actual es incorrecta'
      });
    }

    // Hash de la nueva contraseña
    const saltRounds = 12;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    // Actualizar contraseña
    await query(
      'UPDATE eu_chat_users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [newPasswordHash, userId]
    );

    console.log(`✅ Contraseña cambiada exitosamente para usuario ID: ${userId}`);

    res.json({
      message: 'Contraseña cambiada exitosamente'
    });

  } catch (error) {
    console.error('❌ Error cambiando contraseña:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error cambiando la contraseña'
    });
  }
});

// Desactivar cuenta
router.put('/deactivate', async (req, res) => {
  try {
    const userId = req.user.id;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        error: 'Contraseña requerida',
        message: 'Debes proporcionar tu contraseña para desactivar la cuenta'
      });
    }

    // Verificar contraseña
    const passwordResult = await query(
      'SELECT password_hash FROM eu_chat_users WHERE id = $1',
      [userId]
    );

    if (passwordResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Usuario no encontrado',
        message: 'El usuario solicitado no existe'
      });
    }

    const isValidPassword = await bcrypt.compare(
      password, 
      passwordResult.rows[0].password_hash
    );

    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Contraseña incorrecta',
        message: 'La contraseña proporcionada es incorrecta'
      });
    }

    // Desactivar cuenta
    await query(
      'UPDATE eu_chat_users SET is_active = false, updated_at = NOW() WHERE id = $1',
      [userId]
    );

    console.log(`⚠️ Cuenta desactivada para usuario ID: ${userId}`);

    res.json({
      message: 'Cuenta desactivada exitosamente'
    });

  } catch (error) {
    console.error('❌ Error desactivando cuenta:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error desactivando la cuenta'
    });
  }
});

// Obtener estadísticas del usuario
router.get('/stats', async (req, res) => {
  try {
    const userId = req.user.id;

    // Estadísticas de contactos
    const contactsStats = await query(
      'SELECT COUNT(*) as total_contacts FROM eu_chat_contacts WHERE user_id = $1',
      [userId]
    );

    // Estadísticas de conversaciones
    const conversationsStats = await query(
      `SELECT 
        COUNT(*) as total_conversations,
        COUNT(CASE WHEN unread_count > 0 THEN 1 END) as conversations_with_unread,
        SUM(unread_count) as total_unread_messages
       FROM eu_chat_conversations WHERE user_id = $1`,
      [userId]
    );

    // Estadísticas de mensajes
    const messagesStats = await query(
      `SELECT 
        COUNT(*) as total_messages,
        COUNT(CASE WHEN is_from_user = true THEN 1 END) as sent_messages,
        COUNT(CASE WHEN is_from_user = false THEN 1 END) as received_messages
       FROM eu_chat_messages m
       JOIN eu_chat_conversations c ON m.conversation_id = c.id
       WHERE c.user_id = $1`,
      [userId]
    );

    // Estadísticas de plataformas
    const platformsStats = await query(
      `SELECT 
        p.name as platform_name,
        p.display_name as platform_display_name,
        COUNT(DISTINCT c.id) as conversations_count,
        COUNT(DISTINCT co.id) as contacts_count
       FROM eu_chat_platforms p
       LEFT JOIN eu_chat_conversations c ON p.id = c.platform_id AND c.user_id = $1
       LEFT JOIN eu_chat_contacts co ON p.id = co.platform_id AND co.user_id = $1
       WHERE p.is_active = true
       GROUP BY p.id, p.name, p.display_name
       ORDER BY conversations_count DESC`,
      [userId]
    );

    const stats = {
      contacts: {
        total: parseInt(contactsStats.rows[0].total_contacts) || 0
      },
      conversations: {
        total: parseInt(conversationsStats.rows[0].total_conversations) || 0,
        withUnread: parseInt(conversationsStats.rows[0].conversations_with_unread) || 0,
        totalUnread: parseInt(conversationsStats.rows[0].total_unread_messages) || 0
      },
      messages: {
        total: parseInt(messagesStats.rows[0].total_messages) || 0,
        sent: parseInt(messagesStats.rows[0].sent_messages) || 0,
        received: parseInt(messagesStats.rows[0].received_messages) || 0
      },
      platforms: platformsStats.rows.map(row => ({
        name: row.platform_name,
        displayName: row.platform_display_name,
        conversationsCount: parseInt(row.conversations_count) || 0,
        contactsCount: parseInt(row.contacts_count) || 0
      }))
    };

    res.json({
      message: 'Estadísticas obtenidas exitosamente',
      stats
    });

  } catch (error) {
    console.error('❌ Error obteniendo estadísticas:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error obteniendo las estadísticas del usuario'
    });
  }
});

module.exports = router;
