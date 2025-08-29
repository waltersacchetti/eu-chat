# 🚀 Guía de Despliegue - EU Chat Bridge

## 📋 Prerrequisitos

### 1. Archivos Necesarios
- **Clave privada:** `spainbingo-key.pem` (colocar en carpeta `deploy/`)
- **Permisos de clave:** `chmod 400 deploy/spainbingo-key.pem`

### 2. Infraestructura AWS
- ✅ **EC2 Instance:** `i-04ab7400a1c44d0d6` (54.247.227.217)
- ✅ **RDS PostgreSQL:** `spainbingo-db.clzgxn85wdjh.eu-west-1.rds.amazonaws.com`
- ✅ **ALB:** Configurado y apuntando a la EC2

### 3. Software Local
- Node.js 18+
- npm 9+
- Git

## 🚀 Despliegue Rápido

### Opción 1: Despliegue Automático (Recomendado)
```bash
# Desde la raíz del proyecto
cd deploy/
chmod +x quick-deploy.sh
./quick-deploy.sh
```

### Opción 2: Despliegue Manual
```bash
# 1. Conectar al servidor
./connect.sh

# 2. En el servidor, ejecutar:
sudo yum update -y
sudo yum install -y nodejs npm git nginx postgresql15
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc && nvm install 18 && nvm use 18
npm install -g pm2
```

## 🔧 Configuración del Servidor

### 1. Instalar Dependencias del Sistema
```bash
# Conectar al servidor
ssh -i deploy/spainbingo-key.pem ec2-user@54.247.227.217

# Actualizar sistema
sudo yum update -y

# Instalar paquetes necesarios
sudo yum install -y nodejs npm git nginx postgresql15

# Instalar Node.js 18 via NVM
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 18
nvm use 18
nvm alias default 18

# Instalar PM2 globalmente
npm install -g pm2
pm2 startup
```

### 2. Configurar Nginx
```bash
# Crear configuración de Nginx
sudo tee /etc/nginx/conf.d/eu-chat-bridge.conf > /dev/null <<EOF
server {
    listen 80;
    server_name _;
    
    location / {
        proxy_pass http://localhost:3000;
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
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

# Habilitar y iniciar Nginx
sudo systemctl enable nginx
sudo systemctl start nginx
sudo systemctl status nginx
```

### 3. Desplegar Aplicación
```bash
# Crear directorio del proyecto
mkdir -p ~/eu-chat-bridge
cd ~/eu-chat-bridge

# Copiar archivos del backend (desde tu máquina local)
scp -i ../../deploy/spainbingo-key.pem -r ../../backend/* ec2-user@54.247.227.217:~/eu-chat-bridge/

# En el servidor, instalar dependencias
npm install

# Ejecutar migraciones de base de datos
npm run db:migrate

# Construir la aplicación
npm run build

# Configurar variables de entorno
cp env.example .env
# Editar .env con las credenciales correctas

# Iniciar con PM2
pm2 start dist/index.js --name eu-chat-bridge
pm2 save
pm2 status
```

## 🔍 Verificación del Despliegue

### 1. Verificar Estado de la Aplicación
```bash
# Verificar PM2
pm2 status
pm2 logs eu-chat-bridge

# Verificar puerto
netstat -tlnp | grep :3000

# Verificar logs
tail -f ~/.pm2/logs/eu-chat-bridge-out.log
tail -f ~/.pm2/logs/eu-chat-bridge-error.log
```

### 2. Verificar Nginx
```bash
# Verificar estado
sudo systemctl status nginx

# Verificar configuración
sudo nginx -t

# Verificar logs
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

### 3. Verificar Base de Datos
```bash
# Conectar a RDS
psql -h spainbingo-db.clzgxn85wdjh.eu-west-1.rds.amazonaws.com \
     -U spainbingo_admin \
     -d spainbingo

# Verificar tablas
\dt
SELECT COUNT(*) FROM users;
```

### 4. Verificar Endpoints
```bash
# Health check local
curl http://localhost:3000/health

# Health check via Nginx
curl http://localhost/health

# API endpoints
curl http://localhost:3000/
curl http://localhost:3000/api/auth
```

## 🌐 URLs de Acceso

### Desarrollo Local
- **Backend:** `http://localhost:3000`
- **Health:** `http://localhost:3000/health`

### Producción
- **EC2 Directo:** `http://54.247.227.217:3000`
- **Via Nginx:** `http://54.247.227.217`
- **Via ALB:** `http://tu-alb-dns-name.region.elb.amazonaws.com`

## 🚨 Troubleshooting

### Problemas Comunes

#### 1. EC2 no responde en puerto 3000
```bash
# Verificar que la app esté corriendo
pm2 status
pm2 logs eu-chat-bridge

# Verificar puerto
netstat -tlnp | grep :3000

# Verificar firewall
sudo iptables -L
```

#### 2. Nginx no funciona
```bash
# Verificar configuración
sudo nginx -t

# Verificar estado
sudo systemctl status nginx

# Verificar logs
sudo tail -f /var/log/nginx/error.log
```

#### 3. Base de datos no conecta
```bash
# Verificar conectividad
telnet spainbingo-db.clzgxn85wdjh.eu-west-1.rds.amazonaws.com 5432

# Verificar credenciales en .env
cat .env | grep DB_

# Verificar security groups en AWS Console
```

#### 4. Permisos de archivos
```bash
# Verificar permisos de la clave
ls -la deploy/spainbingo-key.pem

# Configurar permisos correctos
chmod 400 deploy/spainbingo-key.pem
```

## 📊 Monitoreo y Mantenimiento

### Logs Importantes
```bash
# Aplicación
pm2 logs eu-chat-bridge

# Nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Sistema
sudo tail -f /var/log/messages
```

### Comandos Útiles
```bash
# Reiniciar aplicación
pm2 restart eu-chat-bridge

# Reiniciar Nginx
sudo systemctl restart nginx

# Ver estado general
pm2 status
sudo systemctl status nginx
curl -s http://localhost:3000/health
```

### Actualizaciones
```bash
# 1. Conectar al servidor
ssh -i deploy/spainbingo-key.pem ec2-user@54.247.227.217

# 2. Ir al directorio del proyecto
cd ~/eu-chat-bridge

# 3. Pull de cambios
git pull origin main

# 4. Instalar dependencias
npm install

# 5. Ejecutar migraciones
npm run db:migrate

# 6. Construir
npm run build

# 7. Reiniciar
pm2 restart eu-chat-bridge
pm2 save
```

## 🔐 Seguridad

### Firewall y Security Groups
- **EC2:** Solo puerto 22 (SSH) y 3000 (App) abiertos
- **RDS:** Solo accesible desde la EC2
- **ALB:** Solo puerto 80 (HTTP) abierto

### Variables de Entorno
- Nunca committear archivos `.env`
- Usar credenciales seguras
- Rotar claves JWT regularmente

## 📞 Soporte

### Comandos de Emergencia
```bash
# Parar aplicación
pm2 stop eu-chat-bridge

# Parar Nginx
sudo systemctl stop nginx

# Reiniciar servidor
sudo reboot

# Ver logs en tiempo real
pm2 logs eu-chat-bridge --lines 100 -f
```

### Contacto
- **Desarrollador:** Tu nombre
- **Proyecto:** EU Chat Bridge
- **Infraestructura:** AWS EC2 + RDS + ALB
- **Región:** eu-west-1
