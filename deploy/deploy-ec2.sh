#!/bin/bash

# Script de despliegue para EU Chat Bridge en EC2
# Este script despliega el backend en /eu-chat para evitar conflictos con spainbingo

set -e  # Salir si hay algún error

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuración
EC2_HOST="54.247.227.217"
EC2_USER="ec2-user"
EC2_KEY="~/.ssh/eu-chat-key.pem"
PROJECT_NAME="eu-chat-bridge"
EC2_PATH="/eu-chat"
BACKEND_PORT=3001

echo -e "${BLUE}🚀 Iniciando despliegue de EU Chat Bridge en EC2${NC}"
echo -e "${BLUE}📍 Host: ${EC2_HOST}${NC}"
echo -e "${BLUE}📁 Path: ${EC2_PATH}${NC}"
echo -e "${BLUE}🔌 Puerto: ${BACKEND_PORT}${NC}"
echo ""

# Función para imprimir mensajes con timestamp
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
}

warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

# Verificar que existe la clave SSH
if [ ! -f "${EC2_KEY/#\~/$HOME}" ]; then
    error "No se encontró la clave SSH: ${EC2_KEY}"
    exit 1
fi

# Verificar que existe el directorio backend
if [ ! -d "backend" ]; then
    error "No se encontró el directorio backend. Ejecuta este script desde la raíz del proyecto."
    exit 1
fi

log "🔑 Verificando conexión SSH a EC2..."
if ! ssh -i "${EC2_KEY/#\~/$HOME}" -o ConnectTimeout=10 -o StrictHostKeyChecking=no "${EC2_USER}@${EC2_HOST}" "echo 'Conexión SSH exitosa'" > /dev/null 2>&1; then
    error "No se pudo conectar a EC2. Verifica la conexión y la clave SSH."
    exit 1
fi

log "✅ Conexión SSH establecida"

# Crear directorio en EC2 si no existe
log "📁 Creando directorio ${EC2_PATH} en EC2..."
ssh -i "${EC2_KEY/#\~/$HOME}" -o StrictHostKeyChecking=no "${EC2_USER}@${EC2_HOST}" "sudo mkdir -p ${EC2_PATH} && sudo chown ${EC2_USER}:${EC2_USER} ${EC2_PATH}"

# Verificar que spainbingo no esté usando el puerto 3001
log "🔍 Verificando que el puerto ${BACKEND_PORT} esté disponible..."
if ssh -i "${EC2_KEY/#\~/$HOME}" -o StrictHostKeyChecking=no "${EC2_USER}@${EC2_HOST}" "lsof -i :${BACKEND_PORT}" > /dev/null 2>&1; then
    warning "El puerto ${BACKEND_PORT} está en uso. Verificando qué proceso lo usa..."
    ssh -i "${EC2_KEY/#\~/$HOME}" -o StrictHostKeyChecking=no "${EC2_USER}@${EC2_KEY}" "lsof -i :${BACKEND_PORT}"
    error "El puerto ${BACKEND_PORT} está ocupado. EU Chat Bridge necesita este puerto."
    exit 1
fi

log "✅ Puerto ${BACKEND_PORT} disponible"

# Crear estructura de directorios en EC2
log "📂 Creando estructura de directorios en EC2..."
ssh -i "${EC2_KEY/#\~/$HOME}" -o StrictHostKeyChecking=no "${EC2_USER}@${EC2_HOST}" "
    mkdir -p ${EC2_PATH}/backend
    mkdir -p ${EC2_PATH}/backend/logs
    mkdir -p ${EC2_PATH}/backend/src
    mkdir -p ${EC2_PATH}/backend/config
    mkdir -p ${EC2_PATH}/backend/migrations
    mkdir -p ${EC2_PATH}/backend/seeds
"

# Copiar archivos del backend
log "📤 Copiando archivos del backend a EC2..."

# Copiar package.json y package-lock.json
scp -i "${EC2_KEY/#\~/$HOME}" -o StrictHostKeyChecking=no backend/package*.json "${EC2_USER}@${EC2_HOST}:${EC2_PATH}/backend/"

# Copiar archivos de configuración
scp -i "${EC2_KEY/#\~/$HOME}" -o StrictHostKeyChecking=no backend/ecosystem.config.js "${EC2_USER}@${EC2_HOST}:${EC2_PATH}/"
scp -i "${EC2_KEY/#\~/$HOME}" -o StrictHostKeyChecking=no backend/env.example "${EC2_USER}@${EC2_HOST}:${EC2_PATH}/backend/.env"

# Copiar directorio src
scp -i "${EC2_KEY/#\~/$HOME}" -o StrictHostKeyChecking=no -r backend/src "${EC2_USER}@${EC2_HOST}:${EC2_PATH}/backend/"

# Copiar directorio config
scp -i "${EC2_KEY/#\~/$HOME}" -o StrictHostKeyChecking=no -r backend/config "${EC2_USER}@${EC2_HOST}:${EC2_PATH}/backend/"

# Copiar directorio migrations
scp -i "${EC2_KEY/#\~/$HOME}" -o StrictHostKeyChecking=no -r backend/migrations "${EC2_USER}@${EC2_HOST}:${EC2_PATH}/backend/"

# Copiar directorio seeds
scp -i "${EC2_KEY/#\~/$HOME}" -o StrictHostKeyChecking=no -r backend/seeds "${EC2_USER}@${EC2_HOST}:${EC2_PATH}/backend/"

log "✅ Archivos copiados exitosamente"

# Instalar dependencias en EC2
log "📦 Instalando dependencias en EC2..."
ssh -i "${EC2_KEY/#\~/$HOME}" -o StrictHostKeyChecking=no "${EC2_USER}@${EC2_HOST}" "
    cd ${EC2_PATH}/backend
    npm ci --only=production
"

log "✅ Dependencias instaladas"

# Crear archivo .env con variables de producción
log "⚙️ Configurando variables de entorno..."
ssh -i "${EC2_KEY/#\~/$HOME}" -o StrictHostKeyChecking=no "${EC2_USER}@${EC2_HOST}" "
    cd ${EC2_PATH}/backend
    cat > .env << 'EOF'
# Configuración del servidor
NODE_ENV=production
PORT=3001
HOST=0.0.0.0

# Configuración de la base de datos RDS
DB_HOST=spainbingo-db.clzgxn85wdjh.eu-west-1.rds.amazonaws.com
DB_PORT=5432
DB_NAME=spainbingo
DB_USER=spainbingo_admin
DB_PASSWORD=your_rds_password_here

# Configuración JWT
JWT_SECRET=your_jwt_secret_here_make_it_long_and_random
JWT_REFRESH_SECRET=your_jwt_refresh_secret_here_make_it_long_and_random
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

# Configuración WhatsApp API (DMA 2024)
WHATSAPP_API_URL=https://graph.facebook.com/v18.0
WHATSAPP_ACCESS_TOKEN=your_whatsapp_access_token_here
WHATSAPP_VERIFY_TOKEN=your_webhook_verify_token_here
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id_here

# Configuración de seguridad
CORS_ORIGIN=*
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Configuración de logs
LOG_LEVEL=info
LOG_FILE_PATH=./logs/app.log

# Configuración de WebSockets
SOCKET_CORS_ORIGIN=*
EOF
"

log "✅ Variables de entorno configuradas"

# Ejecutar migraciones de base de datos
log "🗄️ Ejecutando migraciones de base de datos..."
ssh -i "${EC2_KEY/#\~/$HOME}" -o StrictHostKeyChecking=no "${EC2_USER}@${EC2_HOST}" "
    cd ${EC2_PATH}/backend
    node migrations/run-migrations.js
"

log "✅ Migraciones ejecutadas"

# Verificar que PM2 esté instalado
log "🔧 Verificando instalación de PM2..."
if ! ssh -i "${EC2_KEY/#\~/$HOME}" -o StrictHostKeyChecking=no "${EC2_USER}@${EC2_HOST}" "pm2 --version" > /dev/null 2>&1; then
    log "📦 Instalando PM2 globalmente..."
    ssh -i "${EC2_KEY/#\~/$HOME}" -o StrictHostKeyChecking=no "${EC2_USER}@${EC2_HOST}" "npm install -g pm2"
fi

# Detener proceso anterior si existe
log "🛑 Deteniendo proceso anterior si existe..."
ssh -i "${EC2_KEY/#\~/$HOME}" -o StrictHostKeyChecking=no "${EC2_USER}@${EC2_HOST}" "pm2 stop eu-chat-bridge-backend || true"
ssh -i "${EC2_KEY/#\~/$HOME}" -o StrictHostKeyChecking=no "${EC2_USER}@${EC2_HOST}" "pm2 delete eu-chat-bridge-backend || true"

# Iniciar aplicación con PM2
log "🚀 Iniciando aplicación con PM2..."
ssh -i "${EC2_KEY/#\~/$HOME}" -o StrictHostKeyChecking=no "${EC2_USER}@${EC2_HOST}" "
    cd ${EC2_PATH}
    pm2 start backend/ecosystem.config.js --env production
"

# Guardar configuración de PM2
log "💾 Guardando configuración de PM2..."
ssh -i "${EC2_KEY/#\~/$HOME}" -o StrictHostKeyChecking=no "${EC2_USER}@${EC2_HOST}" "pm2 save"

# Configurar PM2 para iniciar automáticamente
log "⚡ Configurando PM2 para inicio automático..."
ssh -i "${EC2_KEY/#\~/$HOME}" -o StrictHostKeyChecking=no "${EC2_USER}@${EC2_HOST}" "pm2 startup"

# Verificar estado de la aplicación
log "🔍 Verificando estado de la aplicación..."
sleep 5
ssh -i "${EC2_KEY/#\~/$HOME}" -o StrictHostKeyChecking=no "${EC2_USER}@${EC2_HOST}" "pm2 status"

# Verificar que la aplicación esté respondiendo
log "🌐 Verificando que la aplicación esté respondiendo..."
if ssh -i "${EC2_KEY/#\~/$HOME}" -o StrictHostKeyChecking=no "${EC2_USER}@${EC2_HOST}" "curl -s http://localhost:${BACKEND_PORT}/health" > /dev/null 2>&1; then
    log "✅ Aplicación respondiendo correctamente en puerto ${BACKEND_PORT}"
else
    warning "⚠️ La aplicación no está respondiendo en el puerto ${BACKEND_PORT}"
    log "🔍 Revisando logs de PM2..."
    ssh -i "${EC2_KEY/#\~/$HOME}" -o StrictHostKeyChecking=no "${EC2_USER}@${EC2_HOST}" "pm2 logs eu-chat-bridge-backend --lines 20"
fi

# Mostrar información final
echo ""
echo -e "${GREEN}🎉 ¡Despliegue completado exitosamente!${NC}"
echo ""
echo -e "${BLUE}📋 Resumen del despliegue:${NC}"
echo -e "${BLUE}   • Host: ${EC2_HOST}${NC}"
echo -e "${BLUE}   • Path: ${EC2_PATH}${NC}"
echo -e "${BLUE}   • Puerto: ${BACKEND_PORT}${NC}"
echo -e "${BLUE}   • Proceso PM2: eu-chat-bridge-backend${NC}"
echo ""
echo -e "${YELLOW}⚠️ IMPORTANTE:${NC}"
echo -e "${YELLOW}   1. Configura la contraseña de RDS en ${EC2_PATH}/backend/.env${NC}"
echo -e "${YELLOW}   2. Configura las credenciales de WhatsApp API${NC}"
echo -e "${YELLOW}   3. Configura los secretos JWT${NC}"
echo ""
echo -e "${BLUE}🔗 URLs de la aplicación:${NC}"
echo -e "${BLUE}   • Health Check: http://${EC2_HOST}:${BACKEND_PORT}/health${NC}"
echo -e "${BLUE}   • API Base: http://${EC2_HOST}:${BACKEND_PORT}/api${NC}"
echo -e "${BLUE}   • ALB: spainbingo-alb-581291766.eu-west-1.elb.amazonaws.com:${BACKEND_PORT}${NC}"
echo ""
echo -e "${GREEN}✅ EU Chat Bridge está desplegado y funcionando en EC2${NC}"
