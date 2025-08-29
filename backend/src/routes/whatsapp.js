const express = require('express');
const axios = require('axios');
const { query } = require('../../config/database');
const router = express.Router();

// Configuración de WhatsApp API
const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v18.0';
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const WHATSAPP_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

// Verificación del webhook (requerido por WhatsApp)
router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  console.log('🔗 Webhook de WhatsApp verificado:', { mode, token, challenge });

  if (mode === 'subscribe' && token === WHATSAPP_VERIFY_TOKEN) {
    console.log('✅ Webhook verificado exitosamente');
    res.status(200).send(challenge);
  } else {
    console.log('❌ Webhook verificación fallida');
    res.status(403).send('Forbidden');
  }
});

// Webhook para recibir mensajes de WhatsApp
router.post('/webhook', async (req, res) => {
  try {
    const { object, entry } = req.body;

    if (object === 'whatsapp_business_account') {
      console.log('📥 Webhook de WhatsApp recibido:', { object, entries: entry?.length });

      for (const webhookEntry of entry) {
        for (const change of webhookEntry.changes) {
          if (change.value.messages && change.value.messages.length > 0) {
            for (const message of change.value.messages) {
              await processWhatsAppMessage(message, change.value.metadata);
            }
          }

          // Procesar actualizaciones de estado de mensajes
          if (change.value.statuses && change.value.statuses.length > 0) {
            for (const status of change.value.statuses) {
              await processWhatsAppStatus(status, change.value.metadata);
            }
          }
        }
      }

      res.status(200).send('OK');
    } else {
      res.status(200).send('OK');
    }

  } catch (error) {
    console.error('❌ Error procesando webhook de WhatsApp:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Procesar mensaje recibido de WhatsApp
async function processWhatsAppMessage(message, metadata) {
  try {
    const {
      id: platformMessageId,
      from: fromPhoneNumber,
      timestamp,
      type: messageType,
      text,
      image,
      document,
      audio,
      video,
      location,
      contacts
    } = message;

    const phoneNumberId = metadata.phone_number_id;
    const businessAccountId = metadata.phone_number_id;

    console.log(`📱 Mensaje de WhatsApp recibido: ${messageType} de ${fromPhoneNumber}`);

    // Buscar o crear contacto
    let contact = await findOrCreateContact(fromPhoneNumber, phoneNumberId);

    // Buscar o crear conversación
    let conversation = await findOrCreateConversation(contact.id, phoneNumberId);

    // Determinar contenido del mensaje
    let content = null;
    let encryptedContent = null;
    let metadataObj = {};

    switch (messageType) {
      case 'text':
        content = text?.body || '';
        break;
      case 'image':
        content = `[Imagen] ${image?.caption || ''}`;
        metadataObj = { imageId: image?.id, mimeType: image?.mime_type };
        break;
      case 'document':
        content = `[Documento] ${document?.filename || ''}`;
        metadataObj = { documentId: document?.id, filename: document?.filename };
        break;
      case 'audio':
        content = '[Audio]';
        metadataObj = { audioId: audio?.id, mimeType: audio?.mime_type };
        break;
      case 'video':
        content = `[Video] ${video?.caption || ''}`;
        metadataObj = { videoId: video?.id, mimeType: video?.mime_type };
        break;
      case 'location':
        content = `[Ubicación] ${location?.name || ''}`;
        metadataObj = { 
          latitude: location?.latitude, 
          longitude: location?.longitude,
          name: location?.name,
          address: location?.address
        };
        break;
      case 'contacts':
        content = '[Contactos compartidos]';
        metadataObj = { contacts: contacts?.map(c => ({ name: c.name, phone: c.phones?.[0]?.phone_number })) };
        break;
      default:
        content = `[${messageType}]`;
    }

    // Crear mensaje en la base de datos
    const newMessage = await query(
      `INSERT INTO messages (
        conversation_id, platform_id, content, encrypted_content, 
        is_from_user, message_type, metadata, platform_message_id
      ) VALUES ($1, $2, $3, $4, false, $5, $6, $7)
      RETURNING id, content, created_at`,
      [conversation.id, conversation.platform_id, content, encryptedContent, 
       messageType, JSON.stringify(metadataObj), platformMessageId]
    );

    // Actualizar conversación
    await query(
      `UPDATE conversations 
       SET last_message_text = $1, last_message_at = NOW(), 
           unread_count = unread_count + 1, updated_at = NOW()
       WHERE id = $2`,
      [content, conversation.id]
    );

    console.log(`✅ Mensaje de WhatsApp procesado: ${newMessage.rows[0].id}`);

    // Aquí se podría emitir un evento WebSocket para notificar al usuario en tiempo real
    // req.app.get('io').to(`user_${conversation.user_id}`).emit('new_whatsapp_message', { ... });

  } catch (error) {
    console.error('❌ Error procesando mensaje de WhatsApp:', error);
  }
}

// Procesar actualización de estado de mensaje
async function processWhatsAppStatus(status, metadata) {
  try {
    const { id: platformMessageId, status: messageStatus, timestamp } = status;

    console.log(`📊 Estado de mensaje WhatsApp actualizado: ${platformMessageId} -> ${messageStatus}`);

    // Buscar mensaje por platform_message_id
    const messageResult = await query(
      'SELECT id, conversation_id FROM messages WHERE platform_message_id = $1',
      [platformMessageId]
    );

    if (messageResult.rows.length > 0) {
      const message = messageResult.rows[0];

      // Actualizar metadata del mensaje con el estado
      await query(
        'UPDATE messages SET metadata = COALESCE(metadata, \'{}\') || $1, updated_at = NOW() WHERE id = $2',
        [JSON.stringify({ whatsappStatus: messageStatus, statusTimestamp: timestamp }), message.id]
      );

      console.log(`✅ Estado de mensaje actualizado: ${message.id}`);
    }

  } catch (error) {
    console.error('❌ Error procesando estado de mensaje de WhatsApp:', error);
  }
}

// Buscar o crear contacto
async function findOrCreateContact(phoneNumber, platformId) {
  try {
    // Buscar contacto existente
    let contactResult = await query(
      'SELECT id FROM contacts WHERE phone_number = $1 AND platform_id = $2',
      [phoneNumber, platformId]
    );

    if (contactResult.rows.length > 0) {
      return { id: contactResult.rows[0].id };
    }

    // Crear nuevo contacto
    const newContact = await query(
      `INSERT INTO contacts (
        platform_id, platform_contact_id, display_name, phone_number
      ) VALUES ($1, $2, $3, $4)
      RETURNING id`,
      [platformId, phoneNumber, `+${phoneNumber}`, phoneNumber]
    );

    console.log(`✅ Nuevo contacto creado: ${newContact.rows[0].id}`);
    return { id: newContact.rows[0].id };

  } catch (error) {
    console.error('❌ Error creando/buscando contacto:', error);
    throw error;
  }
}

// Buscar o crear conversación
async function findOrCreateConversation(contactId, platformId) {
  try {
    // Buscar conversación existente
    let conversationResult = await query(
      'SELECT id, platform_id FROM conversations WHERE contact_id = $1 AND platform_id = $2',
      [contactId, platformId]
    );

    if (conversationResult.rows.length > 0) {
      return conversationResult.rows[0];
    }

    // Crear nueva conversación
    const newConversation = await query(
      `INSERT INTO conversations (
        platform_id, contact_id, title
      ) VALUES ($1, $2, $3)
      RETURNING id, platform_id`,
      [platformId, contactId, 'Nueva conversación']
    );

    console.log(`✅ Nueva conversación creada: ${newConversation.rows[0].id}`);
    return newConversation.rows[0];

  } catch (error) {
    console.error('❌ Error creando/buscando conversación:', error);
    throw error;
  }
}

// Enviar mensaje a WhatsApp
router.post('/send', async (req, res) => {
  try {
    const { phoneNumber, message, messageType = 'text', metadata } = req.body;

    if (!phoneNumber || !message) {
      return res.status(400).json({
        error: 'Datos requeridos',
        message: 'phoneNumber y message son obligatorios'
      });
    }

    if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
      return res.status(500).json({
        error: 'Configuración incompleta',
        message: 'WhatsApp API no está configurada correctamente'
      });
    }

    // Preparar payload según el tipo de mensaje
    let payload = {
      messaging_product: 'whatsapp',
      to: phoneNumber,
      type: messageType
    };

    switch (messageType) {
      case 'text':
        payload.text = { body: message };
        break;
      case 'image':
        payload.image = { 
          link: metadata?.imageUrl || message,
          caption: metadata?.caption || ''
        };
        break;
      case 'document':
        payload.document = { 
          link: metadata?.documentUrl || message,
          filename: metadata?.filename || 'document'
        };
        break;
      case 'audio':
        payload.audio = { link: metadata?.audioUrl || message };
        break;
      case 'video':
        payload.video = { 
          link: metadata?.videoUrl || message,
          caption: metadata?.caption || ''
        };
        break;
      case 'location':
        payload.location = {
          latitude: metadata?.latitude,
          longitude: metadata?.longitude,
          name: metadata?.name || '',
          address: metadata?.address || ''
        };
        break;
      default:
        payload.type = 'text';
        payload.text = { body: message };
    }

    // Enviar mensaje a WhatsApp
    const response = await axios.post(
      `${WHATSAPP_API_URL}/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const { messages } = response.data;
    const messageId = messages[0].id;

    console.log(`✅ Mensaje enviado a WhatsApp: ${messageId}`);

    res.json({
      message: 'Mensaje enviado exitosamente',
      messageId,
      status: 'sent'
    });

  } catch (error) {
    console.error('❌ Error enviando mensaje a WhatsApp:', error);
    
    if (error.response) {
      const { status, data } = error.response;
      res.status(status).json({
        error: 'Error de WhatsApp API',
        message: data?.error?.message || 'Error desconocido',
        details: data
      });
    } else {
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'Error enviando el mensaje a WhatsApp'
      });
    }
  }
});

// Obtener estado de mensaje
router.get('/message/:messageId/status', async (req, res) => {
  try {
    const { messageId } = req.params;

    if (!WHATSAPP_ACCESS_TOKEN) {
      return res.status(500).json({
        error: 'Configuración incompleta',
        message: 'WhatsApp API no está configurada correctamente'
      });
    }

    // Obtener estado del mensaje desde WhatsApp
    const response = await axios.get(
      `${WHATSAPP_API_URL}/${messageId}`,
      {
        headers: {
          'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`
        }
      }
    );

    const { status, pricing } = response.data;

    res.json({
      message: 'Estado del mensaje obtenido exitosamente',
      messageId,
      status,
      pricing
    });

  } catch (error) {
    console.error('❌ Error obteniendo estado del mensaje:', error);
    
    if (error.response) {
      const { status, data } = error.response;
      res.status(status).json({
        error: 'Error de WhatsApp API',
        message: data?.error?.message || 'Error desconocido',
        details: data
      });
    } else {
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'Error obteniendo el estado del mensaje'
      });
    }
  }
});

// Obtener información del número de teléfono
router.get('/phone-number', async (req, res) => {
  try {
    if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
      return res.status(500).json({
        error: 'Configuración incompleta',
        message: 'WhatsApp API no está configurada correctamente'
      });
    }

    // Obtener información del número de teléfono
    const response = await axios.get(
      `${WHATSAPP_API_URL}/${WHATSAPP_PHONE_NUMBER_ID}`,
      {
        headers: {
          'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`
        }
      }
    );

    const { verified_name, code_verification_status, quality_rating } = response.data;

    res.json({
      message: 'Información del número obtenida exitosamente',
      phoneNumber: {
        id: WHATSAPP_PHONE_NUMBER_ID,
        verifiedName: verified_name,
        verificationStatus: code_verification_status,
        qualityRating: quality_rating
      }
    });

  } catch (error) {
    console.error('❌ Error obteniendo información del número:', error);
    
    if (error.response) {
      const { status, data } = error.response;
      res.status(status).json({
        error: 'Error de WhatsApp API',
        message: data?.error?.message || 'Error desconocido',
        details: data
      });
    } else {
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'Error obteniendo la información del número'
      });
    }
  }
});

// Obtener plantillas de mensajes
router.get('/templates', async (req, res) => {
  try {
    if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
      return res.status(500).json({
        error: 'Configuración incompleta',
        message: 'WhatsApp API no está configurada correctamente'
      });
    }

    // Obtener plantillas de mensajes
    const response = await axios.get(
      `${WHATSAPP_API_URL}/${WHATSAPP_PHONE_NUMBER_ID}/message_templates`,
      {
        headers: {
          'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`
        }
      }
    );

    const { data: templates } = response.data;

    res.json({
      message: 'Plantillas obtenidas exitosamente',
      templates: templates.map(template => ({
        id: template.id,
        name: template.name,
        language: template.language,
        status: template.status,
        category: template.category,
        components: template.components
      }))
    });

  } catch (error) {
    console.error('❌ Error obteniendo plantillas:', error);
    
    if (error.response) {
      const { status, data } = error.response;
      res.status(status).json({
        error: 'Error de WhatsApp API',
        message: data?.error?.message || 'Error desconocido',
        details: data
      });
    } else {
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'Error obteniendo las plantillas'
      });
    }
  }
});

// Enviar mensaje usando plantilla
router.post('/send-template', async (req, res) => {
  try {
    const { phoneNumber, templateName, language, components } = req.body;

    if (!phoneNumber || !templateName) {
      return res.status(400).json({
        error: 'Datos requeridos',
        message: 'phoneNumber y templateName son obligatorios'
      });
    }

    if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
      return res.status(500).json({
        error: 'Configuración incompleta',
        message: 'WhatsApp API no está configurada correctamente'
      });
    }

    const payload = {
      messaging_product: 'whatsapp',
      to: phoneNumber,
      type: 'template',
      template: {
        name: templateName,
        language: language || 'es',
        components: components || []
      }
    };

    // Enviar mensaje con plantilla
    const response = await axios.post(
      `${WHATSAPP_API_URL}/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const { messages } = response.data;
    const messageId = messages[0].id;

    console.log(`✅ Mensaje con plantilla enviado a WhatsApp: ${messageId}`);

    res.json({
      message: 'Mensaje con plantilla enviado exitosamente',
      messageId,
      status: 'sent'
    });

  } catch (error) {
    console.error('❌ Error enviando mensaje con plantilla:', error);
    
    if (error.response) {
      const { status, data } = error.response;
      res.status(status).json({
        error: 'Error de WhatsApp API',
        message: data?.error?.message || 'Error desconocido',
        details: data
      });
    } else {
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'Error enviando el mensaje con plantilla'
      });
    }
  }
});

module.exports = router;
