#!/bin/bash

# Script para desplegar EU Chat Bridge Backend con autenticación JWT
# Incluye bcrypt para hash de contraseñas y JWT para tokens

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuración
EC2_HOST="54.247.227.217"
KEY_FILE="deploy/spainbingo-key.pem"
PROJECT_PATH="/home/ec2-user/eu-chat"
ALB_DNS="spainbingo-alb-581291766.eu-west-1.elb.amazonaws.com"

echo -e "${BLUE}🚀 Despliegue de EU Chat Bridge Backend con Autenticación${NC}"
echo "=============================================================="
echo -e "${YELLOW}Servidor: ${EC2_HOST}${NC}"
echo -e "${YELLOW}Proyecto: ${PROJECT_PATH}${NC}"
echo -e "${YELLOW}ALB: ${ALB_DNS}${NC}"
echo ""

# Función para ejecutar comandos SSH
ssh_exec() {
    ssh -i ${KEY_FILE} -o StrictHostKeyChecking=no ec2-user@${EC2_HOST} "$1"
}

# Función para copiar archivos
scp_copy() {
    local script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    scp -i ${KEY_FILE} -o StrictHostKeyChecking=no "${script_dir}/$1" ec2-user@${EC2_HOST}:${PROJECT_PATH}/
}

# Verificar conexión SSH
echo -e "${BLUE}📡 Verificando conexión SSH...${NC}"
if ! ssh_exec "echo 'Conexión SSH exitosa'" > /dev/null 2>&1; then
    echo -e "${RED}❌ Error: No se puede conectar al servidor EC2${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Conexión SSH establecida${NC}"

# Verificar dependencias en el servidor
echo -e "${BLUE}🔍 Verificando dependencias en el servidor...${NC}"
if ! ssh_exec "command -v node >/dev/null 2>&1"; then
    echo -e "${RED}❌ Error: Node.js no está instalado${NC}"
    exit 1
fi

if ! ssh_exec "command -v npm >/dev/null 2>&1"; then
    echo -e "${RED}❌ Error: npm no está instalado${NC}"
    exit 1
fi

if ! ssh_exec "command -v pm2 >/dev/null 2>&1"; then
    echo -e "${RED}❌ Error: PM2 no está instalado${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Todas las dependencias están instaladas${NC}"

# Crear directorio del proyecto si no existe
echo -e "${BLUE}📁 Creando directorio del proyecto...${NC}"
ssh_exec "mkdir -p ${PROJECT_PATH}"
echo -e "${GREEN}✅ Directorio del proyecto creado${NC}"

# Detener proceso anterior si existe
echo -e "${BLUE}🛑 Deteniendo proceso anterior...${NC}"
if ssh_exec "pm2 list | grep -q 'eu-chat-backend-with-auth'"; then
    ssh_exec "pm2 stop eu-chat-backend-with-auth && pm2 delete eu-chat-backend-with-auth"
    echo -e "${GREEN}✅ Proceso anterior detenido${NC}"
else
    echo -e "${YELLOW}ℹ️ No hay proceso anterior ejecutándose${NC}"
fi

# Copiar archivos del backend
echo -e "${BLUE}📤 Copiando archivos del backend...${NC}"
scp_copy "backend-with-auth.js"
scp_copy "package-with-auth.json"
echo -e "${GREEN}✅ Archivos copiados exitosamente${NC}"

# Instalar dependencias
echo -e "${BLUE}📦 Instalando dependencias...${NC}"
ssh_exec "cd ${PROJECT_PATH} && npm install --production"
echo -e "${GREEN}✅ Dependencias instaladas${NC}"

# Crear directorio de logs
echo -e "${BLUE}📝 Creando directorio de logs...${NC}"
ssh_exec "mkdir -p ${PROJECT_PATH}/logs"
echo -e "${GREEN}✅ Directorio de logs creado${NC}"

# Iniciar aplicación con PM2
echo -e "${BLUE}🚀 Iniciando aplicación con PM2...${NC}"
ssh_exec "cd ${PROJECT_PATH} && pm2 start backend-with-auth.js --name eu-chat-backend-with-auth --cwd ${PROJECT_PATH} --env production -- --port 3001"
echo -e "${GREEN}✅ Aplicación iniciada con PM2${NC}"

# Guardar configuración de PM2
echo -e "${BLUE}💾 Guardando configuración de PM2...${NC}"
ssh_exec "pm2 save"
echo -e "${GREEN}✅ Configuración de PM2 guardada${NC}"

# Verificar estado de la aplicación
echo -e "${BLUE}🔍 Verificando estado de la aplicación...${NC}"
sleep 3
ssh_exec "pm2 list eu-chat-backend-with-auth"

# Probar la API
echo -e "${BLUE}🧪 Probando la API...${NC}"
sleep 2

# Probar health check
HEALTH_RESPONSE=$(ssh_exec "curl -s http://localhost:3001/health")
if echo "$HEALTH_RESPONSE" | grep -q "OK"; then
    echo -e "${GREEN}✅ Health check exitoso${NC}"
else
    echo -e "${RED}❌ Health check falló${NC}"
    echo "$HEALTH_RESPONSE"
fi

# Probar endpoint principal
MAIN_RESPONSE=$(ssh_exec "curl -s http://localhost:3001/")
if echo "$MAIN_RESPONSE" | grep -q "EU Chat Bridge API"; then
    echo -e "${GREEN}✅ Endpoint principal funcionando${NC}"
else
    echo -e "${RED}❌ Endpoint principal falló${NC}"
    echo "$MAIN_RESPONSE"
fi

# Probar endpoint de plataformas
PLATFORMS_RESPONSE=$(ssh_exec "curl -s http://localhost:3001/api/platforms")
if echo "$PLATFORMS_RESPONSE" | grep -q "platforms"; then
    echo -e "${GREEN}✅ Endpoint de plataformas funcionando${NC}"
else
    echo -e "${RED}❌ Endpoint de plataformas falló${NC}"
    echo "$PLATFORMS_RESPONSE"
fi

echo ""
echo -e "${GREEN}🎉 Despliegue completado exitosamente!${NC}"
echo ""
echo -e "${BLUE}📋 Información del despliegue:${NC}"
echo -e "   🖥️ Servidor: ${EC2_HOST}"
echo -e "   📁 Proyecto: ${PROJECT_PATH}"
echo -e "   🚀 Proceso: eu-chat-backend-with-auth"
echo -e "   🔌 Puerto: 3001"
echo -e "   🌐 ALB: ${ALB_DNS}:3001"
echo ""
echo -e "${BLUE}🔧 Comandos útiles:${NC}"
echo -e "   📊 Estado: ssh -i ${KEY_FILE} ec2-user@${EC2_HOST} 'pm2 list'"
echo -e "   📝 Logs: ssh -i ${KEY_FILE} ec2-user@${EC2_HOST} 'pm2 logs eu-chat-backend-with-auth'"
echo -e "   🛑 Parar: ssh -i ${KEY_FILE} ec2-user@${EC2_HOST} 'pm2 stop eu-chat-backend-with-auth'"
echo -e "   ▶️ Iniciar: ssh -i ${KEY_FILE} ec2-user@${EC2_HOST} 'pm2 start eu-chat-backend-with-auth'"
echo ""
echo -e "${BLUE}🧪 Probar API:${NC}"
echo -e "   Health: curl ${ALB_DNS}:3001/health"
echo -e "   Principal: curl ${ALB_DNS}:3001/"
echo -e "   Plataformas: curl ${ALB_DNS}:3001/api/platforms"
echo ""
echo -e "${BLUE}🔐 Autenticación:${NC}"
echo -e "   Login: curl -X POST ${ALB_DNS}:3001/api/auth/login -H 'Content-Type: application/json' -d '{\"email\":\"demo@eu-chat.com\",\"password\":\"demo123\"}'"
echo -e "   Register: curl -X POST ${ALB_DNS}:3001/api/auth/register -H 'Content-Type: application/json' -d '{\"email\":\"test@example.com\",\"password\":\"password123\",\"firstName\":\"Test\",\"lastName\":\"User\"}'"
