const { Pool } = require('pg');

// Configuración de la base de datos RDS
const dbConfig = {
  host: process.env.DB_HOST || 'spainbingo-db.clzgxn85wdjh.eu-west-1.rds.amazonaws.com',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'spainbingo',
  user: process.env.DB_USER || 'spainbingo_admin',
  password: process.env.DB_PASSWORD || '',
  ssl: process.env.DB_SSL === 'true' ? {
    rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'false' ? false : true,
    ca: undefined,
    key: undefined,
    cert: undefined
  } : false,
  max: 20, // máximo de conexiones en el pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

// Crear pool de conexiones
const pool = new Pool(dbConfig);

// Eventos del pool
pool.on('connect', (client) => {
  console.log('🟢 Nueva conexión a RDS establecida');
});

pool.on('error', (err, client) => {
  console.error('🔴 Error inesperado en el cliente de RDS:', err);
});

pool.on('remove', (client) => {
  console.log('🟡 Cliente de RDS removido del pool');
});

// Función para probar la conexión
async function testConnection() {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();
    console.log('✅ Conexión a RDS exitosa:', result.rows[0].now);
    return true;
  } catch (error) {
    console.error('❌ Error conectando a RDS:', error.message);
    return false;
  }
}

// Función para ejecutar queries
async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log(`📊 Query ejecutada en ${duration}ms:`, text.substring(0, 50) + '...');
    return res;
  } catch (error) {
    console.error('❌ Error ejecutando query:', error.message);
    throw error;
  }
}

module.exports = {
  pool,
  query,
  testConnection,
  dbConfig
};
