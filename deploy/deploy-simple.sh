#!/bin/bash

# Script de despliegue simplificado para EU Chat Bridge
# Solo Backend + PM2 (sin Nginx, ya hay ALB)

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuración del servidor
EC2_HOST="54.247.227.217"
INSTANCE_ID="i-04ab7400a1c44d0d6"
KEY_FILE="spainbingo-key.pem"
PROJECT_NAME="eu-chat"
BACKEND_PORT="3001"

echo -e "${BLUE}🚀 Despliegue Simplificado - EU Chat Bridge${NC}"
echo "================================================"
echo -e "${YELLOW}Servidor: ${EC2_HOST}${NC}"
echo -e "${YELLOW}Puerto Backend: ${BACKEND_PORT}${NC}"
echo -e "${YELLOW}ALB: Ya configurado (sin Nginx)${NC}"
echo ""

# Función para ejecutar comandos SSH
ssh_exec() {
    ssh -i ${KEY_FILE} -o StrictHostKeyChecking=no ec2-user@${EC2_HOST} "$1"
}

# Función para copiar archivos
scp_copy() {
    local source=$1
    local destination=$2
    scp -i ${KEY_FILE} -o StrictHostKeyChecking=no -r "$source" "ec2-user@${EC2_HOST}:$destination"
}

echo -e "${BLUE}📋 Verificando estado del servidor...${NC}"

# Verificar que el servidor esté accesible
if ! ssh_exec "echo 'Servidor accesible'" > /dev/null 2>&1; then
    echo -e "${RED}❌ Error: No se puede conectar al servidor EC2${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Servidor accesible${NC}"

# Verificar que spainbingo esté corriendo en puerto 3000
if ssh_exec "netstat -tlnp | grep :3000" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ spainbingo corriendo en puerto 3000${NC}"
else
    echo -e "${YELLOW}⚠️  spainbingo no está corriendo en puerto 3000${NC}"
fi

# Verificar que el puerto 3001 esté libre
if ssh_exec "netstat -tlnp | grep :3001" > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Puerto 3001 ya está en uso${NC}"
    ssh_exec "netstat -tlnp | grep :3001"
else
    echo -e "${GREEN}✅ Puerto 3001 libre${NC}"
fi

echo -e "${BLUE}🔧 Verificando dependencias del sistema...${NC}"

# Verificar Node.js y PM2
ssh_exec "
    # Verificar Node.js
    if command -v node &> /dev/null; then
        echo 'Node.js version:' \$(node --version)
    else
        echo '❌ Node.js no está instalado'
        exit 1
    fi
    
    # Verificar PM2
    if command -v pm2 &> /dev/null; then
        echo 'PM2 version:' \$(pm2 --version)
    else
        echo '❌ PM2 no está instalado'
        exit 1
    fi
"

echo -e "${GREEN}✅ Dependencias del sistema verificadas${NC}"

echo -e "${BLUE}📁 Preparando directorio del proyecto...${NC}"

# Crear directorio del proyecto
ssh_exec "
    mkdir -p ~/${PROJECT_NAME}
    cd ~/${PROJECT_NAME}
    pwd
"

echo -e "${BLUE}📦 Copiando archivos del backend...${NC}"

# Copiar backend
scp_copy "backend" "ec2-user@${EC2_HOST}:~/${PROJECT_NAME}/"

echo -e "${GREEN}✅ Backend copiado${NC}"

echo -e "${BLUE}🔧 Configurando backend...${NC}"

# Configurar backend
ssh_exec "
    cd ~/${PROJECT_NAME}/backend
    
    # Instalar dependencias
    echo 'Instalando dependencias...'
    npm install --production
    
    # Construir proyecto
    echo 'Construyendo proyecto...'
    npm run build
    
    echo '✅ Backend configurado'
"

echo -e "${BLUE}📋 Creando configuración de PM2...${NC}"

# Crear archivo de configuración de PM2
cat > deploy/ecosystem-simple.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'eu-chat-backend',
    script: './dist/index.js',
    cwd: '/home/ec2-user/eu-chat/backend',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
EOF

# Copiar configuración de PM2
scp_copy "deploy/ecosystem-simple.config.js" "ec2-user@${EC2_HOST}:~/${PROJECT_NAME}/"

echo -e "${BLUE}🚀 Iniciando aplicación con PM2...${NC}"

# Iniciar aplicación
ssh_exec "
    cd ~/${PROJECT_NAME}
    
    # Crear directorio de logs
    mkdir -p backend/logs
    
    # Iniciar con PM2
    pm2 start ecosystem-simple.config.js
    
    # Guardar configuración de PM2
    pm2 save
    
    # Configurar PM2 para iniciar en boot
    pm2 startup
"

echo -e "${GREEN}✅ Aplicación iniciada con PM2${NC}"

echo -e "${BLUE}🔍 Verificando despliegue...${NC}"

# Verificar que la aplicación esté corriendo
ssh_exec "
    # Verificar proceso PM2
    pm2 list
    
    # Verificar puerto
    netstat -tlnp | grep :3001
    
    # Verificar logs
    echo 'Últimas líneas del log:'
    tail -n 5 ~/eu-chat/backend/logs/out.log
"

echo -e "${GREEN}🎉 Despliegue completado exitosamente!${NC}"
echo ""
echo -e "${BLUE}📋 Información del despliegue:${NC}"
echo -e "   🌐 Backend: http://${EC2_HOST}:${BACKEND_PORT}"
echo -e "   🔗 Health: http://${EC2_HOST}:${BACKEND_PORT}/health"
echo -e "   📱 API: http://${EC2_HOST}:${BACKEND_PORT}/api"
echo ""
echo -e "${BLUE}🔧 Comandos útiles:${NC}"
echo -e "   📊 Estado: ssh -i ${KEY_FILE} ec2-user@${EC2_HOST} 'pm2 list'"
echo -e "   📝 Logs: ssh -i ${KEY_FILE} ec2-user@${EC2_HOST} 'pm2 logs eu-chat-backend'"
echo -e "   🔄 Reiniciar: ssh -i ${KEY_FILE} ec2-user@${EC2_HOST} 'pm2 restart eu-chat-backend'"
echo -e "   🛑 Parar: ssh -i ${KEY_FILE} ec2-user@${EC2_HOST} 'pm2 stop eu-chat-backend'"
