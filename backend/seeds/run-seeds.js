const { pool, testConnection } = require('../config/database');
const bcrypt = require('bcryptjs');

// Función para crear usuario de prueba
async function createTestUser() {
  try {
    const hashedPassword = await bcrypt.hash('password123', 12);
    
    const result = await pool.query(`
      INSERT INTO users (
        email, username, password_hash, first_name, last_name, 
        phone_number, is_active, is_verified
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (email) DO NOTHING
      RETURNING id, email, username
    `, [
      'admin@eu-chat.com',
      'admin',
      hashedPassword,
      'Admin',
      'User',
      '+34600000000',
      true,
      true
    ]);
    
    if (result.rows.length > 0) {
      console.log(`✅ Usuario de prueba creado: ${result.rows[0].email}`);
      return result.rows[0];
    } else {
      console.log(`⏭️ Usuario admin@eu-chat.com ya existe`);
      return null;
    }
  } catch (error) {
    console.error('❌ Error creando usuario de prueba:', error);
    return null;
  }
}

// Función para crear plataformas de mensajería
async function createPlatforms() {
  try {
    const platforms = [
      {
        name: 'whatsapp',
        display_name: 'WhatsApp',
        api_url: 'https://graph.facebook.com/v18.0',
        icon_url: 'https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg',
        color_hex: '#25D366',
        is_active: true,
        requires_verification: true,
        supports_e2ee: true
      },
      {
        name: 'telegram',
        display_name: 'Telegram',
        api_url: 'https://api.telegram.org',
        icon_url: 'https://upload.wikimedia.org/wikipedia/commons/8/82/Telegram_logo.svg',
        color_hex: '#0088CC',
        is_active: true,
        requires_verification: true,
        supports_e2ee: true
      },
      {
        name: 'signal',
        display_name: 'Signal',
        api_url: 'https://signal.org/api',
        icon_url: 'https://upload.wikimedia.org/wikipedia/commons/5/51/Signal_Logo.svg',
        color_hex: '#3A76F0',
        is_active: true,
        requires_verification: true,
        supports_e2ee: true
      },
      {
        name: 'discord',
        display_name: 'Discord',
        api_url: 'https://discord.com/api',
        icon_url: 'https://upload.wikimedia.org/wikipedia/commons/9/98/Discord_logo.svg',
        color_hex: '#5865F2',
        is_active: true,
        requires_verification: true,
        supports_e2ee: false
      },
      {
        name: 'slack',
        display_name: 'Slack',
        api_url: 'https://slack.com/api',
        icon_url: 'https://upload.wikimedia.org/wikipedia/commons/d/d5/Slack_icon_2019.svg',
        color_hex: '#4A154B',
        is_active: true,
        requires_verification: true,
        supports_e2ee: false
      }
    ];
    
    let createdCount = 0;
    
    for (const platform of platforms) {
      const result = await pool.query(`
        INSERT INTO platforms (
          name, display_name, api_url, icon_url, color_hex,
          is_active, requires_verification, supports_e2ee
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (name) DO UPDATE SET
          display_name = EXCLUDED.display_name,
          api_url = EXCLUDED.api_url,
          icon_url = EXCLUDED.icon_url,
          color_hex = EXCLUDED.color_hex,
          is_active = EXCLUDED.is_active,
          requires_verification = EXCLUDED.requires_verification,
          supports_e2ee = EXCLUDED.supports_e2ee,
          updated_at = NOW()
        RETURNING id, name, display_name
      `, [
        platform.name,
        platform.display_name,
        platform.api_url,
        platform.icon_url,
        platform.color_hex,
        platform.is_active,
        platform.requires_verification,
        platform.supports_e2ee
      ]);
      
      if (result.rows.length > 0) {
        console.log(`✅ Plataforma creada/actualizada: ${result.rows[0].display_name}`);
        createdCount++;
      }
    }
    
    console.log(`📊 Total de plataformas procesadas: ${createdCount}`);
    return createdCount;
    
  } catch (error) {
    console.error('❌ Error creando plataformas:', error);
    return 0;
  }
}

// Función para crear contactos de prueba
async function createTestContacts(userId) {
  try {
    if (!userId) {
      console.log('⏭️ No hay usuario para crear contactos');
      return 0;
    }
    
    const contacts = [
      {
        platform_contact_id: '34600000001',
        display_name: 'Juan Pérez',
        phone_number: '+34600000001',
        email: 'juan.perez@email.com',
        is_favorite: true
      },
      {
        platform_contact_id: '34600000002',
        display_name: 'María García',
        phone_number: '+34600000002',
        email: 'maria.garcia@email.com',
        is_favorite: false
      },
      {
        platform_contact_id: '34600000003',
        display_name: 'Carlos López',
        phone_number: '+34600000003',
        email: 'carlos.lopez@email.com',
        is_favorite: true
      }
    ];
    
    // Obtener ID de la plataforma WhatsApp
    const platformResult = await pool.query(
      'SELECT id FROM platforms WHERE name = $1',
      ['whatsapp']
    );
    
    if (platformResult.rows.length === 0) {
      console.log('⚠️ Plataforma WhatsApp no encontrada, saltando contactos');
      return 0;
    }
    
    const platformId = platformResult.rows[0].id;
    let createdCount = 0;
    
    for (const contact of contacts) {
      const result = await pool.query(`
        INSERT INTO contacts (
          user_id, platform_id, platform_contact_id, display_name, 
          phone_number, email, is_favorite
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (user_id, platform_id, platform_contact_id) DO NOTHING
        RETURNING id, display_name
      `, [
        userId,
        platformId,
        contact.platform_contact_id,
        contact.display_name,
        contact.phone_number,
        contact.email,
        contact.is_favorite
      ]);
      
      if (result.rows.length > 0) {
        console.log(`✅ Contacto creado: ${result.rows[0].display_name}`);
        createdCount++;
      }
    }
    
    console.log(`📊 Total de contactos creados: ${createdCount}`);
    return createdCount;
    
  } catch (error) {
    console.error('❌ Error creando contactos de prueba:', error);
    return 0;
  }
}

// Función para crear conversaciones de prueba
async function createTestConversations(userId) {
  try {
    if (!userId) {
      console.log('⏭️ No hay usuario para crear conversaciones');
      return 0;
    }
    
    // Obtener ID de la plataforma WhatsApp
    const platformResult = await pool.query(
      'SELECT id FROM platforms WHERE name = $1',
      ['whatsapp']
    );
    
    if (platformResult.rows.length === 0) {
      console.log('⚠️ Plataforma WhatsApp no encontrada, saltando conversaciones');
      return 0;
    }
    
    const platformId = platformResult.rows[0].id;
    
    // Obtener contactos del usuario
    const contactsResult = await pool.query(
      'SELECT id FROM contacts WHERE user_id = $1 LIMIT 3',
      [userId]
    );
    
    if (contactsResult.rows.length === 0) {
      console.log('⚠️ No hay contactos para crear conversaciones');
      return 0;
    }
    
    const conversations = [
      {
        title: 'Chat con Juan Pérez',
        last_message_text: '¡Hola! ¿Cómo estás?',
        contact_id: contactsResult.rows[0].id
      },
      {
        title: 'Chat con María García',
        last_message_text: 'Perfecto, nos vemos mañana',
        contact_id: contactsResult.rows[1]?.id || contactsResult.rows[0].id
      },
      {
        title: 'Chat con Carlos López',
        last_message_text: 'Gracias por la información',
        contact_id: contactsResult.rows[2]?.id || contactsResult.rows[0].id
      }
    ];
    
    let createdCount = 0;
    
    for (const conversation of conversations) {
      if (conversation.contact_id) {
        const result = await pool.query(`
          INSERT INTO conversations (
            user_id, platform_id, contact_id, title, last_message_text, last_message_at
          ) VALUES ($1, $2, $3, $4, $5, NOW())
          ON CONFLICT (user_id, platform_id, contact_id) DO NOTHING
          RETURNING id, title
        `, [
          userId,
          platformId,
          conversation.contact_id,
          conversation.title,
          conversation.last_message_text
        ]);
        
        if (result.rows.length > 0) {
          console.log(`✅ Conversación creada: ${result.rows[0].title}`);
          createdCount++;
        }
      }
    }
    
    console.log(`📊 Total de conversaciones creadas: ${createdCount}`);
    return createdCount;
    
  } catch (error) {
    console.error('❌ Error creando conversaciones de prueba:', error);
    return 0;
  }
}

// Función principal para ejecutar todos los seeds
async function runAllSeeds() {
  try {
    console.log('🌱 Iniciando ejecución de seeds...');
    
    // Probar conexión a la base de datos
    await testConnection();
    console.log('✅ Conexión a RDS establecida');
    
    // Crear plataformas
    console.log('\n📱 Creando plataformas de mensajería...');
    await createPlatforms();
    
    // Crear usuario de prueba
    console.log('\n👤 Creando usuario de prueba...');
    const testUser = await createTestUser();
    
    // Crear contactos de prueba
    console.log('\n📇 Creando contactos de prueba...');
    await createTestContacts(testUser?.id);
    
    // Crear conversaciones de prueba
    console.log('\n💬 Creando conversaciones de prueba...');
    await createTestConversations(testUser?.id);
    
    console.log('\n🎉 Todos los seeds ejecutados exitosamente');
    
    // Mostrar resumen
    const platformsCount = await pool.query('SELECT COUNT(*) as total FROM platforms');
    const usersCount = await pool.query('SELECT COUNT(*) as total FROM users');
    const contactsCount = await pool.query('SELECT COUNT(*) as total FROM contacts');
    const conversationsCount = await pool.query('SELECT COUNT(*) as total FROM conversations');
    
    console.log('\n📊 Resumen de datos creados:');
    console.log(`   • Plataformas: ${platformsCount.rows[0].total}`);
    console.log(`   • Usuarios: ${usersCount.rows[0].total}`);
    console.log(`   • Contactos: ${contactsCount.rows[0].total}`);
    console.log(`   • Conversaciones: ${conversationsCount.rows[0].total}`);
    
    if (testUser) {
      console.log('\n🔑 Credenciales de acceso:');
      console.log(`   • Email: ${testUser.email}`);
      console.log(`   • Username: ${testUser.username}`);
      console.log(`   • Password: password123`);
    }
    
  } catch (error) {
    console.error('❌ Error ejecutando seeds:', error);
    process.exit(1);
  } finally {
    await pool.end();
    console.log('\n🔌 Conexión a base de datos cerrada');
  }
}

// Ejecutar seeds si este archivo se ejecuta directamente
if (require.main === module) {
  runAllSeeds();
}

module.exports = { runAllSeeds };
