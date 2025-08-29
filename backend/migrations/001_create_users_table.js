const { query } = require('../config/database');

async function createUsersTable() {
  try {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        username VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        phone_number VARCHAR(20),
        avatar_url TEXT,
        is_active BOOLEAN DEFAULT true,
        is_verified BOOLEAN DEFAULT false,
        verification_token VARCHAR(255),
        refresh_token VARCHAR(500),
        last_login TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await query(createTableQuery);
    console.log('✅ Tabla users creada exitosamente');

    // Crear índices para mejorar rendimiento
    const createIndexesQuery = `
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
      CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone_number);
      CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
    `;

    await query(createIndexesQuery);
    console.log('✅ Índices de users creados exitosamente');

  } catch (error) {
    console.error('❌ Error creando tabla users:', error);
    throw error;
  }
}

async function dropUsersTable() {
  try {
    await query('DROP TABLE IF EXISTS users CASCADE;');
    console.log('🗑️ Tabla users eliminada');
  } catch (error) {
    console.error('❌ Error eliminando tabla users:', error);
    throw error;
  }
}

module.exports = {
  up: createUsersTable,
  down: dropUsersTable
};
