#!/bin/bash

# Despliegue rápido de EU Chat Bridge en EC2
# Ejecutar desde la raíz del proyecto

set -e  # Salir si hay algún error

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

echo -e "${BLUE}🚀 Despliegue rápido EU Chat Bridge${NC}"
echo "=========================================="

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

echo -e "${BLUE}📦 Paso 1: Instalando dependencias del sistema...${NC}"
run_remote "sudo yum update -y"
run_remote "sudo yum install -y nodejs npm git nginx postgresql15"
run_remote "curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash"
run_remote "source ~/.bashrc && nvm install 18 && nvm use 18 && nvm alias default 18"

echo -e "${BLUE}⚡ Paso 2: Configurando PM2...${NC}"
run_remote "npm install -g pm2"
run_remote "pm2 startup"

echo -e "${BLUE}🌐 Paso 3: Configurando Nginx...${NC}"
nginx_config="server {
    listen 80;
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
run_remote "sudo systemctl enable nginx"
run_remote "sudo systemctl start nginx"

echo -e "${BLUE}🚀 Paso 4: Desplegando aplicación...${NC}"
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

echo -e "${BLUE}🚀 Paso 9: Iniciando aplicación...${NC}"
run_remote "cd ~/$PROJECT_NAME && pm2 start dist/index.js --name eu-chat-bridge"
run_remote "pm2 save"

echo -e "${BLUE}✅ Paso 10: Verificando despliegue...${NC}"
run_remote "pm2 status"
run_remote "sudo systemctl status nginx"
run_remote "curl -s http://localhost:$BACKEND_PORT/health"

echo -e "${GREEN}🎉 ¡Despliegue completado exitosamente!${NC}"
echo ""
echo -e "${BLUE}📱 Tu aplicación está disponible en:${NC}"
echo -e "   🌐 HTTP: http://$EC2_HOST"
echo -e "   🔗 Health: http://$EC2_HOST/health"
echo -e "   📊 PM2: pm2 status (en el servidor)"
echo ""
echo -e "${YELLOW}💡 Comandos útiles:${NC}"
echo -e "   Conectar: ssh -i $KEY_FILE $EC2_USER@$EC2_HOST"
echo -e "   Logs: pm2 logs eu-chat-bridge"
echo -e "   Reiniciar: pm2 restart eu-chat-bridge"
echo -e "   Estado: pm2 status"
