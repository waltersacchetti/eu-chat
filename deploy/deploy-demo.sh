#!/bin/bash

# Script de despliegue para Demo de EU Chat Bridge
# Despliega la aplicación completa en EC2 con WebSocket y todas las funcionalidades

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
NGINX_PORT="81"

echo -e "${BLUE}🚀 Despliegue Demo - EU Chat Bridge${NC}"
echo "=========================================="
echo -e "${YELLOW}Servidor: ${EC2_HOST}${NC}"
echo -e "${YELLOW}Puerto Backend: ${BACKEND_PORT}${NC}"
echo -e "${YELLOW}Puerto Nginx: ${NGINX_PORT}${NC}"
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

echo -e "${BLUE}🔧 Instalando dependencias del sistema...${NC}"

# Actualizar sistema e instalar dependencias
ssh_exec "
    # Actualizar sistema
    sudo yum update -y
    
    # Instalar Node.js 18 si no está instalado
    if ! command -v node &> /dev/null; then
        echo 'Instalando Node.js 18...'
        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
        source ~/.bashrc
        nvm install 18
        nvm use 18
        nvm alias default 18
    fi
    
    # Instalar PM2 si no está instalado
    if ! command -v pm2 &> /dev/null; then
        echo 'Instalando PM2...'
        npm install -g pm2
    fi
    
    # Instalar Nginx si no está instalado
    if ! command -v nginx &> /dev/null; then
        echo 'Instalando Nginx...'
        sudo yum install -y nginx
        sudo systemctl enable nginx
        sudo systemctl start nginx
    fi
"

echo -e "${GREEN}✅ Dependencias del sistema instaladas${NC}"

echo -e "${BLUE}📁 Creando directorio del proyecto...${NC}"

# Crear directorio del proyecto
ssh_exec "
    mkdir -p ~/${PROJECT_NAME}
    cd ~/${PROJECT_NAME}
    pwd
"

echo -e "${GREEN}✅ Directorio del proyecto creado${NC}"

echo -e "${BLUE}📦 Copiando archivos del backend...${NC}"

# Copiar archivos del backend
scp_copy "backend" "~/${PROJECT_NAME}/"
scp_copy ".env" "~/${PROJECT_NAME}/"

echo -e "${GREEN}✅ Archivos del backend copiados${NC}"

echo -e "${BLUE}🔧 Configurando backend...${NC}"

# Configurar backend
ssh_exec "
    cd ~/${PROJECT_NAME}/backend
    
    # Instalar dependencias
    echo 'Instalando dependencias...'
    npm install
    
    # Construir proyecto
    echo 'Construyendo proyecto...'
    npm run build
    
    # Ejecutar migraciones
    echo 'Ejecutando migraciones...'
    npm run db:migrate
    
    # Ejecutar seeds
    echo 'Ejecutando seeds...'
    npm run db:seed
    
    echo 'Backend configurado exitosamente'
"

echo -e "${GREEN}✅ Backend configurado${NC}"

echo -e "${BLUE}⚙️  Configurando PM2...${NC}"

# Crear archivo de configuración PM2
cat > deploy/ecosystem-demo.config.js << EOF
module.exports = {
  apps: [{
    name: '${PROJECT_NAME}',
    script: './dist/index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: ${BACKEND_PORT}
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
EOF

# Copiar configuración PM2
scp_copy "deploy/ecosystem-demo.config.js" "~/${PROJECT_NAME}/ecosystem.config.js"

echo -e "${GREEN}✅ PM2 configurado${NC}"

echo -e "${BLUE}🌐 Configurando Nginx...${NC}"

# Crear configuración Nginx para EU Chat Bridge
cat > deploy/eu-chat-nginx.conf << EOF
server {
    listen ${NGINX_PORT};
    server_name ${EC2_HOST};
    
    location / {
        proxy_pass http://localhost:${BACKEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # WebSocket support
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
    
    # Health check
    location /health {
        proxy_pass http://localhost:${BACKEND_PORT}/health;
        access_log off;
    }
}
EOF

# Copiar y aplicar configuración Nginx
scp_copy "deploy/eu-chat-nginx.conf" "~/${PROJECT_NAME}/"

ssh_exec "
    # Crear configuración Nginx
    sudo tee /etc/nginx/conf.d/eu-chat.conf < ~/${PROJECT_NAME}/eu-chat-nginx.conf
    
    # Verificar configuración
    sudo nginx -t
    
    # Recargar Nginx
    sudo systemctl reload nginx
    
    echo 'Nginx configurado exitosamente'
"

echo -e "${GREEN}✅ Nginx configurado${NC}"

echo -e "${BLUE}🚀 Iniciando aplicación...${NC}"

# Iniciar aplicación con PM2
ssh_exec "
    cd ~/${PROJECT_NAME}
    
    # Crear directorio de logs
    mkdir -p logs
    
    # Iniciar aplicación
    pm2 start ecosystem.config.js
    
    # Guardar configuración PM2
    pm2 save
    
    # Configurar PM2 para iniciar con el sistema
    pm2 startup
    
    echo 'Aplicación iniciada exitosamente'
"

echo -e "${GREEN}✅ Aplicación iniciada${NC}"

echo -e "${BLUE}🔍 Verificando despliegue...${NC}"

# Verificar que la aplicación esté corriendo
sleep 5

if ssh_exec "pm2 list | grep ${PROJECT_NAME}" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Aplicación corriendo en PM2${NC}"
else
    echo -e "${RED}❌ Error: La aplicación no está corriendo${NC}"
    exit 1
fi

# Verificar puertos
if ssh_exec "netstat -tlnp | grep :${BACKEND_PORT}" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend corriendo en puerto ${BACKEND_PORT}${NC}"
else
    echo -e "${RED}❌ Error: Backend no está corriendo en puerto ${BACKEND_PORT}${NC}"
fi

if ssh_exec "netstat -tlnp | grep :${NGINX_PORT}" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Nginx escuchando en puerto ${NGINX_PORT}${NC}"
else
    echo -e "${RED}❌ Error: Nginx no está escuchando en puerto ${NGINX_PORT}${NC}"
fi

echo ""
echo -e "${GREEN}🎉 ¡Despliegue completado exitosamente!${NC}"
echo ""
echo -e "${BLUE}📱 URLs de acceso:${NC}"
echo -e "${YELLOW}EU Chat Bridge API:${NC} http://${EC2_HOST}:${NGINX_PORT}"
echo -e "${YELLOW}Health Check:${NC} http://${EC2_HOST}:${NGINX_PORT}/health"
echo -e "${YELLOW}spainbingo:${NC} http://${EC2_HOST}:3000"
echo ""
echo -e "${BLUE}🔧 Comandos útiles:${NC}"
echo -e "${YELLOW}Conectar al servidor:${NC} ssh -i ${KEY_FILE} ec2-user@${EC2_HOST}"
echo -e "${YELLOW}Ver logs:${NC} pm2 logs ${PROJECT_NAME}"
echo -e "${YELLOW}Reiniciar:${NC} pm2 restart ${PROJECT_NAME}"
echo -e "${YELLOW}Estado:${NC} pm2 status"
echo ""
echo -e "${BLUE}🧪 Para probar la demo:${NC}"
echo "1. Registra un usuario: POST http://${EC2_HOST}:${NGINX_PORT}/api/auth/register"
echo "2. Inicia sesión: POST http://${EC2_HOST}:${NGINX_PORT}/api/auth/login"
echo "3. Usa el token JWT para las demás operaciones"
echo ""
echo -e "${GREEN}✅ Demo lista para usar!${NC}"
