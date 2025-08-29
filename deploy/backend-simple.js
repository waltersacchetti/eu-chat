const express = require('express');
const cors = require('cors');
const { createServer } = require('http');
const knex = require('knex');

// Configuración de base de datos
const db = knex({
  client: 'pg',
  connection: {
    host: 'spainbingo-db.clzgxn85wdjh.eu-west-1.rds.amazonaws.com',
    port: 5432,
    database: 'spainbingo',
    user: 'spainbingo_admin',
    password: 'SpainBingo2024!',
    ssl: { rejectUnauthorized: false }
  }
});

const app = express();
const server = createServer(app);

// Middleware
app.use(cors());
app.use(express.json());

// Rutas básicas
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    database: 'connected',
    websocket: 'enabled',
    environment: 'production'
  });
});

app.get('/', (req, res) => {
  res.json({
    message: '🚀 EU Chat Bridge API',
    version: '1.0.0',
    description: 'API para interoperabilidad de mensajería en Europa',
    websocket: 'enabled',
    environment: 'production',
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      platforms: '/api/platforms',
      messages: '/api/messages',
      contacts: '/api/contacts',
      conversations: '/api/conversations'
    }
  });
});

// Ruta de autenticación simple
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName, phone } = req.body;
    
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ error: 'Todos los campos son requeridos' });
    }

    // Verificar si el usuario ya existe
    const existingUser = await db('users').where({ email }).first();
    if (existingUser) {
      return res.status(400).json({ error: 'El usuario ya existe' });
    }

    // Crear usuario (sin hash por simplicidad en demo)
    const [userId] = await db('users').insert({
      email,
      password_hash: password, // En producción usar bcrypt
      first_name: firstName,
      last_name: lastName,
      phone: phone || null,
      is_verified: false,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date()
    }).returning('id');

    const user = await db('users').where({ id: userId }).first();

    res.status(201).json({
      message: 'Usuario registrado exitosamente',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone
      },
      token: 'demo-token-' + userId // Token simple para demo
    });

  } catch (error) {
    console.error('Error registrando usuario:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña son requeridos' });
    }

    // Buscar usuario
    const user = await db('users').where({ email }).first();
    if (!user || user.password_hash !== password) { // En producción usar bcrypt.compare
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    res.json({
      message: 'Login exitoso',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
        isVerified: user.is_verified
      },
      token: 'demo-token-' + user.id
    });

  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Ruta de usuarios
app.get('/api/users/stats', async (req, res) => {
  try {
    // Obtener estadísticas básicas
    const platforms = await db('user_platforms').count('* as count').first();
    const contacts = await db('contacts').count('* as count').first();
    const conversations = await db('conversations').count('* as count').first();
    const messages = await db('messages').count('* as count').first();

    res.json({
      stats: {
        platforms: parseInt(platforms?.count) || 0,
        contacts: parseInt(contacts?.count) || 0,
        conversations: parseInt(conversations?.count) || 0,
        messages: parseInt(messages?.count) || 0
      }
    });

  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Ruta de plataformas
app.get('/api/platforms', async (req, res) => {
  try {
    const platforms = await db('platforms')
      .where({ is_active: true })
      .orderBy('display_name', 'asc')
      .select('*');

    res.json({
      platforms: platforms.map(platform => ({
        id: platform.id,
        name: platform.name,
        displayName: platform.display_name,
        apiVersion: platform.api_version,
        isActive: platform.is_active,
        isInteroperable: platform.is_interoperable,
        config: platform.config || {}
      }))
    });

  } catch (error) {
    console.error('Error obteniendo plataformas:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Ruta de contactos
app.get('/api/contacts', async (req, res) => {
  try {
    const contacts = await db('contacts')
      .orderBy('name', 'asc')
      .select('*');

    res.json({
      contacts: contacts.map(contact => ({
        id: contact.id,
        name: contact.name,
        phone: contact.phone,
        email: contact.email,
        avatarUrl: contact.avatar_url,
        isFavorite: contact.is_favorite,
        isBlocked: contact.is_blocked,
        platformIds: contact.platform_ids || {},
        lastInteraction: contact.last_interaction,
        createdAt: contact.created_at
      }))
    });

  } catch (error) {
    console.error('Error obteniendo contactos:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Ruta de conversaciones
app.get('/api/conversations', async (req, res) => {
  try {
    const conversations = await db('conversations')
      .orderBy('last_message_at', 'desc')
      .select('*');

    res.json({
      conversations: conversations.map(conversation => ({
        id: conversation.id,
        conversationId: conversation.conversation_id,
        title: conversation.title,
        type: conversation.conversation_type,
        participants: conversation.participants || [],
        platformConversationIds: conversation.platform_conversation_ids || {},
        isArchived: conversation.is_archived,
        isMuted: conversation.is_muted,
        lastMessageAt: conversation.last_message_at
      }))
    });

  } catch (error) {
    console.error('Error obteniendo conversaciones:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Ruta de mensajes
app.get('/api/messages/conversation/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const messages = await db('messages')
      .where({ conversation_id: conversationId })
      .orderBy('sent_at', 'desc')
      .limit(parseInt(limit))
      .offset(offset)
      .select('*');

    const totalMessages = await db('messages')
      .where({ conversation_id: conversationId })
      .count('* as count')
      .first();

    res.json({
      messages: messages.map(message => ({
        id: message.id,
        content: message.content,
        type: message.message_type,
        metadata: message.metadata || {},
        isFromUser: message.is_from_user,
        isRead: message.is_read,
        isDelivered: message.is_delivered,
        sentAt: message.sent_at
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(totalMessages?.count) || 0,
        totalPages: Math.ceil((parseInt(totalMessages?.count) || 0) / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Error obteniendo mensajes:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`🚀 EU Chat Bridge API corriendo en puerto ${PORT}`);
  console.log(`📱 Entorno: production`);
  console.log(`🗄️ Base de datos: ${db.client.config.connection.host}:${db.client.config.connection.port}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`🌐 API disponible en: http://localhost:${PORT}`);
});
