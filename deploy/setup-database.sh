#!/bin/bash

# Script para configurar la base de datos de EU Chat Bridge
# Crea las tablas necesarias y datos de prueba

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuración de la base de datos
DB_HOST="spainbingo-db.clzgxn85wdjh.eu-west-1.rds.amazonaws.com"
DB_PORT="5432"
DB_NAME="spainbingo"
DB_USER="spainbingo_admin"
DB_PASSWORD="SpainBingo2024!"

echo -e "${BLUE}🗄️ Configuración de Base de Datos - EU Chat Bridge${NC}"
echo "======================================================"
echo -e "${YELLOW}Host: ${DB_HOST}${NC}"
echo -e "${YELLOW}Base de datos: ${DB_NAME}${NC}"
echo -e "${YELLOW}Usuario: ${DB_USER}${NC}"
echo ""

# Función para ejecutar comandos SSH
ssh_exec() {
    ssh -i deploy/spainbingo-key.pem -o StrictHostKeyChecking=no ec2-user@54.247.227.217 "$1"
}

echo -e "${BLUE}📋 Verificando conexión a la base de datos...${NC}"

# Verificar conexión a la base de datos
DB_CONNECTION_TEST=$(ssh_exec "
    cd ~/eu-chat
    PGPASSWORD='${DB_PASSWORD}' psql -h ${DB_HOST} -U ${DB_USER} -d ${DB_NAME} -c 'SELECT 1 as test;' 2>&1
")

if echo "$DB_CONNECTION_TEST" | grep -q "test"; then
    echo -e "${GREEN}✅ Conexión a la base de datos exitosa${NC}"
else
    echo -e "${RED}❌ Error conectando a la base de datos${NC}"
    echo "$DB_CONNECTION_TEST"
    exit 1
fi

echo -e "${BLUE}🔧 Creando tablas de la base de datos...${NC}"

# Crear tabla de plataformas
ssh_exec "
    cd ~/eu-chat
    PGPASSWORD='${DB_PASSWORD}' psql -h ${DB_HOST} -U ${DB_USER} -d ${DB_NAME} << 'EOF'
    
    -- Tabla de plataformas de mensajería
    CREATE TABLE IF NOT EXISTS platforms (
        id SERIAL PRIMARY KEY,
        name VARCHAR(50) UNIQUE NOT NULL,
        display_name VARCHAR(100) NOT NULL,
        api_version VARCHAR(20),
        is_active BOOLEAN DEFAULT true,
        is_interoperable BOOLEAN DEFAULT false,
        config JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    -- Tabla de usuarios
    CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        phone VARCHAR(20),
        is_verified BOOLEAN DEFAULT false,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    -- Tabla de conexiones de usuario a plataformas
    CREATE TABLE IF NOT EXISTS user_platforms (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        platform_id INTEGER REFERENCES platforms(id) ON DELETE CASCADE,
        platform_user_id VARCHAR(255) NOT NULL,
        access_token TEXT,
        refresh_token TEXT,
        is_active BOOLEAN DEFAULT true,
        last_sync_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, platform_id)
    );
    
    -- Tabla de contactos
    CREATE TABLE IF NOT EXISTS contacts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(20),
        email VARCHAR(255),
        avatar_url TEXT,
        is_favorite BOOLEAN DEFAULT false,
        is_blocked BOOLEAN DEFAULT false,
        platform_ids JSONB DEFAULT '{}',
        last_interaction TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    -- Tabla de conversaciones
    CREATE TABLE IF NOT EXISTS conversations (
        id SERIAL PRIMARY KEY,
        conversation_id VARCHAR(255) UNIQUE NOT NULL,
        title VARCHAR(255) NOT NULL,
        conversation_type VARCHAR(20) DEFAULT 'individual',
        participants JSONB DEFAULT '[]',
        platform_conversation_ids JSONB DEFAULT '{}',
        is_archived BOOLEAN DEFAULT false,
        is_muted BOOLEAN DEFAULT false,
        last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    -- Tabla de mensajes
    CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
        platform_message_id VARCHAR(255),
        content TEXT NOT NULL,
        message_type VARCHAR(20) DEFAULT 'text',
        metadata JSONB DEFAULT '{}',
        is_from_user BOOLEAN DEFAULT false,
        is_read BOOLEAN DEFAULT false,
        is_delivered BOOLEAN DEFAULT false,
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    -- Índices para mejorar rendimiento
    CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts(user_id);
    CREATE INDEX IF NOT EXISTS idx_contacts_name ON contacts(name);
    CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON conversations(last_message_at);
    CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_messages_sent_at ON messages(sent_at);
    CREATE INDEX IF NOT EXISTS idx_user_platforms_user_id ON user_platforms(user_id);
    
EOF
"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Tablas creadas exitosamente${NC}"
else
    echo -e "${RED}❌ Error creando tablas${NC}"
    exit 1
fi

echo -e "${BLUE}🌱 Insertando datos de prueba...${NC}"

# Insertar plataformas de prueba
ssh_exec "
    cd ~/eu-chat
    PGPASSWORD='${DB_PASSWORD}' psql -h ${DB_HOST} -U ${DB_USER} -d ${DB_NAME} << 'EOF'
    
    -- Insertar plataformas de mensajería
    INSERT INTO platforms (name, display_name, api_version, is_active, is_interoperable) VALUES
    ('whatsapp', 'WhatsApp', '2.0', true, true),
    ('messenger', 'Facebook Messenger', '2.0', true, true),
    ('telegram', 'Telegram', '6.0', true, false),
    ('signal', 'Signal', '1.0', true, false),
    ('imessage', 'iMessage', '1.0', true, false)
    ON CONFLICT (name) DO NOTHING;
    
    -- Insertar usuario de prueba
    INSERT INTO users (email, password_hash, first_name, last_name, phone, is_verified, is_active) VALUES
    ('demo@eu-chat.com', 'demo123', 'Usuario', 'Demo', '+34600123456', true, true)
    ON CONFLICT (email) DO NOTHING;
    
    -- Insertar contactos de prueba
    INSERT INTO contacts (user_id, name, phone, email, is_favorite, platform_ids) VALUES
    (1, 'María García', '+34600123456', 'maria@email.com', true, '{\"whatsapp\": \"wa_user_1\", \"telegram\": \"tg_user_1\"}'),
    (1, 'Juan López', '+34600789012', 'juan@email.com', false, '{\"messenger\": \"fb_user_1\"}'),
    (1, 'Ana Martínez', '+34600345678', 'ana@email.com', true, '{\"whatsapp\": \"wa_user_2\", \"signal\": \"sg_user_1\"}'),
    (1, 'Carlos Rodríguez', '+34600901234', 'carlos@email.com', false, '{\"imessage\": \"im_user_1\"}')
    ON CONFLICT DO NOTHING;
    
    -- Insertar conversaciones de prueba
    INSERT INTO conversations (conversation_id, title, conversation_type, participants, platform_conversation_ids, last_message_at) VALUES
    ('conv_1', 'María García', 'individual', '[\"user_1\", \"maria_garcia\"]', '{\"whatsapp\": \"wa_conv_1\"}', NOW() - INTERVAL '5 minutes'),
    ('conv_2', 'Equipo Desarrollo', 'group', '[\"user_1\", \"dev_1\", \"dev_2\", \"dev_3\"]', '{\"telegram\": \"tg_group_1\"}', NOW() - INTERVAL '2 hours'),
    ('conv_3', 'Juan López', 'individual', '[\"user_1\", \"juan_lopez\"]', '{\"messenger\": \"fb_conv_1\"}', NOW() - INTERVAL '1 day')
    ON CONFLICT (conversation_id) DO NOTHING;
    
    -- Insertar mensajes de prueba
    INSERT INTO messages (conversation_id, content, message_type, is_from_user, is_read, sent_at) VALUES
    (1, '¡Hola! ¿Cómo estás?', 'text', false, false, NOW() - INTERVAL '5 minutes'),
    (2, 'Tú: Perfecto, mañana revisamos el código', 'text', true, true, NOW() - INTERVAL '2 hours'),
    (3, 'Nos vemos el lunes', 'text', false, true, NOW() - INTERVAL '1 day')
    ON CONFLICT DO NOTHING;
    
EOF
"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Datos de prueba insertados exitosamente${NC}"
else
    echo -e "${RED}❌ Error insertando datos de prueba${NC}"
    exit 1
fi

echo -e "${BLUE}🔍 Verificando datos insertados...${NC}"

# Verificar datos insertados
ssh_exec "
    cd ~/eu-chat
    PGPASSWORD='${DB_PASSWORD}' psql -h ${DB_HOST} -U ${DB_USER} -d ${DB_NAME} << 'EOF'
    
    SELECT 'Plataformas:' as info, COUNT(*) as count FROM platforms;
    SELECT 'Usuarios:' as info, COUNT(*) as count FROM users;
    SELECT 'Contactos:' as info, COUNT(*) as count FROM contacts;
    SELECT 'Conversaciones:' as info, COUNT(*) as count FROM conversations;
    SELECT 'Mensajes:' as info, COUNT(*) as count FROM messages;
    
EOF
"

echo -e "${GREEN}🎉 Configuración de base de datos completada!${NC}"
echo ""
echo -e "${BLUE}📋 Resumen de la configuración:${NC}"
echo -e "   🗄️ Base de datos: ${DB_NAME}"
echo -e "   📱 Plataformas: WhatsApp, Messenger, Telegram, Signal, iMessage"
echo -e "   👥 Usuario demo: demo@eu-chat.com / demo123"
echo -e "   💬 Contactos de prueba: 4 contactos"
echo -e "   🗨️ Conversaciones de prueba: 3 conversaciones"
echo -e "   📝 Mensajes de prueba: 3 mensajes"
echo ""
echo -e "${BLUE}🔧 Próximos pasos:${NC}"
echo -e "   1. Probar endpoints de la API"
echo -e "   2. Configurar frontend móvil"
echo -e "   3. Implementar autenticación real"
