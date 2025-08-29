const { query } = require('../config/database');

async function createConversationsTable() {
  try {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS conversations (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        platform_id INTEGER NOT NULL REFERENCES platforms(id) ON DELETE CASCADE,
        platform_conversation_id VARCHAR(255) NOT NULL,
        contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
        title VARCHAR(255),
        is_group BOOLEAN DEFAULT false,
        group_participants JSONB,
        last_message_text TEXT,
        last_message_timestamp TIMESTAMP,
        unread_count INTEGER DEFAULT 0,
        is_archived BOOLEAN DEFAULT false,
        is_muted BOOLEAN DEFAULT false,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        UNIQUE(user_id, platform_id, platform_conversation_id)
      );
    `;

    await query(createTableQuery);
    console.log('✅ Tabla conversations creada exitosamente');

    // Crear índices para mejorar rendimiento
    const createIndexesQuery = `
      CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
      CREATE INDEX IF NOT EXISTS idx_conversations_platform_id ON conversations(platform_id);
      CREATE INDEX IF NOT EXISTS idx_conversations_contact_id ON conversations(contact_id);
      CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON conversations(last_message_timestamp);
      CREATE INDEX IF NOT EXISTS idx_conversations_unread ON conversations(unread_count);
      CREATE INDEX IF NOT EXISTS idx_conversations_archived ON conversations(is_archived);
    `;

    await query(createIndexesQuery);
    console.log('✅ Índices de conversations creados exitosamente');

  } catch (error) {
    console.error('❌ Error creando tabla conversations:', error);
    throw error;
  }
}

async function dropConversationsTable() {
  try {
    await query('DROP TABLE IF EXISTS conversations CASCADE;');
    console.log('🗑️ Tabla conversations eliminada');
  } catch (error) {
    console.error('❌ Error eliminando tabla conversations:', error);
    throw error;
  }
}

module.exports = {
  up: createConversationsTable,
  down: dropConversationsTable
};
