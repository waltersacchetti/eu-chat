const express = require('express');
const { query } = require('../../config/database');
const router = express.Router();

// Obtener mensajes de una conversación
router.get('/conversation/:conversationId', async (req, res) => {
  try {
    const userId = req.user.id;
    const conversationId = req.params.conversationId;
    const { limit = 50, offset = 0, before } = req.query;

    // Verificar que la conversación existe y pertenece al usuario
    const conversationResult = await query(
      'SELECT id, title FROM eu_chat_conversations WHERE id = $1 AND user_id = $2',
      [conversationId, userId]
    );

    if (conversationResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Conversación no encontrada',
        message: 'La conversación solicitada no existe'
      });
    }

    // Construir query base
    let baseQuery = `
      SELECT 
        m.id, m.content, m.encrypted_content, m.is_from_user, m.is_read,
        m.message_type, m.metadata, m.created_at, m.updated_at,
        p.name as platform_name, p.display_name as platform_display_name,
        p.icon_url as platform_icon, p.color_hex as platform_color
       FROM eu_chat_messages m
       JOIN eu_chat_conversations c ON m.conversation_id = c.id
       JOIN eu_chat_platforms p ON c.platform_id = p.id
       WHERE m.conversation_id = $1
    `;

    let queryParams = [conversationId];
    let paramCount = 1;

    // Filtro de fecha (mensajes antes de una fecha específica)
    if (before) {
      paramCount++;
      baseQuery += ` AND m.created_at < $${paramCount}`;
      queryParams.push(new Date(before));
    }

    // Ordenamiento y paginación (mensajes más recientes primero)
    baseQuery += ` ORDER BY m.created_at DESC`;
    baseQuery += ` LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    queryParams.push(parseInt(limit), parseInt(offset));

    const messagesResult = await query(baseQuery, queryParams);

    // Contar total de mensajes en la conversación
    let countQuery = `
      SELECT COUNT(*) as total
      FROM eu_chat_messages m
      JOIN eu_chat_conversations c ON m.conversation_id = c.id
      WHERE m.conversation_id = $1
    `;

    let countParams = [conversationId];
    paramCount = 1;

    if (before) {
      paramCount++;
      countQuery += ` AND m.created_at < $${paramCount}`;
      countParams.push(new Date(before));
    }

    const countResult = await query(countQuery, countParams);
    const totalMessages = parseInt(countResult.rows[0].total);

    const messages = messagesResult.rows.map(row => ({
      id: row.id,
      content: row.content,
      encryptedContent: row.encrypted_content,
      isFromUser: row.is_from_user,
      isRead: row.is_read,
      messageType: row.message_type,
      metadata: row.metadata,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      platform: {
        name: row.platform_name,
        displayName: row.platform_display_name,
        iconUrl: row.platform_icon,
        colorHex: row.platform_color
      }
    }));

    // Marcar mensajes como leídos si no son del usuario
    const unreadMessages = messages.filter(msg => !msg.isFromUser && !msg.isRead);
    if (unreadMessages.length > 0) {
      const messageIds = unreadMessages.map(msg => msg.id);
      await query(
        'UPDATE eu_chat_messages SET is_read = true WHERE id = ANY($1)',
        [messageIds]
      );

      // Actualizar contador de mensajes no leídos en la conversación
      await query(
        'UPDATE eu_chat_conversations SET unread_count = GREATEST(unread_count - $1, 0), updated_at = NOW() WHERE id = $2',
        [unreadMessages.length, conversationId]
      );

      console.log(`📖 ${unreadMessages.length} mensajes marcados como leídos en conversación: ${conversationResult.rows[0].title}`);
    }

    res.json({
      message: 'Mensajes obtenidos exitosamente',
      conversationId: parseInt(conversationId),
      conversationTitle: conversationResult.rows[0].title,
      messages,
      pagination: {
        total: totalMessages,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: (parseInt(offset) + parseInt(limit)) < totalMessages
      }
    });

  } catch (error) {
    console.error('❌ Error obteniendo mensajes:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error obteniendo los mensajes'
    });
  }
});

// Enviar mensaje
router.post('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const { conversationId, content, encryptedContent, messageType, metadata } = req.body;

    if (!conversationId || (!content && !encryptedContent)) {
      return res.status(400).json({
        error: 'Datos requeridos',
        message: 'conversationId y content o encryptedContent son obligatorios'
      });
    }

    // Verificar que la conversación existe y pertenece al usuario
    const conversationResult = await query(
      'SELECT id, title, platform_id FROM eu_chat_conversations WHERE id = $1 AND user_id = $2',
      [conversationId, userId]
    );

    if (conversationResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Conversación no encontrada',
        message: 'La conversación solicitada no existe'
      });
    }

    const conversation = conversationResult.rows[0];

    // Crear mensaje
    const newMessage = await query(
      `INSERT INTO messages (
        conversation_id, platform_id, content, encrypted_content, 
        is_from_user, message_type, metadata
      ) VALUES ($1, $2, $3, $4, true, $5, $6)
      RETURNING id, content, encrypted_content, message_type, created_at`,
      [conversationId, conversation.platform_id, content || null, encryptedContent || null, 
       messageType || 'text', metadata || null]
    );

    const message = newMessage.rows[0];

    // Actualizar conversación con último mensaje
    await query(
      `UPDATE conversations 
       SET last_message_text = $1, last_message_at = NOW(), updated_at = NOW()
       WHERE id = $2`,
      [content || '[Mensaje encriptado]', conversationId]
    );

    console.log(`✅ Mensaje enviado exitosamente en conversación: ${conversation.title}`);

    res.status(201).json({
      message: 'Mensaje enviado exitosamente',
      messageData: {
        id: message.id,
        content: message.content,
        encryptedContent: message.encrypted_content,
        messageType: message.message_type,
        isFromUser: true,
        isRead: false,
        createdAt: message.created_at,
        conversationId: parseInt(conversationId)
      }
    });

  } catch (error) {
    console.error('❌ Error enviando mensaje:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error enviando el mensaje'
    });
  }
});

// Recibir mensaje (webhook desde plataformas externas)
router.post('/receive', async (req, res) => {
  try {
    const { conversationId, platformId, content, encryptedContent, messageType, metadata, platformMessageId } = req.body;

    if (!conversationId || !platformId || (!content && !encryptedContent)) {
      return res.status(400).json({
        error: 'Datos requeridos',
        message: 'conversationId, platformId y content o encryptedContent son obligatorios'
      });
    }

    // Verificar que la conversación existe
    const conversationResult = await query(
      'SELECT id, title, user_id, unread_count FROM eu_chat_conversations WHERE id = $1',
      [conversationId]
    );

    if (conversationResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Conversación no encontrada',
        message: 'La conversación solicitada no existe'
      });
    }

    const conversation = conversationResult.rows[0];

    // Crear mensaje recibido
    const newMessage = await query(
      `INSERT INTO messages (
        conversation_id, platform_id, content, encrypted_content, 
        is_from_user, message_type, metadata, platform_message_id
      ) VALUES ($1, $2, $3, $4, false, $5, $6, $7)
      RETURNING id, content, encrypted_content, message_type, created_at`,
      [conversationId, platformId, content || null, encryptedContent || null, 
       messageType || 'text', metadata || null, platformMessageId || null]
    );

    const message = newMessage.rows[0];

    // Actualizar conversación con último mensaje y contador de no leídos
    await query(
      `UPDATE conversations 
       SET last_message_text = $1, last_message_at = NOW(), 
           unread_count = unread_count + 1, updated_at = NOW()
       WHERE id = $2`,
      [content || '[Mensaje encriptado]', conversationId]
    );

    console.log(`📥 Mensaje recibido exitosamente en conversación: ${conversation.title}`);

    // Aquí se podría emitir un evento WebSocket para notificar al usuario en tiempo real
    // req.app.get('io').to(`user_${conversation.user_id}`).emit('new_message', { ... });

    res.status(201).json({
      message: 'Mensaje recibido exitosamente',
      messageData: {
        id: message.id,
        content: message.content,
        encryptedContent: message.encrypted_content,
        messageType: message.message_type,
        isFromUser: false,
        isRead: false,
        createdAt: message.created_at,
        conversationId: parseInt(conversationId)
      }
    });

  } catch (error) {
    console.error('❌ Error recibiendo mensaje:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error recibiendo el mensaje'
    });
  }
});

// Marcar mensaje como leído
router.put('/:id/read', async (req, res) => {
  try {
    const userId = req.user.id;
    const messageId = req.params.id;

    // Verificar que el mensaje existe y pertenece a una conversación del usuario
    const messageResult = await query(
      `SELECT m.id, m.is_read, c.id as conversation_id, c.title, c.unread_count
       FROM eu_chat_messages m
       JOIN eu_chat_conversations c ON m.conversation_id = c.id
       WHERE m.id = $1 AND c.user_id = $2`,
      [messageId, userId]
    );

    if (messageResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Mensaje no encontrado',
        message: 'El mensaje solicitado no existe'
      });
    }

    const message = messageResult.rows[0];

    if (message.is_read) {
      return res.json({
        message: 'El mensaje ya está marcado como leído'
      });
    }

    // Marcar mensaje como leído
    await query(
      'UPDATE eu_chat_messages SET is_read = true WHERE id = $1',
      [messageId]
    );

    // Actualizar contador de mensajes no leídos en la conversación
    if (message.unread_count > 0) {
      await query(
        'UPDATE eu_chat_conversations SET unread_count = GREATEST(unread_count - 1, 0), updated_at = NOW() WHERE id = $1',
        [message.conversation_id]
      );
    }

    console.log(`📖 Mensaje marcado como leído en conversación: ${message.title}`);

    res.json({
      message: 'Mensaje marcado como leído exitosamente'
    });

  } catch (error) {
    console.error('❌ Error marcando mensaje como leído:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error marcando el mensaje como leído'
    });
  }
});

// Eliminar mensaje
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const messageId = req.params.id;

    // Verificar que el mensaje existe, pertenece al usuario y es un mensaje enviado por él
    const messageResult = await query(
      `SELECT m.id, m.content, m.is_from_user, c.id as conversation_id, c.title
       FROM eu_chat_messages m
       JOIN eu_chat_conversations c ON m.conversation_id = c.id
       WHERE m.id = $1 AND c.user_id = $2 AND m.is_from_user = true`,
      [messageId, userId]
    );

    if (messageResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Mensaje no encontrado',
        message: 'El mensaje solicitado no existe o no puedes eliminarlo'
      });
    }

    const message = messageResult.rows[0];

    // Eliminar mensaje
    await query(
      'DELETE FROM eu_chat_messages WHERE id = $1',
      [messageId]
    );

    console.log(`🗑️ Mensaje eliminado exitosamente: ${message.content?.substring(0, 50) || '[Mensaje encriptado]'}`);

    res.json({
      message: 'Mensaje eliminado exitosamente'
    });

  } catch (error) {
    console.error('❌ Error eliminando mensaje:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error eliminando el mensaje'
    });
  }
});

// Buscar mensajes
router.get('/search/:query', async (req, res) => {
  try {
    const userId = req.user.id;
    const searchQuery = req.params.query;
    const { conversationId, platform, limit = 20 } = req.query;

    if (!searchQuery || searchQuery.trim().length < 2) {
      return res.status(400).json({
        error: 'Query inválida',
        message: 'La búsqueda debe tener al menos 2 caracteres'
      });
    }

    // Construir query base
    let baseQuery = `
      SELECT 
        m.id, m.content, m.encrypted_content, m.is_from_user, m.is_read,
        m.message_type, m.created_at,
        c.id as conversation_id, c.title as conversation_title,
        p.name as platform_name, p.display_name as platform_display_name
       FROM eu_chat_messages m
       JOIN eu_chat_conversations c ON m.conversation_id = c.id
       JOIN eu_chat_platforms p ON c.platform_id = p.id
       WHERE c.user_id = $1 AND (
         m.content ILIKE $2 OR 
         m.encrypted_content ILIKE $2
       )
    `;

    let queryParams = [userId, `%${searchQuery}%`];
    let paramCount = 2;

    // Filtros adicionales
    if (conversationId) {
      paramCount++;
      baseQuery += ` AND c.id = $${paramCount}`;
      queryParams.push(conversationId);
    }

    if (platform) {
      paramCount++;
      baseQuery += ` AND p.name = $${paramCount}`;
      queryParams.push(platform);
    }

    // Ordenamiento y límite
    baseQuery += ` ORDER BY m.created_at DESC LIMIT $${paramCount + 1}`;
    queryParams.push(parseInt(limit));

    const searchResult = await query(baseQuery, queryParams);

    const messages = searchResult.rows.map(row => ({
      id: row.id,
      content: row.content,
      encryptedContent: row.encrypted_content,
      isFromUser: row.is_from_user,
      isRead: row.is_read,
      messageType: row.message_type,
      createdAt: row.created_at,
      conversation: {
        id: row.conversation_id,
        title: row.conversation_title
      },
      platform: {
        name: row.platform_name,
        displayName: row.platform_display_name
      }
    }));

    res.json({
      message: 'Búsqueda completada exitosamente',
      query: searchQuery,
      results: messages.length,
      messages
    });

  } catch (error) {
    console.error('❌ Error en búsqueda de mensajes:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error realizando la búsqueda'
    });
  }
});

module.exports = router;
