const express = require('express');
const { query } = require('../../config/database');
const router = express.Router();

// Obtener lista de contactos del usuario
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const { platform, search, favorite, limit = 50, offset = 0 } = req.query;

    // Construir query base
    let baseQuery = `
      SELECT 
        c.id, c.platform_contact_id, c.display_name, c.phone_number, c.email,
        c.avatar_url, c.is_favorite, c.is_blocked, c.last_interaction,
        c.created_at, c.updated_at,
        p.name as platform_name, p.display_name as platform_display_name,
        p.icon_url as platform_icon, p.color_hex as platform_color
      FROM contacts c
      JOIN platforms p ON c.platform_id = p.id
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

    if (search) {
      paramCount++;
      baseQuery += ` AND (
        c.display_name ILIKE $${paramCount} OR 
        c.phone_number ILIKE $${paramCount} OR 
        c.email ILIKE $${paramCount}
      )`;
      queryParams.push(`%${search}%`);
    }

    if (favorite !== undefined) {
      paramCount++;
      baseQuery += ` AND c.is_favorite = $${paramCount}`;
      queryParams.push(favorite === 'true');
    }

    // Ordenamiento y paginación
    baseQuery += ` ORDER BY c.is_favorite DESC, c.last_interaction DESC NULLS LAST, c.display_name ASC`;
    baseQuery += ` LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    queryParams.push(parseInt(limit), parseInt(offset));

    const contactsResult = await query(baseQuery, queryParams);

    // Contar total de contactos (sin paginación)
    let countQuery = `
      SELECT COUNT(*) as total
      FROM contacts c
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

    if (search) {
      paramCount++;
      countQuery += ` AND (
        c.display_name ILIKE $${paramCount} OR 
        c.phone_number ILIKE $${paramCount} OR 
        c.email ILIKE $${paramCount}
      )`;
      countParams.push(`%${search}%`);
    }

    if (favorite !== undefined) {
      paramCount++;
      countQuery += ` AND c.is_favorite = $${paramCount}`;
      countParams.push(favorite === 'true');
    }

    const countResult = await query(countQuery, countParams);
    const totalContacts = parseInt(countResult.rows[0].total);

    const contacts = contactsResult.rows.map(row => ({
      id: row.id,
      platformContactId: row.platform_contact_id,
      displayName: row.display_name,
      phoneNumber: row.phone_number,
      email: row.email,
      avatarUrl: row.avatar_url,
      isFavorite: row.is_favorite,
      isBlocked: row.is_blocked,
      lastInteraction: row.last_interaction,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      platform: {
        name: row.platform_name,
        displayName: row.platform_display_name,
        iconUrl: row.platform_icon,
        colorHex: row.platform_color
      }
    }));

    res.json({
      message: 'Contactos obtenidos exitosamente',
      contacts,
      pagination: {
        total: totalContacts,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: (parseInt(offset) + parseInt(limit)) < totalContacts
      }
    });

  } catch (error) {
    console.error('❌ Error obteniendo contactos:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error obteniendo la lista de contactos'
    });
  }
});

// Obtener contacto específico
router.get('/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const contactId = req.params.id;

    const contactResult = await query(
      `SELECT 
        c.id, c.platform_contact_id, c.display_name, c.phone_number, c.email,
        c.avatar_url, c.is_favorite, c.is_blocked, c.last_interaction,
        c.metadata, c.created_at, c.updated_at,
        p.name as platform_name, p.display_name as platform_display_name,
        p.icon_url as platform_icon, p.color_hex as platform_color
       FROM contacts c
       JOIN platforms p ON c.platform_id = p.id
       WHERE c.id = $1 AND c.user_id = $2`,
      [contactId, userId]
    );

    if (contactResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Contacto no encontrado',
        message: 'El contacto solicitado no existe'
      });
    }

    const contact = contactResult.rows[0];

    res.json({
      message: 'Contacto obtenido exitosamente',
      contact: {
        id: contact.id,
        platformContactId: contact.platform_contact_id,
        displayName: contact.display_name,
        phoneNumber: contact.phone_number,
        email: contact.email,
        avatarUrl: contact.avatar_url,
        isFavorite: contact.is_favorite,
        isBlocked: contact.is_blocked,
        lastInteraction: contact.last_interaction,
        metadata: contact.metadata,
        createdAt: contact.created_at,
        updatedAt: contact.updated_at,
        platform: {
          name: contact.platform_name,
          displayName: contact.platform_display_name,
          iconUrl: contact.platform_icon,
          colorHex: contact.platform_color
        }
      }
    });

  } catch (error) {
    console.error('❌ Error obteniendo contacto:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error obteniendo el contacto'
    });
  }
});

// Crear nuevo contacto
router.post('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const { platformId, platformContactId, displayName, phoneNumber, email, avatarUrl, metadata } = req.body;

    if (!platformId || !platformContactId || !displayName) {
      return res.status(400).json({
        error: 'Datos requeridos',
        message: 'platformId, platformContactId y displayName son obligatorios'
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

    // Verificar que no existe ya un contacto con la misma plataforma y ID
    const existingContact = await query(
      'SELECT id FROM contacts WHERE user_id = $1 AND platform_id = $2 AND platform_contact_id = $3',
      [userId, platformId, platformContactId]
    );

    if (existingContact.rows.length > 0) {
      return res.status(409).json({
        error: 'Contacto ya existe',
        message: 'Ya existe un contacto con este ID en la plataforma especificada'
      });
    }

    // Crear contacto
    const newContact = await query(
      `INSERT INTO contacts (
        user_id, platform_id, platform_contact_id, display_name, phone_number, 
        email, avatar_url, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, platform_contact_id, display_name, phone_number, email, 
                avatar_url, is_favorite, is_blocked, created_at`,
      [userId, platformId, platformContactId, displayName, phoneNumber || null, 
       email || null, avatarUrl || null, metadata || null]
    );

    const contact = newContact.rows[0];

    console.log(`✅ Contacto creado exitosamente: ${contact.display_name}`);

    res.status(201).json({
      message: 'Contacto creado exitosamente',
      contact: {
        id: contact.id,
        platformContactId: contact.platform_contact_id,
        displayName: contact.display_name,
        phoneNumber: contact.phone_number,
        email: contact.email,
        avatarUrl: contact.avatar_url,
        isFavorite: contact.is_favorite,
        isBlocked: contact.is_blocked,
        createdAt: contact.created_at
      }
    });

  } catch (error) {
    console.error('❌ Error creando contacto:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error creando el contacto'
    });
  }
});

// Actualizar contacto
router.put('/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const contactId = req.params.id;
    const { displayName, phoneNumber, email, avatarUrl, metadata } = req.body;

    // Verificar que el contacto existe y pertenece al usuario
    const existingContact = await query(
      'SELECT id FROM contacts WHERE id = $1 AND user_id = $2',
      [contactId, userId]
    );

    if (existingContact.rows.length === 0) {
      return res.status(404).json({
        error: 'Contacto no encontrado',
        message: 'El contacto solicitado no existe'
      });
    }

    // Construir query de actualización
    let updateFields = [];
    let values = [];
    let paramCount = 1;

    if (displayName !== undefined) {
      updateFields.push(`display_name = $${paramCount}`);
      values.push(displayName);
      paramCount++;
    }

    if (phoneNumber !== undefined) {
      updateFields.push(`phone_number = $${paramCount}`);
      values.push(phoneNumber);
      paramCount++;
    }

    if (email !== undefined) {
      updateFields.push(`email = $${paramCount}`);
      values.push(email);
      paramCount++;
    }

    if (avatarUrl !== undefined) {
      updateFields.push(`avatar_url = $${paramCount}`);
      values.push(avatarUrl);
      paramCount++;
    }

    if (metadata !== undefined) {
      updateFields.push(`metadata = $${paramCount}`);
      values.push(metadata);
      paramCount++;
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        error: 'Datos requeridos',
        message: 'Debes proporcionar al menos un campo para actualizar'
      });
    }

    // Agregar updated_at y contact_id
    updateFields.push(`updated_at = NOW()`);
    values.push(contactId);

    const updateQuery = `
      UPDATE contacts 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, display_name, phone_number, email, avatar_url, updated_at
    `;

    const result = await query(updateQuery, values);

    const updatedContact = result.rows[0];

    console.log(`✅ Contacto actualizado exitosamente: ${updatedContact.display_name}`);

    res.json({
      message: 'Contacto actualizado exitosamente',
      contact: {
        id: updatedContact.id,
        displayName: updatedContact.display_name,
        phoneNumber: updatedContact.phone_number,
        email: updatedContact.email,
        avatarUrl: updatedContact.avatar_url,
        updatedAt: updatedContact.updated_at
      }
    });

  } catch (error) {
    console.error('❌ Error actualizando contacto:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error actualizando el contacto'
    });
  }
});

// Eliminar contacto
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const contactId = req.params.id;

    // Verificar que el contacto existe y pertenece al usuario
    const existingContact = await query(
      'SELECT id, display_name FROM contacts WHERE id = $1 AND user_id = $2',
      [contactId, userId]
    );

    if (existingContact.rows.length === 0) {
      return res.status(404).json({
        error: 'Contacto no encontrado',
        message: 'El contacto solicitado no existe'
      });
    }

    // Eliminar contacto
    await query(
      'DELETE FROM contacts WHERE id = $1 AND user_id = $2',
      [contactId, userId]
    );

    console.log(`🗑️ Contacto eliminado exitosamente: ${existingContact.rows[0].display_name}`);

    res.json({
      message: 'Contacto eliminado exitosamente'
    });

  } catch (error) {
    console.error('❌ Error eliminando contacto:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error eliminando el contacto'
    });
  }
});

// Buscar contactos
router.get('/search/:query', async (req, res) => {
  try {
    const userId = req.user.id;
    const searchQuery = req.params.query;
    const { limit = 20 } = req.query;

    if (!searchQuery || searchQuery.trim().length < 2) {
      return res.status(400).json({
        error: 'Query inválida',
        message: 'La búsqueda debe tener al menos 2 caracteres'
      });
    }

    const searchResult = await query(
      `SELECT 
        c.id, c.platform_contact_id, c.display_name, c.phone_number, c.email,
        c.avatar_url, c.is_favorite, c.is_blocked, c.last_interaction,
        p.name as platform_name, p.display_name as platform_display_name,
        p.icon_url as platform_icon, p.color_hex as platform_color
       FROM contacts c
       JOIN platforms p ON c.platform_id = p.id
       WHERE c.user_id = $1 AND (
         c.display_name ILIKE $2 OR 
         c.phone_number ILIKE $2 OR 
         c.email ILIKE $2
       )
       ORDER BY 
         CASE WHEN c.display_name ILIKE $2 THEN 1 ELSE 2 END,
         c.is_favorite DESC,
         c.last_interaction DESC NULLS LAST
       LIMIT $3`,
      [userId, `%${searchQuery}%`, parseInt(limit)]
    );

    const contacts = searchResult.rows.map(row => ({
      id: row.id,
      platformContactId: row.platform_contact_id,
      displayName: row.display_name,
      phoneNumber: row.phone_number,
      email: row.email,
      avatarUrl: row.avatar_url,
      isFavorite: row.is_favorite,
      isBlocked: row.is_blocked,
      lastInteraction: row.last_interaction,
      platform: {
        name: row.platform_name,
        displayName: row.platform_display_name,
        iconUrl: row.platform_icon,
        colorHex: row.platform_color
      }
    }));

    res.json({
      message: 'Búsqueda completada exitosamente',
      query: searchQuery,
      results: contacts.length,
      contacts
    });

  } catch (error) {
    console.error('❌ Error en búsqueda de contactos:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error realizando la búsqueda'
    });
  }
});

// Marcar/desmarcar contacto como favorito
router.put('/:id/favorite', async (req, res) => {
  try {
    const userId = req.user.id;
    const contactId = req.params.id;
    const { isFavorite } = req.body;

    if (typeof isFavorite !== 'boolean') {
      return res.status(400).json({
        error: 'Dato inválido',
        message: 'isFavorite debe ser un valor booleano'
      });
    }

    // Verificar que el contacto existe y pertenece al usuario
    const existingContact = await query(
      'SELECT id, display_name FROM contacts WHERE id = $1 AND user_id = $2',
      [contactId, userId]
    );

    if (existingContact.rows.length === 0) {
      return res.status(404).json({
        error: 'Contacto no encontrado',
        message: 'El contacto solicitado no existe'
      });
    }

    // Actualizar estado de favorito
    await query(
      'UPDATE contacts SET is_favorite = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3',
      [isFavorite, contactId, userId]
    );

    const action = isFavorite ? 'marcado como favorito' : 'desmarcado como favorito';
    console.log(`⭐ Contacto ${action}: ${existingContact.rows[0].display_name}`);

    res.json({
      message: `Contacto ${action} exitosamente`,
      isFavorite
    });

  } catch (error) {
    console.error('❌ Error actualizando favorito:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error actualizando el estado de favorito'
    });
  }
});

module.exports = router;
