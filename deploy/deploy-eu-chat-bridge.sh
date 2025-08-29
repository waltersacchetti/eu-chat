#!/bin/bash

# Despliegue de EU Chat Bridge en puerto 3001 (sin interferir con spainbingo en 3000)
# Ejecutar desde la raíz del proyecto

set -e

# Variables de configuración
EC2_HOST="54.247.227.217"
EC2_USER="ec2-user"
KEY_FILE="deploy/spainbingo-key.pem"
PROJECT_NAME="eu-chat"
BACKEND_PORT="3001"

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🚀 Despliegue EU Chat Bridge (Puerto 3001)${NC}"
echo "=================================================="
echo -e "${YELLOW}⚠️  IMPORTANTE: spainbingo seguirá corriendo en puerto 3000${NC}"
echo ""

# Verificar que estamos en la raíz del proyecto
if [ ! -f "package.json" ] || [ ! -d "backend" ] || [ ! -d "mobile" ]; then
    echo -e "${RED}❌ Error: Ejecuta este script desde la raíz del proyecto${NC}"
    exit 1
fi

# Verificar que existe la clave privada
if [ ! -f "$KEY_FILE" ]; then
    echo -e "${RED}❌ Error: No se encontró $KEY_FILE${NC}"
    echo "Por favor, coloca spainbingo-key.pem en la carpeta deploy/"
    exit 1
fi

# Configurar permisos de la clave
chmod 400 "$KEY_FILE"
echo -e "${GREEN}✅ Permisos de clave configurados${NC}"

# Función para ejecutar comando remoto
run_remote() {
    local command="$1"
    echo -e "${YELLOW}🔄 $command${NC}"
    ssh -i "$KEY_FILE" -o StrictHostKeyChecking=no "$EC2_USER@$EC2_HOST" "$command"
}

# Función para copiar archivos
copy_files() {
    local source="$1"
    local destination="$2"
    echo -e "${YELLOW}📁 Copiando $source...${NC}"
    scp -i "$KEY_FILE" -o StrictHostKeyChecking=no -r "$source" "$EC2_USER@$EC2_HOST:$destination"
}

echo -e "${BLUE}🔍 Paso 1: Verificando estado actual del servidor...${NC}"
run_remote "pm2 status"
run_remote "netstat -tlnp | grep LISTEN"

echo -e "${BLUE}📦 Paso 2: Verificando dependencias del sistema...${NC}"
run_remote "node --version || echo 'Node.js no instalado'"
run_remote "npm --version || echo 'npm no instalado'"
run_remote "pm2 --version || echo 'PM2 no instalado'"

# Instalar Node.js 18 si no está disponible
if run_remote "node --version" | grep -q "v18"; then
    echo -e "${GREEN}✅ Node.js 18 ya está instalado${NC}"
else
    echo -e "${BLUE}📦 Instalando Node.js 18...${NC}"
    run_remote "curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash"
    run_remote "source ~/.bashrc && nvm install 18 && nvm use 18 && nvm alias default 18"
fi

# Instalar PM2 si no está disponible
if run_remote "pm2 --version" | grep -q "PM2"; then
    echo -e "${GREEN}✅ PM2 ya está instalado${NC}"
else
    echo -e "${BLUE}⚡ Instalando PM2...${NC}"
    run_remote "npm install -g pm2"
    run_remote "pm2 startup"
fi

echo -e "${BLUE}🌐 Paso 3: Configurando Nginx para EU Chat Bridge...${NC}"
nginx_config="server {
    listen 81;
    server_name _;
    
    location / {
        proxy_pass http://localhost:$BACKEND_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
    
    location /socket.io/ {
        proxy_pass http://localhost:$BACKEND_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \"upgrade\";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}"

echo "$nginx_config" | run_remote "sudo tee /etc/nginx/conf.d/eu-chat-bridge.conf"
run_remote "sudo nginx -t"
run_remote "sudo systemctl reload nginx"

echo -e "${BLUE}🚀 Paso 4: Desplegando EU Chat Bridge...${NC}"
run_remote "mkdir -p ~/$PROJECT_NAME"
copy_files "backend" "~/$PROJECT_NAME/"

echo -e "${BLUE}📦 Paso 5: Instalando dependencias del backend...${NC}"
run_remote "cd ~/$PROJECT_NAME && npm install"

echo -e "${BLUE}🔧 Paso 6: Configurando base de datos...${NC}"
run_remote "cd ~/$PROJECT_NAME && npm run db:migrate"

echo -e "${BLUE}🏗️ Paso 7: Construyendo aplicación...${NC}"
run_remote "cd ~/$PROJECT_NAME && npm run build"

echo -e "${BLUE}⚙️ Paso 8: Configurando variables de entorno...${NC}"
run_remote "cd ~/$PROJECT_NAME && cp env.example .env"

echo -e "${BLUE}🚀 Paso 9: Iniciando EU Chat Bridge...${NC}"
run_remote "cd ~/$PROJECT_NAME && pm2 start dist/index.js --name eu-chat -- --port $BACKEND_PORT"
run_remote "pm2 save"

echo -e "${BLUE}✅ Paso 10: Verificando despliegue...${NC}"
run_remote "pm2 status"
run_remote "netstat -tlnp | grep :$BACKEND_PORT"
run_remote "curl -s http://localhost:$BACKEND_PORT/health"

echo -e "${GREEN}🎉 ¡Despliegue de EU Chat Bridge completado exitosamente!${NC}"
echo ""
echo -e "${BLUE}📱 Aplicaciones corriendo:${NC}"
echo -e "   🎰 spainbingo: http://$EC2_HOST:3000 (puerto 3000)"
echo -e "   🚀 EU Chat Bridge: http://$EC2_HOST:3001 (puerto 3001)"
echo -e "   🌐 EU Chat Bridge via Nginx: http://$EC2_HOST:81 (puerto 81)"
echo ""
echo -e "${BLUE}🔗 Health Checks:${NC}"
echo -e "   spainbingo: http://$EC2_HOST:3000/health"
echo -e "   EU Chat Bridge: http://$EC2_HOST:3001/health"
echo ""
echo -e "${YELLOW}💡 Comandos útiles:${NC}"
echo -e "   Conectar: ssh -i $KEY_FILE $EC2_USER@$EC2_HOST"
echo -e "   Logs spainbingo: pm2 logs spainbingo"
echo -e "   Logs EU Chat: pm2 logs eu-chat"
echo -e "   Estado general: pm2 status"
echo -e "   Reiniciar EU Chat: pm2 restart eu-chat"
echo ""
echo -e "${GREEN}✅ spainbingo sigue funcionando normalmente en puerto 3000${NC}"
