require('dotenv').config();
const express = require('express');
const { testConnection } = require('./config/database');

// Crear aplicación Express simple
const app = express();

// Ruta de prueba
app.get('/test', (req, res) => {
  res.json({ message: 'Test endpoint working' });
});

// Configurar puerto
const PORT = 3002;

// Iniciar servidor
app.listen(PORT, async () => {
  console.log(`🚀 Servidor de prueba iniciado en puerto ${PORT}`);
  
  try {
    await testConnection();
    console.log('✅ Conexión a base de datos exitosa');
  } catch (error) {
    console.error('❌ Error en base de datos:', error.message);
  }
});
