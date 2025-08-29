#!/bin/bash

# Script de despliegue simplificado para EU Chat Bridge
# Usa backend JavaScript simple (sin TypeScript)

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
KEY_FILE="deploy/spainbingo-key.pem"
PROJECT_NAME="eu-chat"
BACKEND_PORT="3001"
ALB_DNS="spainbingo-alb-9e0c2b7458d34fdc.eu-west-1.elb.amazonaws.com"

echo -e "${BLUE}🚀 Despliegue Simplificado - EU Chat Bridge${NC}"
echo "================================================"
echo -e "${YELLOW}Servidor: ${EC2_HOST}${NC}"
echo -e "${YELLOW}Puerto Backend: ${BACKEND_PORT}${NC}"
echo -e "${YELLOW}ALB: ${ALB_DNS}${NC}"
echo -e "${YELLOW}Backend: JavaScript simple (sin TypeScript)${NC}"
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

echo -e "${BLUE}📦 Copiando archivos del backend simplificado...${NC}"

# Copiar archivos simplificados
scp_copy "deploy/backend-simple.js" "~/${PROJECT_NAME}/"
scp_copy "deploy/package-simple.json" "~/${PROJECT_NAME}/package.json"

echo -e "${GREEN}✅ Backend simplificado copiado${NC}"

echo -e "${BLUE}🔧 Configurando backend...${NC}"

# Configurar backend
ssh_exec "
    cd ~/${PROJECT_NAME}
    
    # Instalar dependencias
    echo 'Instalando dependencias...'
    npm install --production
    
    echo '✅ Backend configurado'
"

echo -e "${BLUE}📋 Creando configuración de PM2...${NC}"

# Crear archivo de configuración de PM2
cat > deploy/ecosystem-simple-final.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'eu-chat-backend-simple',
    script: './backend-simple.js',
    cwd: '/home/ec2-user/eu-chat',
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
scp_copy "deploy/ecosystem-simple-final.config.js" "~/${PROJECT_NAME}/"

echo -e "${BLUE}🚀 Iniciando aplicación con PM2...${NC}"

# Iniciar aplicación
ssh_exec "
    cd ~/${PROJECT_NAME}
    
    # Crear directorio de logs
    mkdir -p logs
    
    # Iniciar con PM2
    pm2 start ecosystem-simple-final.config.js
    
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
    tail -n 5 ~/eu-chat/logs/out.log
"

echo -e "${GREEN}🎉 Despliegue completado exitosamente!${NC}"
echo ""
echo -e "${BLUE}📋 Información del despliegue:${NC}"
echo -e "   🌐 spainbingo: http://${ALB_DNS}:3000"
echo -e "   🚀 EU Chat Bridge: http://${ALB_DNS}:3001"
echo -e "   🔗 Health Check: http://${ALB_DNS}:3001/health"
echo -e "   📱 API: http://${ALB_DNS}:3001/api"
echo ""
echo -e "${BLUE}🔧 Comandos útiles:${NC}"
echo -e "   📊 Estado: ssh -i ${KEY_FILE} ec2-user@${EC2_HOST} 'pm2 list'"
echo -e "   📝 Logs: ssh -i ${KEY_FILE} ec2-user@${EC2_HOST} 'pm2 logs eu-chat-backend-simple'"
echo -e "   🔄 Reiniciar: ssh -i ${KEY_FILE} ec2-user@${EC2_HOST} 'pm2 restart eu-chat-backend-simple'"
echo -e "   🛑 Parar: ssh -i ${KEY_FILE} ec2-user@${EC2_HOST} 'pm2 stop eu-chat-backend-simple'"
echo ""
echo -e "${BLUE}✅ Backend JavaScript simple desplegado${NC}"
echo -e "   Sin problemas de TypeScript, listo para producción"
