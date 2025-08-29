const { query } = require('../config/database');

async function createContactsTable() {
  try {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS contacts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        platform_id INTEGER NOT NULL REFERENCES platforms(id) ON DELETE CASCADE,
        platform_contact_id VARCHAR(255) NOT NULL,
        display_name VARCHAR(255) NOT NULL,
        phone_number VARCHAR(20),
        email VARCHAR(255),
        avatar_url TEXT,
        is_favorite BOOLEAN DEFAULT false,
        is_blocked BOOLEAN DEFAULT false,
        last_interaction TIMESTAMP,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        UNIQUE(user_id, platform_id, platform_contact_id)
      );
    `;

    await query(createTableQuery);
    console.log('✅ Tabla contacts creada exitosamente');

    // Crear índices para mejorar rendimiento
    const createIndexesQuery = `
      CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts(user_id);
      CREATE INDEX IF NOT EXISTS idx_contacts_platform_id ON contacts(platform_id);
      CREATE INDEX IF NOT EXISTS idx_contacts_platform_contact_id ON contacts(platform_contact_id);
      CREATE INDEX IF NOT EXISTS idx_contacts_favorite ON contacts(is_favorite);
      CREATE INDEX IF NOT EXISTS idx_contacts_last_interaction ON contacts(last_interaction);
    `;

    await query(createIndexesQuery);
    console.log('✅ Índices de contacts creados exitosamente');

  } catch (error) {
    console.error('❌ Error creando tabla contacts:', error);
    throw error;
  }
}

async function dropContactsTable() {
  try {
    await query('DROP TABLE IF EXISTS contacts CASCADE;');
    console.log('🗑️ Tabla contacts eliminada');
  } catch (error) {
    console.error('❌ Error eliminando tabla contacts:', error);
    throw error;
  }
}

module.exports = {
  up: createContactsTable,
  down: dropContactsTable
};
