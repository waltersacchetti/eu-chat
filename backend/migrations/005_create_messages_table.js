const { query } = require('../config/database');

async function createMessagesTable() {
  try {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        platform_id INTEGER NOT NULL REFERENCES platforms(id) ON DELETE CASCADE,
        platform_message_id VARCHAR(255) NOT NULL,
        sender_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
        sender_platform_id VARCHAR(255),
        message_type VARCHAR(50) DEFAULT 'text',
        content TEXT,
        encrypted_content TEXT,
        encryption_key_id VARCHAR(255),
        is_encrypted BOOLEAN DEFAULT true,
        is_from_user BOOLEAN DEFAULT false,
        is_delivered BOOLEAN DEFAULT false,
        is_read BOOLEAN DEFAULT false,
        delivered_at TIMESTAMP,
        read_at TIMESTAMP,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        UNIQUE(conversation_id, platform_id, platform_message_id)
      );
    `;

    await query(createTableQuery);
    console.log('✅ Tabla messages creada exitosamente');

    // Crear índices para mejorar rendimiento
    const createIndexesQuery = `
      CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_messages_platform_id ON messages(platform_id);
      CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
      CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
      CREATE INDEX IF NOT EXISTS idx_messages_type ON messages(message_type);
      CREATE INDEX IF NOT EXISTS idx_messages_encrypted ON messages(is_encrypted);
    `;

    await query(createIndexesQuery);
    console.log('✅ Índices de messages creados exitosamente');

  } catch (error) {
    console.error('❌ Error creando tabla messages:', error);
    throw error;
  }
}

async function dropMessagesTable() {
  try {
    await query('DROP TABLE IF EXISTS messages CASCADE;');
    console.log('🗑️ Tabla messages eliminada');
  } catch (error) {
    console.error('❌ Error eliminando tabla messages:', error);
    throw error;
  }
}

module.exports = {
  up: createMessagesTable,
  down: dropMessagesTable
};
