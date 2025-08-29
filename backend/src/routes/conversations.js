const express = require('express');
const { query } = require('../../config/database');
const router = express.Router();

// Obtener lista de conversaciones del usuario
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const { platform, unread, archived, limit = 50, offset = 0 } = req.query;

    // Construir query base
    let baseQuery = `
      SELECT 
        c.id, c.title, c.last_message_text, c.last_message_at, c.unread_count,
        c.is_archived, c.is_pinned, c.created_at, c.updated_at,
        p.name as platform_name, p.display_name as platform_display_name,
        p.icon_url as platform_icon, p.color_hex as platform_color,
        co.display_name as contact_name, co.avatar_url as contact_avatar,
        co.platform_contact_id
      FROM conversations c
      JOIN platforms p ON c.platform_id = p.id
      LEFT JOIN contacts co ON c.contact_id = co.id
      WHERE c.user_id = $1
    `;

    let queryParams = [userId];
    let paramCount = 1;

    // Filtros
    if (platform) {
      paramCount++;
      baseQuery += ` AND p.name = $${paramCount}`;
      queryParams.push(platform);
    }

    if (unread !== undefined) {
      paramCount++;
      if (unread === 'true') {
        baseQuery += ` AND c.unread_count > 0`;
      } else {
        baseQuery += ` AND c.unread_count = 0`;
      }
    }

    if (archived !== undefined) {
      paramCount++;
      baseQuery += ` AND c.is_archived = $${paramCount}`;
      queryParams.push(archived === 'true');
    }

    // Ordenamiento y paginación
    baseQuery += ` ORDER BY c.is_pinned DESC, c.last_message_at DESC NULLS LAST, c.created_at DESC`;
    baseQuery += ` LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    queryParams.push(parseInt(limit), parseInt(offset));

    const conversationsResult = await query(baseQuery, queryParams);

    // Contar total de conversaciones (sin paginación)
    let countQuery = `
      SELECT COUNT(*) as total
      FROM conversations c
      JOIN platforms p ON c.platform_id = p.id
      WHERE c.user_id = $1
    `;

    let countParams = [userId];
    paramCount = 1;

    if (platform) {
      paramCount++;
      countQuery += ` AND p.name = $${paramCount}`;
      countParams.push(platform);
    }

    if (unread !== undefined) {
      if (unread === 'true') {
        countQuery += ` AND c.unread_count > 0`;
      } else {
        countQuery += ` AND c.unread_count = 0`;
      }
    }

    if (archived !== undefined) {
      paramCount++;
      countQuery += ` AND c.is_archived = $${paramCount}`;
      countParams.push(archived === 'true');
    }

    const countResult = await query(countQuery, countParams);
    const totalConversations = parseInt(countResult.rows[0].total);

    const conversations = conversationsResult.rows.map(row => ({
      id: row.id,
      title: row.title,
      lastMessageText: row.last_message_text,
      lastMessageAt: row.last_message_at,
      unreadCount: parseInt(row.unread_count) || 0,
      isArchived: row.is_archived,
      isPinned: row.is_pinned,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      platform: {
        name: row.platform_name,
        displayName: row.platform_display_name,
        iconUrl: row.platform_icon,
        colorHex: row.platform_color
      },
      contact: row.contact_name ? {
        name: row.contact_name,
        avatarUrl: row.contact_avatar,
        platformContactId: row.platform_contact_id
      } : null
    }));

    res.json({
      message: 'Conversaciones obtenidas exitosamente',
      conversations,
      pagination: {
        total: totalConversations,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: (parseInt(offset) + parseInt(limit)) < totalConversations
      }
    });

  } catch (error) {
    console.error('❌ Error obteniendo conversaciones:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error obteniendo la lista de conversaciones'
    });
  }
});

// Obtener conversación específica
router.get('/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const conversationId = req.params.id;

    const conversationResult = await query(
      `SELECT 
        c.id, c.title, c.last_message_text, c.last_message_at, c.unread_count,
        c.is_archived, c.is_pinned, c.created_at, c.updated_at,
        p.name as platform_name, p.display_name as platform_display_name,
        p.icon_url as platform_icon, p.color_hex as platform_color,
        co.id as contact_id, co.display_name as contact_name, 
        co.avatar_url as contact_avatar, co.platform_contact_id
       FROM conversations c
       JOIN platforms p ON c.platform_id = p.id
       LEFT JOIN contacts co ON c.contact_id = co.id
       WHERE c.id = $1 AND c.user_id = $2`,
      [conversationId, userId]
    );

    if (conversationResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Conversación no encontrada',
        message: 'La conversación solicitada no existe'
      });
    }

    const conversation = conversationResult.rows[0];

    // Marcar mensajes como leídos
    if (conversation.unread_count > 0) {
      await query(
        'UPDATE conversations SET unread_count = 0, updated_at = NOW() WHERE id = $1',
        [conversationId]
      );
      console.log(`📖 Mensajes marcados como leídos en conversación: ${conversation.title}`);
    }

    res.json({
      message: 'Conversación obtenida exitosamente',
      conversation: {
        id: conversation.id,
        title: conversation.title,
        lastMessageText: conversation.last_message_text,
        lastMessageAt: conversation.last_message_at,
        unreadCount: 0, // Ya se marcaron como leídos
        isArchived: conversation.is_archived,
        isPinned: conversation.is_pinned,
        createdAt: conversation.created_at,
        updatedAt: conversation.updated_at,
        platform: {
          name: conversation.platform_name,
          displayName: conversation.platform_display_name,
          iconUrl: conversation.platform_icon,
          colorHex: conversation.platform_color
        },
        contact: conversation.contact_name ? {
          id: conversation.contact_id,
          name: conversation.contact_name,
          avatarUrl: conversation.contact_avatar,
          platformContactId: conversation.platform_contact_id
        } : null
      }
    });

  } catch (error) {
    console.error('❌ Error obteniendo conversación:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error obteniendo la conversación'
    });
  }
});

// Crear nueva conversación
router.post('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const { platformId, contactId, title, initialMessage } = req.body;

    if (!platformId || !title) {
      return res.status(400).json({
        error: 'Datos requeridos',
        message: 'platformId y title son obligatorios'
      });
    }

    // Verificar que la plataforma existe y está activa
    const platformResult = await query(
      'SELECT id, name FROM platforms WHERE id = $1 AND is_active = true',
      [platformId]
    );

    if (platformResult.rows.length === 0) {
      return res.status(400).json({
        error: 'Plataforma inválida',
        message: 'La plataforma especificada no existe o no está activa'
      });
    }

    // Verificar que el contacto existe y pertenece al usuario (si se proporciona)
    if (contactId) {
      const contactResult = await query(
        'SELECT id FROM contacts WHERE id = $1 AND user_id = $2',
        [contactId, userId]
      );

      if (contactResult.rows.length === 0) {
        return res.status(400).json({
          error: 'Contacto inválido',
          message: 'El contacto especificado no existe o no pertenece al usuario'
        });
      }
    }

    // Crear conversación
    const newConversation = await query(
      `INSERT INTO conversations (
        user_id, platform_id, contact_id, title, last_message_text, last_message_at
      ) VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING id, title, last_message_text, last_message_at, created_at`,
      [userId, platformId, contactId || null, title, initialMessage || null]
    );

    const conversation = newConversation.rows[0];

    console.log(`✅ Conversación creada exitosamente: ${conversation.title}`);

    res.status(201).json({
      message: 'Conversación creada exitosamente',
      conversation: {
        id: conversation.id,
        title: conversation.title,
        lastMessageText: conversation.last_message_text,
        lastMessageAt: conversation.last_message_at,
        unreadCount: 0,
        isArchived: false,
        isPinned: false,
        createdAt: conversation.created_at
      }
    });

  } catch (error) {
    console.error('❌ Error creando conversación:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error creando la conversación'
    });
  }
});

// Actualizar conversación
router.put('/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const conversationId = req.params.id;
    const { title, isArchived, isPinned } = req.body;

    // Verificar que la conversación existe y pertenece al usuario
    const existingConversation = await query(
      'SELECT id, title FROM conversations WHERE id = $1 AND user_id = $2',
      [conversationId, userId]
    );

    if (existingConversation.rows.length === 0) {
      return res.status(404).json({
        error: 'Conversación no encontrada',
        message: 'La conversación solicitada no existe'
      });
    }

    // Construir query de actualización
    let updateFields = [];
    let values = [];
    let paramCount = 1;

    if (title !== undefined) {
      updateFields.push(`title = $${paramCount}`);
      values.push(title);
      paramCount++;
    }

    if (isArchived !== undefined) {
      updateFields.push(`is_archived = $${paramCount}`);
      values.push(isArchived);
      paramCount++;
    }

    if (isPinned !== undefined) {
      updateFields.push(`is_pinned = $${paramCount}`);
      values.push(isPinned);
      paramCount++;
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        error: 'Datos requeridos',
        message: 'Debes proporcionar al menos un campo para actualizar'
      });
    }

    // Agregar updated_at y conversation_id
    updateFields.push(`updated_at = NOW()`);
    values.push(conversationId);

    const updateQuery = `
      UPDATE conversations 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, title, is_archived, is_pinned, updated_at
    `;

    const result = await query(updateQuery, values);

    const updatedConversation = result.rows[0];

    console.log(`✅ Conversación actualizada exitosamente: ${updatedConversation.title}`);

    res.json({
      message: 'Conversación actualizada exitosamente',
      conversation: {
        id: updatedConversation.id,
        title: updatedConversation.title,
        isArchived: updatedConversation.is_archived,
        isPinned: updatedConversation.is_pinned,
        updatedAt: updatedConversation.updated_at
      }
    });

  } catch (error) {
    console.error('❌ Error actualizando conversación:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error actualizando la conversación'
    });
  }
});

// Archivar/desarchivar conversación
router.put('/:id/archive', async (req, res) => {
  try {
    const userId = req.user.id;
    const conversationId = req.params.id;
    const { isArchived } = req.body;

    if (typeof isArchived !== 'boolean') {
      return res.status(400).json({
        error: 'Dato inválido',
        message: 'isArchived debe ser un valor booleano'
      });
    }

    // Verificar que la conversación existe y pertenece al usuario
    const existingConversation = await query(
      'SELECT id, title FROM conversations WHERE id = $1 AND user_id = $2',
      [conversationId, userId]
    );

    if (existingConversation.rows.length === 0) {
      return res.status(404).json({
        error: 'Conversación no encontrada',
        message: 'La conversación solicitada no existe'
      });
    }

    // Actualizar estado de archivado
    await query(
      'UPDATE conversations SET is_archived = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3',
      [isArchived, conversationId, userId]
    );

    const action = isArchived ? 'archivada' : 'desarchivada';
    console.log(`📁 Conversación ${action}: ${existingConversation.rows[0].title}`);

    res.json({
      message: `Conversación ${action} exitosamente`,
      isArchived
    });

  } catch (error) {
    console.error('❌ Error archivando conversación:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error archivando la conversación'
    });
  }
});

// Pin/unpin conversación
router.put('/:id/pin', async (req, res) => {
  try {
    const userId = req.user.id;
    const conversationId = req.params.id;
    const { isPinned } = req.body;

    if (typeof isPinned !== 'boolean') {
      return res.status(400).json({
        error: 'Dato inválido',
        message: 'isPinned debe ser un valor booleano'
      });
    }

    // Verificar que la conversación existe y pertenece al usuario
    const existingConversation = await query(
      'SELECT id, title FROM conversations WHERE id = $1 AND user_id = $2',
      [conversationId, userId]
    );

    if (existingConversation.rows.length === 0) {
      return res.status(404).json({
        error: 'Conversación no encontrada',
        message: 'La conversación solicitada no existe'
      });
    }

    // Actualizar estado de pin
    await query(
      'UPDATE conversations SET is_pinned = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3',
      [isPinned, conversationId, userId]
    );

    const action = isPinned ? 'pinned' : 'unpinned';
    console.log(`📌 Conversación ${action}: ${existingConversation.rows[0].title}`);

    res.json({
      message: `Conversación ${action} exitosamente`,
      isPinned
    });

  } catch (error) {
    console.error('❌ Error pinning conversación:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error pinning la conversación'
    });
  }
});

// Eliminar conversación
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const conversationId = req.params.id;

    // Verificar que la conversación existe y pertenece al usuario
    const existingConversation = await query(
      'SELECT id, title FROM conversations WHERE id = $1 AND user_id = $2',
      [conversationId, userId]
    );

    if (existingConversation.rows.length === 0) {
      return res.status(404).json({
        error: 'Conversación no encontrada',
        message: 'La conversación solicitada no existe'
      });
    }

    // Eliminar conversación (esto también eliminará los mensajes asociados por CASCADE)
    await query(
      'DELETE FROM conversations WHERE id = $1 AND user_id = $2',
      [conversationId, userId]
    );

    console.log(`🗑️ Conversación eliminada exitosamente: ${existingConversation.rows[0].title}`);

    res.json({
      message: 'Conversación eliminada exitosamente'
    });

  } catch (error) {
    console.error('❌ Error eliminando conversación:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error eliminando la conversación'
    });
  }
});

module.exports = router;
