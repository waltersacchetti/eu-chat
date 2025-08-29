const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Configuración de la base de datos
const pool = new Pool({
  host: 'spainbingo-db.clzgxn85wdjh.eu-west-1.rds.amazonaws.com',
  port: 5432,
  database: 'spainbingo',
  user: 'spainbingo_admin',
  password: 'SpainBingo2024!',
  ssl: {
    rejectUnauthorized: false
  }
});

// Clave secreta para JWT (en producción debería estar en variables de entorno)
const JWT_SECRET = 'eu-chat-bridge-secret-key-2024';

// Middleware de autenticación
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token de acceso requerido' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token inválido o expirado' });
    }
    req.user = user;
    next();
  });
};

// Función para generar hash de contraseña
const hashPassword = async (password) => {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
};

// Función para verificar contraseña
const verifyPassword = async (password, hash) => {
  return await bcrypt.compare(password, hash);
};

// Función para generar token JWT
const generateToken = (user) => {
  return jwt.sign(
    { 
      id: user.id, 
      email: user.email, 
      username: user.username 
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
};

// Ruta de health check
app.get('/health', async (req, res) => {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    
    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      database: 'connected',
      websocket: 'enabled',
      environment: 'production'
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: error.message
    });
  }
});

// Ruta principal
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

// Rutas de autenticación
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName, phone } = req.body;

    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ error: 'Todos los campos son requeridos' });
    }

    // Verificar si el usuario ya existe
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [email, email.split('@')[0]]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'El usuario ya existe' });
    }

    // Generar hash de la contraseña
    const hashedPassword = await hashPassword(password);
    const username = email.split('@')[0];

    // Crear el usuario
    const newUser = await pool.query(
      `INSERT INTO users (username, email, password_hash, first_name, last_name, phone, is_verified, is_active) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, username, email, first_name, last_name, phone, is_verified`,
      [username, email, hashedPassword, firstName, lastName, phone || null, true, true]
    );

    const user = newUser.rows[0];
    const token = generateToken(user);

    res.status(201).json({
      message: 'Usuario registrado exitosamente',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
        isVerified: user.is_verified
      },
      token
    });
  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña son requeridos' });
    }

    // Buscar usuario por email
    const user = await pool.query(
      'SELECT id, username, email, password_hash, first_name, last_name, phone, is_verified, is_active FROM users WHERE email = $1',
      [email]
    );

    if (user.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const userData = user.rows[0];

    // Verificar si el usuario está activo
    if (!userData.is_active) {
      return res.status(401).json({ error: 'Cuenta deshabilitada' });
    }

    // Verificar contraseña
    const isValidPassword = await verifyPassword(password, userData.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Generar token
    const token = generateToken(userData);

    res.json({
      message: 'Login exitoso',
      user: {
        id: userData.id,
        email: userData.email,
        firstName: userData.first_name,
        lastName: userData.last_name,
        phone: userData.phone,
        isVerified: userData.is_verified
      },
      token
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.post('/api/auth/logout', authenticateToken, (req, res) => {
  // En una implementación real, podrías invalidar el token
  res.json({ message: 'Logout exitoso' });
});

// Rutas de usuarios (protegidas)
app.get('/api/users/stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Obtener estadísticas del usuario
    const stats = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM user_platforms WHERE user_id = $1 AND is_active = true) as platforms,
        (SELECT COUNT(*) FROM contacts WHERE user_id = $1) as contacts,
        (SELECT COUNT(*) FROM conversations WHERE participants @> $2) as conversations,
        (SELECT COUNT(*) FROM messages m 
         JOIN conversations c ON m.conversation_id = c.id 
         WHERE c.participants @> $2) as messages
    `, [userId, JSON.stringify([`user_${userId}`])]);

    res.json({
      stats: {
        platforms: parseInt(stats.rows[0].platforms) || 0,
        contacts: parseInt(stats.rows[0].contacts) || 0,
        conversations: parseInt(stats.rows[0].conversations) || 0,
        messages: parseInt(stats.rows[0].messages) || 0
      }
    });
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Rutas de plataformas
app.get('/api/platforms', async (req, res) => {
  try {
    const platforms = await pool.query(
      'SELECT id, name, display_name as "displayName", api_version as "apiVersion", is_active as "isActive", is_interoperable as "isInteroperable", config FROM platforms WHERE is_active = true ORDER BY name'
    );

    res.json({ platforms: platforms.rows });
  } catch (error) {
    console.error('Error obteniendo plataformas:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Rutas de contactos (protegidas)
app.get('/api/contacts', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const contacts = await pool.query(
      'SELECT id, name, phone, email, avatar_url as "avatarUrl", is_favorite as "isFavorite", is_blocked as "isBlocked", platform_ids as "platformIds", last_interaction as "lastInteraction", created_at as "createdAt" FROM contacts WHERE user_id = $1 ORDER BY name',
      [userId]
    );

    res.json({ contacts: contacts.rows });
  } catch (error) {
    console.error('Error obteniendo contactos:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.post('/api/contacts', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, phone, email, platformIds } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'El nombre es requerido' });
    }

    const newContact = await pool.query(
      `INSERT INTO contacts (user_id, name, phone, email, platform_ids, is_favorite, is_blocked) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [userId, name, phone || null, email || null, platformIds || {}, false, false]
    );

    res.status(201).json(newContact.rows[0]);
  } catch (error) {
    console.error('Error creando contacto:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.put('/api/contacts/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const contactId = req.params.id;
    const { name, phone, email, platformIds } = req.body;

    const updatedContact = await pool.query(
      `UPDATE contacts SET name = $1, phone = $2, email = $3, platform_ids = $4, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $5 AND user_id = $6 RETURNING *`,
      [name, phone, email, platformIds, contactId, userId]
    );

    if (updatedContact.rows.length === 0) {
      return res.status(404).json({ error: 'Contacto no encontrado' });
    }

    res.json(updatedContact.rows[0]);
  } catch (error) {
    console.error('Error actualizando contacto:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.delete('/api/contacts/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const contactId = req.params.id;

    const deletedContact = await pool.query(
      'DELETE FROM contacts WHERE id = $1 AND user_id = $2 RETURNING *',
      [contactId, userId]
    );

    if (deletedContact.rows.length === 0) {
      return res.status(404).json({ error: 'Contacto no encontrado' });
    }

    res.json({ message: 'Contacto eliminado exitosamente' });
  } catch (error) {
    console.error('Error eliminando contacto:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.patch('/api/contacts/:id/favorite', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const contactId = req.params.id;

    const updatedContact = await pool.query(
      `UPDATE contacts SET is_favorite = NOT is_favorite, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1 AND user_id = $2 RETURNING *`,
      [contactId, userId]
    );

    if (updatedContact.rows.length === 0) {
      return res.status(404).json({ error: 'Contacto no encontrado' });
    }

    res.json(updatedContact.rows[0]);
  } catch (error) {
    console.error('Error actualizando favorito:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Rutas de conversaciones (protegidas)
app.get('/api/conversations', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const conversations = await pool.query(
      `SELECT id, conversation_id as "conversationId", title, conversation_type as type, participants, 
              platform_conversation_ids as "platformConversationIds", is_archived as "isArchived", 
              is_muted as "isMuted", last_message_at as "lastMessageAt"
       FROM conversations 
       WHERE participants @> $1 
       ORDER BY last_message_at DESC`,
      [JSON.stringify([`user_${userId}`])]
    );

    res.json({ conversations: conversations.rows });
  } catch (error) {
    console.error('Error obteniendo conversaciones:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Rutas de mensajes (protegidas)
app.get('/api/messages/conversation/:conversationId', authenticateToken, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    const messages = await pool.query(
      `SELECT id, content, message_type as type, metadata, is_from_user as "isFromUser", 
              is_read as "isRead", is_delivered as "isDelivered", sent_at as "sentAt"
       FROM messages 
       WHERE conversation_id = $1 
       ORDER BY sent_at DESC 
       LIMIT $2 OFFSET $3`,
      [conversationId, limit, offset]
    );

    const totalMessages = await pool.query(
      'SELECT COUNT(*) FROM messages WHERE conversation_id = $1',
      [conversationId]
    );

    res.json({
      messages: messages.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(totalMessages.rows[0].count),
        pages: Math.ceil(totalMessages.rows[0].count / limit)
      }
    });
  } catch (error) {
    console.error('Error obteniendo mensajes:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.post('/api/messages/send', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { conversationId, content, type = 'text', metadata = {} } = req.body;

    if (!conversationId || !content) {
      return res.status(400).json({ error: 'Conversation ID y contenido son requeridos' });
    }

    const newMessage = await pool.query(
      `INSERT INTO messages (conversation_id, content, message_type, metadata, is_from_user, is_read, is_delivered) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [conversationId, content, type, metadata, true, false, false]
    );

    // Actualizar timestamp de última mensaje en la conversación
    await pool.query(
      'UPDATE conversations SET last_message_at = CURRENT_TIMESTAMP WHERE id = $1',
      [conversationId]
    );

    res.status(201).json(newMessage.rows[0]);
  } catch (error) {
    console.error('Error enviando mensaje:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Manejo de errores
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Algo salió mal!' });
});

// Ruta 404
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 EU Chat Bridge Backend ejecutándose en puerto ${PORT}`);
  console.log(`🌐 API disponible en: http://localhost:${PORT}`);
  console.log(`🔐 Autenticación JWT habilitada`);
  console.log(`🗄️ Base de datos conectada`);
});
