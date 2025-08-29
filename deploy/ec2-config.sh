#!/bin/bash

# Configuración de despliegue para EU Chat Bridge en EC2
# Archivo: spainbingo-key.pem debe estar en la carpeta deploy/

# Variables de configuración
EC2_HOST="54.247.227.217"     # IP pública de tu EC2
EC2_USER="ec2-user"           # Usuario por defecto de Amazon Linux
KEY_FILE="spainbingo-key.pem"
INSTANCE_ID="i-04ab7400a1c44d0d6"
PROJECT_NAME="eu-chat"
BACKEND_PORT="3001"

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Configuración de despliegue EU Chat Bridge${NC}"
echo "=================================================="

# Verificar que existe la clave privada
if [ ! -f "$KEY_FILE" ]; then
    echo -e "${RED}❌ Error: No se encontró el archivo de clave $KEY_FILE${NC}"
    echo "Por favor, coloca el archivo spainbingo-key.pem en la carpeta deploy/"
    exit 1
fi

# Configurar permisos de la clave
chmod 400 "$KEY_FILE"
echo -e "${GREEN}✅ Permisos de clave configurados${NC}"

# Función para conectar al servidor
connect_ssh() {
    echo -e "${YELLOW}🔗 Conectando al servidor EC2...${NC}"
    ssh -i "$KEY_FILE" "$EC2_USER@$EC2_HOST"
}

# Función para ejecutar comando remoto
run_remote() {
    local command="$1"
    echo -e "${YELLOW}🔄 Ejecutando comando remoto: $command${NC}"
    ssh -i "$KEY_FILE" "$EC2_USER@$EC2_HOST" "$command"
}

# Función para copiar archivos
copy_files() {
    local source="$1"
    local destination="$2"
    echo -e "${YELLOW}📁 Copiando archivos...${NC}"
    scp -i "$KEY_FILE" -r "$source" "$EC2_USER@$EC2_HOST:$destination"
}

# Función para instalar dependencias del sistema
install_system_deps() {
    echo -e "${YELLOW}📦 Instalando dependencias del sistema...${NC}"
    run_remote "sudo yum update -y"
    run_remote "sudo yum install -y nodejs npm git nginx"
    run_remote "sudo yum install -y postgresql15"
    run_remote "curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash"
    run_remote "source ~/.bashrc && nvm install 18 && nvm use 18"
}

# Función para configurar Nginx
setup_nginx() {
    echo -e "${YELLOW}🌐 Configurando Nginx...${NC}"
    local nginx_config="
server {
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
    run_remote "sudo systemctl status nginx"
}

# Función para configurar PM2
setup_pm2() {
    echo -e "${YELLOW}⚡ Configurando PM2...${NC}"
    run_remote "npm install -g pm2"
    run_remote "pm2 startup"
}

# Función para desplegar la aplicación
deploy_app() {
    echo -e "${YELLOW}🚀 Desplegando aplicación...${NC}"
    
    # Crear directorio del proyecto
    run_remote "mkdir -p ~/$PROJECT_NAME"
    
    # Copiar archivos del backend
    copy_files "../backend" "~/$PROJECT_NAME/"
    
    # Instalar dependencias
    run_remote "cd ~/$PROJECT_NAME && npm install"
    
    # Construir la aplicación
    run_remote "cd ~/$PROJECT_NAME && npm run build"
    
    # Configurar variables de entorno
    run_remote "cd ~/$PROJECT_NAME && cp env.example .env"
    
    # Iniciar con PM2
    run_remote "cd ~/$PROJECT_NAME && pm2 start dist/index.js --name eu-chat-bridge"
    run_remote "pm2 save"
    run_remote "pm2 status"
}

# Función para mostrar logs
show_logs() {
    echo -e "${YELLOW}📋 Mostrando logs de la aplicación...${NC}"
    run_remote "pm2 logs eu-chat-bridge --lines 50"
}

# Función para reiniciar la aplicación
restart_app() {
    echo -e "${YELLOW}🔄 Reiniciando aplicación...${NC}"
    run_remote "pm2 restart eu-chat-bridge"
    run_remote "pm2 status"
}

# Función para mostrar estado
show_status() {
    echo -e "${YELLOW}📊 Estado de la aplicación...${NC}"
    run_remote "pm2 status"
    run_remote "sudo systemctl status nginx"
    run_remote "curl -s http://localhost:$BACKEND_PORT/health"
}

# Menú principal
show_menu() {
    echo -e "${BLUE}📋 Menú de despliegue:${NC}"
    echo "1. Conectar al servidor SSH"
    echo "2. Instalar dependencias del sistema"
    echo "3. Configurar Nginx"
    echo "4. Configurar PM2"
    echo "5. Desplegar aplicación"
    echo "6. Mostrar logs"
    echo "7. Reiniciar aplicación"
    echo "8. Mostrar estado"
    echo "9. Salir"
    echo ""
    read -p "Selecciona una opción: " choice
    
    case $choice in
        1) connect_ssh ;;
        2) install_system_deps ;;
        3) setup_nginx ;;
        4) setup_pm2 ;;
        5) deploy_app ;;
        6) show_logs ;;
        7) restart_app ;;
        8) show_status ;;
        9) echo -e "${GREEN}👋 ¡Hasta luego!${NC}"; exit 0 ;;
        *) echo -e "${RED}❌ Opción inválida${NC}"; show_menu ;;
    esac
}

# Verificar argumentos de línea de comandos
if [ "$1" = "connect" ]; then
    connect_ssh
elif [ "$1" = "deploy" ]; then
    deploy_app
elif [ "$1" = "status" ]; then
    show_status
else
    show_menu
fi
