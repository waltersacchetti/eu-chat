const { query } = require('../config/database');

async function createPlatformsTable() {
  try {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS platforms (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        display_name VARCHAR(100) NOT NULL,
        api_url TEXT,
        api_version VARCHAR(20),
        is_active BOOLEAN DEFAULT true,
        requires_verification BOOLEAN DEFAULT true,
        supports_e2ee BOOLEAN DEFAULT true,
        icon_url TEXT,
        color_hex VARCHAR(7),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await query(createTableQuery);
    console.log('✅ Tabla platforms creada exitosamente');

    // Crear índices
    const createIndexesQuery = `
      CREATE INDEX IF NOT EXISTS idx_platforms_name ON platforms(name);
      CREATE INDEX IF NOT EXISTS idx_platforms_active ON platforms(is_active);
    `;

    await query(createIndexesQuery);
    console.log('✅ Índices de platforms creados exitosamente');

  } catch (error) {
    console.error('❌ Error creando tabla platforms:', error);
    throw error;
  }
}

async function dropPlatformsTable() {
  try {
    await query('DROP TABLE IF EXISTS platforms CASCADE;');
    console.log('🗑️ Tabla platforms eliminada');
  } catch (error) {
    console.error('❌ Error eliminando tabla platforms:', error);
    throw error;
  }
}

module.exports = {
  up: createPlatformsTable,
  down: dropPlatformsTable
};
