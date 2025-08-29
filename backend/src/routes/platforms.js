const express = require('express');
const { query } = require('../../config/database');
const router = express.Router();

// Obtener lista de plataformas disponibles
router.get('/', async (req, res) => {
  try {
    const { active, limit = 50, offset = 0 } = req.query;

    // Construir query base
    let baseQuery = `
      SELECT 
        id, name, display_name, api_url, icon_url, color_hex,
        is_active, requires_verification, supports_e2ee, created_at, updated_at
       FROM eu_chat_platforms
       WHERE 1=1
    `;

    let queryParams = [];
    let paramCount = 0;

    // Filtros
    if (active !== undefined) {
      paramCount++;
      baseQuery += ` AND is_active = $${paramCount}`;
      queryParams.push(active === 'true');
    }

    // Ordenamiento y paginación
    baseQuery += ` ORDER BY is_active DESC, display_name ASC`;
    baseQuery += ` LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    queryParams.push(parseInt(limit), parseInt(offset));

    const platformsResult = await query(baseQuery, queryParams);

    // Contar total de plataformas (sin paginación)
    let countQuery = `
      SELECT COUNT(*) as total
      FROM eu_chat_platforms
      WHERE 1=1
    `;

    let countParams = [];
    paramCount = 0;

    if (active !== undefined) {
      paramCount++;
      countQuery += ` AND is_active = $${paramCount}`;
      countParams.push(active === 'true');
    }

    const countResult = await query(countQuery, countParams);
    const totalPlatforms = parseInt(countResult.rows[0].total);

    const platforms = platformsResult.rows.map(row => ({
      id: row.id,
      name: row.name,
      displayName: row.display_name,
      apiUrl: row.api_url,
      iconUrl: row.icon_url,
      colorHex: row.color_hex,
      isActive: row.is_active,
      requiresVerification: row.requires_verification,
      supportsE2ee: row.supports_e2ee,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));

    res.json({
      message: 'Plataformas obtenidas exitosamente',
      platforms,
      pagination: {
        total: totalPlatforms,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: (parseInt(offset) + parseInt(limit)) < totalPlatforms
      }
    });

  } catch (error) {
    console.error('❌ Error obteniendo plataformas:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error obteniendo la lista de plataformas'
    });
  }
});

// Obtener plataforma específica
router.get('/:id', async (req, res) => {
  try {
    const platformId = req.params.id;

    const platformResult = await query(
      `SELECT 
        id, name, display_name, description, api_url, icon_url, color_hex,
        is_active, is_verified, supported_features, api_version, 
        webhook_url, api_credentials, created_at, updated_at
       FROM platforms WHERE id = $1`,
      [platformId]
    );

    if (platformResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Plataforma no encontrada',
        message: 'La plataforma solicitada no existe'
      });
    }

    const platform = platformResult.rows[0];

    res.json({
      message: 'Plataforma obtenida exitosamente',
      platform: {
        id: platform.id,
        name: platform.name,
        displayName: platform.display_name,
        description: platform.description,
        apiUrl: platform.api_url,
        iconUrl: platform.icon_url,
        colorHex: platform.color_hex,
        isActive: platform.is_active,
        isVerified: platform.is_verified,
        supportedFeatures: platform.supported_features,
        apiVersion: platform.api_version,
        webhookUrl: platform.webhook_url,
        apiCredentials: platform.api_credentials,
        createdAt: platform.created_at,
        updatedAt: platform.updated_at
      }
    });

  } catch (error) {
    console.error('❌ Error obteniendo plataforma:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error obteniendo la plataforma'
    });
  }
});

// Crear nueva plataforma (solo admin)
router.post('/', async (req, res) => {
  try {
    const { name, displayName, description, apiUrl, iconUrl, colorHex, supportedFeatures, apiVersion } = req.body;

    if (!name || !displayName) {
      return res.status(400).json({
        error: 'Datos requeridos',
        message: 'name y displayName son obligatorios'
      });
    }

    // Verificar que no existe ya una plataforma con el mismo nombre
    const existingPlatform = await query(
      'SELECT id FROM platforms WHERE name = $1',
      [name]
    );

    if (existingPlatform.rows.length > 0) {
      return res.status(409).json({
        error: 'Plataforma ya existe',
        message: 'Ya existe una plataforma con este nombre'
      });
    }

    // Crear plataforma
    const newPlatform = await query(
      `INSERT INTO platforms (
        name, display_name, description, api_url, icon_url, color_hex,
        supported_features, api_version, is_active, is_verified
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, false)
      RETURNING id, name, display_name, description, api_url, icon_url, 
                color_hex, supported_features, api_version, created_at`,
      [name, displayName, description || null, apiUrl || null, iconUrl || null, 
       colorHex || null, supportedFeatures || null, apiVersion || null]
    );

    const platform = newPlatform.rows[0];

    console.log(`✅ Plataforma creada exitosamente: ${platform.display_name}`);

    res.status(201).json({
      message: 'Plataforma creada exitosamente',
      platform: {
        id: platform.id,
        name: platform.name,
        displayName: platform.display_name,
        description: platform.description,
        apiUrl: platform.api_url,
        iconUrl: platform.icon_url,
        colorHex: platform.color_hex,
        supportedFeatures: platform.supported_features,
        apiVersion: platform.api_version,
        isActive: platform.is_active,
        isVerified: platform.is_verified,
        createdAt: platform.created_at
      }
    });

  } catch (error) {
    console.error('❌ Error creando plataforma:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error creando la plataforma'
    });
  }
});

// Actualizar plataforma
router.put('/:id', async (req, res) => {
  try {
    const platformId = req.params.id;
    const { displayName, description, apiUrl, iconUrl, colorHex, supportedFeatures, apiVersion, isActive, webhookUrl } = req.body;

    // Verificar que la plataforma existe
    const existingPlatform = await query(
      'SELECT id, name FROM platforms WHERE id = $1',
      [platformId]
    );

    if (existingPlatform.rows.length === 0) {
      return res.status(404).json({
        error: 'Plataforma no encontrada',
        message: 'La plataforma solicitada no existe'
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

    if (description !== undefined) {
      updateFields.push(`description = $${paramCount}`);
      values.push(description);
      paramCount++;
    }

    if (apiUrl !== undefined) {
      updateFields.push(`api_url = $${paramCount}`);
      values.push(apiUrl);
      paramCount++;
    }

    if (iconUrl !== undefined) {
      updateFields.push(`icon_url = $${paramCount}`);
      values.push(iconUrl);
      paramCount++;
    }

    if (colorHex !== undefined) {
      updateFields.push(`color_hex = $${paramCount}`);
      values.push(colorHex);
      paramCount++;
    }

    if (supportedFeatures !== undefined) {
      updateFields.push(`supported_features = $${paramCount}`);
      values.push(supportedFeatures);
      paramCount++;
    }

    if (apiVersion !== undefined) {
      updateFields.push(`api_version = $${paramCount}`);
      values.push(apiVersion);
      paramCount++;
    }

    if (isActive !== undefined) {
      updateFields.push(`is_active = $${paramCount}`);
      values.push(isActive);
      paramCount++;
    }

    if (webhookUrl !== undefined) {
      updateFields.push(`webhook_url = $${paramCount}`);
      values.push(webhookUrl);
      paramCount++;
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        error: 'Datos requeridos',
        message: 'Debes proporcionar al menos un campo para actualizar'
      });
    }

    // Agregar updated_at y platform_id
    updateFields.push(`updated_at = NOW()`);
    values.push(platformId);

    const updateQuery = `
      UPDATE platforms 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, name, display_name, description, api_url, icon_url, 
                color_hex, supported_features, api_version, is_active, updated_at
    `;

    const result = await query(updateQuery, values);

    const updatedPlatform = result.rows[0];

    console.log(`✅ Plataforma actualizada exitosamente: ${updatedPlatform.display_name}`);

    res.json({
      message: 'Plataforma actualizada exitosamente',
      platform: {
        id: updatedPlatform.id,
        name: updatedPlatform.name,
        displayName: updatedPlatform.display_name,
        description: updatedPlatform.description,
        apiUrl: updatedPlatform.api_url,
        iconUrl: updatedPlatform.icon_url,
        colorHex: updatedPlatform.color_hex,
        supportedFeatures: updatedPlatform.supported_features,
        apiVersion: updatedPlatform.api_version,
        isActive: updatedPlatform.is_active,
        updatedAt: updatedPlatform.updated_at
      }
    });

  } catch (error) {
    console.error('❌ Error actualizando plataforma:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error actualizando la plataforma'
    });
  }
});

// Activar/desactivar plataforma
router.put('/:id/toggle', async (req, res) => {
  try {
    const platformId = req.params.id;
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        error: 'Dato inválido',
        message: 'isActive debe ser un valor booleano'
      });
    }

    // Verificar que la plataforma existe
    const existingPlatform = await query(
      'SELECT id, name, display_name FROM platforms WHERE id = $1',
      [platformId]
    );

    if (existingPlatform.rows.length === 0) {
      return res.status(404).json({
        error: 'Plataforma no encontrada',
        message: 'La plataforma solicitada no existe'
      });
    }

    // Actualizar estado de activación
    await query(
      'UPDATE platforms SET is_active = $1, updated_at = NOW() WHERE id = $2',
      [isActive, platformId]
    );

    const action = isActive ? 'activada' : 'desactivada';
    console.log(`🔄 Plataforma ${action}: ${existingPlatform.rows[0].display_name}`);

    res.json({
      message: `Plataforma ${action} exitosamente`,
      isActive
    });

  } catch (error) {
    console.error('❌ Error cambiando estado de plataforma:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error cambiando el estado de la plataforma'
    });
  }
});

// Verificar plataforma
router.put('/:id/verify', async (req, res) => {
  try {
    const platformId = req.params.id;
    const { isVerified } = req.body;

    if (typeof isVerified !== 'boolean') {
      return res.status(400).json({
        error: 'Dato inválido',
        message: 'isVerified debe ser un valor booleano'
      });
    }

    // Verificar que la plataforma existe
    const existingPlatform = await query(
      'SELECT id, name, display_name FROM platforms WHERE id = $1',
      [platformId]
    );

    if (existingPlatform.rows.length === 0) {
      return res.status(404).json({
        error: 'Plataforma no encontrada',
        message: 'La plataforma solicitada no existe'
      });
    }

    // Actualizar estado de verificación
    await query(
      'UPDATE platforms SET is_verified = $1, updated_at = NOW() WHERE id = $2',
      [isVerified, platformId]
    );

    const action = isVerified ? 'verificada' : 'desverificada';
    console.log(`✅ Plataforma ${action}: ${existingPlatform.rows[0].display_name}`);

    res.json({
      message: `Plataforma ${action} exitosamente`,
      isVerified
    });

  } catch (error) {
    console.error('❌ Error verificando plataforma:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error verificando la plataforma'
    });
  }
});

// Eliminar plataforma
router.delete('/:id', async (req, res) => {
  try {
    const platformId = req.params.id;

    // Verificar que la plataforma existe
    const existingPlatform = await query(
      'SELECT id, name, display_name FROM platforms WHERE id = $1',
      [platformId]
    );

    if (existingPlatform.rows.length === 0) {
      return res.status(404).json({
        error: 'Plataforma no encontrada',
        message: 'La plataforma solicitada no existe'
      });
    }

    // Verificar que no hay conversaciones o contactos usando esta plataforma
    const usageCheck = await query(
      `SELECT 
        (SELECT COUNT(*) FROM conversations WHERE platform_id = $1) as conversations_count,
        (SELECT COUNT(*) FROM contacts WHERE platform_id = $1) as contacts_count`,
      [platformId]
    );

    const conversationsCount = parseInt(usageCheck.rows[0].conversations_count);
    const contactsCount = parseInt(usageCheck.rows[0].contacts_count);

    if (conversationsCount > 0 || contactsCount > 0) {
      return res.status(400).json({
        error: 'Plataforma en uso',
        message: `No se puede eliminar la plataforma porque tiene ${conversationsCount} conversaciones y ${contactsCount} contactos asociados`
      });
    }

    // Eliminar plataforma
    await query(
      'DELETE FROM platforms WHERE id = $1',
      [platformId]
    );

    console.log(`🗑️ Plataforma eliminada exitosamente: ${existingPlatform.rows[0].display_name}`);

    res.json({
      message: 'Plataforma eliminada exitosamente'
    });

  } catch (error) {
    console.error('❌ Error eliminando plataforma:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error eliminando la plataforma'
    });
  }
});

// Obtener estadísticas de plataforma
router.get('/:id/stats', async (req, res) => {
  try {
    const platformId = req.params.id;

    // Verificar que la plataforma existe
    const platformResult = await query(
      'SELECT id, name, display_name FROM platforms WHERE id = $1',
      [platformId]
    );

    if (platformResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Plataforma no encontrada',
        message: 'La plataforma solicitada no existe'
      });
    }

    const platform = platformResult.rows[0];

    // Estadísticas de conversaciones
    const conversationsStats = await query(
      'SELECT COUNT(*) as total_conversations FROM conversations WHERE platform_id = $1',
      [platformId]
    );

    // Estadísticas de contactos
    const contactsStats = await query(
      'SELECT COUNT(*) as total_contacts FROM contacts WHERE platform_id = $1',
      [platformId]
    );

    // Estadísticas de mensajes
    const messagesStats = await query(
      `SELECT 
        COUNT(*) as total_messages,
        COUNT(CASE WHEN is_from_user = true THEN 1 END) as sent_messages,
        COUNT(CASE WHEN is_from_user = false THEN 1 END) as received_messages
       FROM messages WHERE platform_id = $1`,
      [platformId]
    );

    // Estadísticas de usuarios activos
    const activeUsersStats = await query(
      `SELECT COUNT(DISTINCT c.user_id) as active_users
       FROM conversations c
       WHERE c.platform_id = $1 AND c.updated_at > NOW() - INTERVAL '30 days'`,
      [platformId]
    );

    const stats = {
      platform: {
        id: platform.id,
        name: platform.name,
        displayName: platform.display_name
      },
      conversations: {
        total: parseInt(conversationsStats.rows[0].total_conversations) || 0
      },
      contacts: {
        total: parseInt(contactsStats.rows[0].total_contacts) || 0
      },
      messages: {
        total: parseInt(messagesStats.rows[0].total_messages) || 0,
        sent: parseInt(messagesStats.rows[0].sent_messages) || 0,
        received: parseInt(messagesStats.rows[0].received_messages) || 0
      },
      users: {
        active: parseInt(activeUsersStats.rows[0].active_users) || 0
      }
    };

    res.json({
      message: 'Estadísticas de plataforma obtenidas exitosamente',
      stats
    });

  } catch (error) {
    console.error('❌ Error obteniendo estadísticas de plataforma:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error obteniendo las estadísticas de la plataforma'
    });
  }
});

module.exports = router;
