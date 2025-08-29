require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { testConnection } = require('../config/database');

// Importar rutas
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const contactRoutes = require('./routes/contacts');
const conversationRoutes = require('./routes/conversations');
const messageRoutes = require('./routes/messages');
const platformRoutes = require('./routes/platforms');
const whatsappRoutes = require('./routes/whatsapp');

// Importar middleware
const errorHandler = require('./middleware/errorHandler');
const authMiddleware = require('./middleware/auth');

// Crear aplicación Express
const app = express();
const server = createServer(app);

// Configurar Socket.IO para WebSockets
const io = new Server(server, {
  cors: {
    origin: process.env.SOCKET_CORS_ORIGIN || "*",
    methods: ["GET", "POST"]
  }
});

// Configurar rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutos
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // máximo 100 requests por ventana
  message: {
    error: 'Demasiadas requests desde esta IP, intenta de nuevo más tarde.'
  }
});

// Middleware de seguridad y optimización
app.use(helmet());
app.use(compression());
app.use(limiter);
app.use(cors({
  origin: process.env.CORS_ORIGIN || "*",
  credentials: true
}));

// Middleware para parsing de JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Middleware de logging
app.use((req, res, next) => {
  console.log(`📨 ${req.method} ${req.path} - ${new Date().toISOString()}`);
  next();
});

// Ruta de health check
app.get('/health', async (req, res) => {
  try {
    const dbConnected = await testConnection();
    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: dbConnected ? 'connected' : 'disconnected',
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      message: error.message
    });
  }
});

// Ruta raíz
app.get('/', (req, res) => {
  res.json({
    name: 'EU Chat Bridge API',
    version: '1.0.0',
    description: 'Hub unificado de mensajería para Europa',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

// Rutas de la API
app.use('/api/auth', authRoutes);
app.use('/api/users', authMiddleware, userRoutes);
app.use('/api/contacts', authMiddleware, contactRoutes);
app.use('/api/conversations', authMiddleware, conversationRoutes);
app.use('/api/messages', authMiddleware, messageRoutes);
app.use('/api/platforms', authMiddleware, platformRoutes);
app.use('/api/whatsapp', authMiddleware, whatsappRoutes);

// WebSocket para chat en tiempo real
io.use((socket, next) => {
  // Aquí iría la autenticación del socket
  next();
});

io.on('connection', (socket) => {
  console.log('🔌 Usuario conectado al WebSocket:', socket.id);
  
  socket.on('join_conversation', (conversationId) => {
    socket.join(`conversation_${conversationId}`);
    console.log(`👥 Usuario ${socket.id} se unió a conversación ${conversationId}`);
  });
  
  socket.on('leave_conversation', (conversationId) => {
    socket.leave(`conversation_${conversationId}`);
    console.log(`👋 Usuario ${socket.id} salió de conversación ${conversationId}`);
  });
  
  socket.on('disconnect', () => {
    console.log('🔌 Usuario desconectado del WebSocket:', socket.id);
  });
});

// Middleware de manejo de errores (debe ir al final)
app.use(errorHandler);

// Manejo de rutas no encontradas
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Ruta no encontrada',
    path: req.originalUrl,
    method: req.method
  });
});

// Configuración del puerto
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

// Iniciar servidor
server.listen(PORT, HOST, async () => {
  console.log('🚀 EU Chat Bridge Backend iniciado');
  console.log(`📍 Servidor corriendo en http://${HOST}:${PORT}`);
  console.log(`🌍 Entorno: ${process.env.NODE_ENV || 'development'}`);
  
  // Probar conexión a la base de datos
  try {
    await testConnection();
    console.log('✅ Backend listo para recibir requests');
  } catch (error) {
    console.error('❌ Error conectando a la base de datos:', error.message);
    process.exit(1);
  }
});

// Manejo de señales de terminación
process.on('SIGTERM', () => {
  console.log('🛑 Señal SIGTERM recibida, cerrando servidor...');
  server.close(() => {
    console.log('✅ Servidor cerrado exitosamente');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 Señal SIGINT recibida, cerrando servidor...');
  server.close(() => {
    console.log('✅ Servidor cerrado exitosamente');
    process.exit(0);
  });
});

module.exports = { app, server, io };
