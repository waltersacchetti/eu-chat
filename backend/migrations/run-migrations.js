const { pool, testConnection } = require('../config/database');
const fs = require('fs');
const path = require('path');

// Función para ejecutar una migración
async function runMigration(migrationFile) {
  try {
    console.log(`🔄 Ejecutando migración: ${migrationFile}`);
    
    const migrationPath = path.join(__dirname, migrationFile);
    const migration = require(migrationPath);
    
    if (typeof migration.up === 'function') {
      await migration.up(pool);
      console.log(`✅ Migración ${migrationFile} ejecutada exitosamente`);
    } else {
      console.log(`⚠️ Migración ${migrationFile} no tiene función 'up'`);
    }
  } catch (error) {
    console.error(`❌ Error ejecutando migración ${migrationFile}:`, error);
    throw error;
  }
}

// Función para verificar si una migración ya fue ejecutada
async function isMigrationExecuted(migrationName) {
  try {
    // Crear tabla de migraciones si no existe
    await pool.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    const result = await pool.query(
      'SELECT id FROM migrations WHERE name = $1',
      [migrationName]
    );
    
    return result.rows.length > 0;
  } catch (error) {
    console.error('❌ Error verificando migración:', error);
    return false;
  }
}

// Función para marcar migración como ejecutada
async function markMigrationAsExecuted(migrationName) {
  try {
    await pool.query(
      'INSERT INTO migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING',
      [migrationName]
    );
    console.log(`📝 Migración ${migrationName} marcada como ejecutada`);
  } catch (error) {
    console.error(`❌ Error marcando migración ${migrationName}:`, error);
  }
}

// Función principal para ejecutar todas las migraciones
async function runAllMigrations() {
  try {
    console.log('🚀 Iniciando ejecución de migraciones...');
    
    // Probar conexión a la base de datos
    await testConnection();
    console.log('✅ Conexión a RDS establecida');
    
    // Lista de migraciones en orden de ejecución
    const migrations = [
      '001_create_users_table.js',
      '002_create_platforms_table.js',
      '003_create_contacts_table.js',
      '004_create_conversations_table.js',
      '005_create_messages_table.js'
    ];
    
    console.log(`📋 Total de migraciones a ejecutar: ${migrations.length}`);
    
    // Ejecutar cada migración en orden
    for (const migrationFile of migrations) {
      const migrationName = path.basename(migrationFile, '.js');
      
      // Verificar si ya fue ejecutada
      if (await isMigrationExecuted(migrationName)) {
        console.log(`⏭️ Migración ${migrationName} ya ejecutada, saltando...`);
        continue;
      }
      
      // Ejecutar migración
      await runMigration(migrationFile);
      
      // Marcar como ejecutada
      await markMigrationAsExecuted(migrationName);
    }
    
    console.log('🎉 Todas las migraciones ejecutadas exitosamente');
    
    // Mostrar resumen
    const result = await pool.query('SELECT COUNT(*) as total FROM migrations');
    const totalExecuted = result.rows[0].total;
    console.log(`📊 Total de migraciones ejecutadas: ${totalExecuted}`);
    
  } catch (error) {
    console.error('❌ Error ejecutando migraciones:', error);
    process.exit(1);
  } finally {
    await pool.end();
    console.log('🔌 Conexión a base de datos cerrada');
  }
}

// Ejecutar migraciones si este archivo se ejecuta directamente
if (require.main === module) {
  runAllMigrations();
}

module.exports = { runAllMigrations };
