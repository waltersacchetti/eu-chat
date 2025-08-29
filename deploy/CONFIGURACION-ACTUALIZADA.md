# 🔄 Configuración Actualizada - EU Chat Bridge

## ⚠️ Cambio Importante: Puerto 3001

Debido a que ya tienes **spainbingo** corriendo en el puerto 3000, hemos configurado **EU Chat Bridge** para usar el puerto 3001.

## 📊 Estado Actual del Servidor

### Aplicaciones Corriendo
- 🎰 **spainbingo**: Puerto 3000 (existente)
- 🚀 **EU Chat Bridge**: Puerto 3001 (nuevo)

### Puertos Configurados
- **Puerto 22**: SSH
- **Puerto 80**: Nginx (proxy para spainbingo)
- **Puerto 81**: Nginx (proxy para EU Chat Bridge)
- **Puerto 3000**: spainbingo (directo)
- **Puerto 3001**: EU Chat Bridge (directo)
- **Puerto 5432**: RDS PostgreSQL

## 🌐 URLs de Acceso

### spainbingo (Existente)
- **Directo**: `http://54.247.227.217:3000`
- **Via Nginx**: `http://54.247.227.217` (puerto 80)
- **Health**: `http://54.247.227.217:3000/health`

### EU Chat Bridge (Nuevo)
- **Directo**: `http://54.247.227.217:3001`
- **Via Nginx**: `http://54.247.227.217:81` (puerto 81)
- **Health**: `http://54.247.227.217:3001/health`

## 🚀 Scripts de Despliegue

### 1. Verificar Estado del Servidor
```bash
cd deploy/
chmod +x check-server-status.sh
./check-server-status.sh
```

### 2. Desplegar EU Chat Bridge (Recomendado)
```bash
cd deploy/
chmod +x deploy-eu-chat-bridge.sh
./deploy-eu-chat-bridge.sh
```

### 3. Conexión SSH Rápida
```bash
cd deploy/
chmod +x connect.sh
./connect.sh
```

## 🔧 Configuración de Nginx

### spainbingo (Puerto 80)
```nginx
server {
    listen 80;
    server_name _;
    
    location / {
        proxy_pass http://localhost:3000;  # spainbingo
        # ... configuración existente
    }
}
```

### EU Chat Bridge (Puerto 81)
```nginx
server {
    listen 81;
    server_name _;
    
    location / {
        proxy_pass http://localhost:3001;  # EU Chat Bridge
        # ... configuración nueva
    }
}
```

## 📱 Gestión de Aplicaciones

### Comandos PM2
```bash
# Ver estado de todas las aplicaciones
pm2 status

# Logs de spainbingo
pm2 logs spainbingo

# Logs de EU Chat Bridge
pm2 logs eu-chat-bridge

# Reiniciar EU Chat Bridge
pm2 restart eu-chat-bridge

# Reiniciar spainbingo
pm2 restart spainbingo
```

### Verificar Puertos
```bash
# Ver todos los puertos en uso
netstat -tlnp | grep LISTEN

# Verificar puerto 3000 (spainbingo)
netstat -tlnp | grep :3000

# Verificar puerto 3001 (EU Chat Bridge)
netstat -tlnp | grep :3001
```

## 🗄️ Base de Datos Compartida

Ambas aplicaciones usan la misma base de datos RDS:
- **Host**: `spainbingo-db.clzgxn85wdjh.eu-west-1.rds.amazonaws.com`
- **Database**: `spainbingo`
- **User**: `spainbingo_admin`

### Tablas de EU Chat Bridge
- `users` - Usuarios de la aplicación
- `platforms` - Plataformas de mensajería
- `user_platforms` - Vinculación de usuarios con plataformas
- `contacts` - Contactos unificados
- `messages` - Mensajes de todas las plataformas
- `conversations` - Conversaciones unificadas

## 🔍 Verificación del Despliegue

### 1. Verificar spainbingo
```bash
curl http://54.247.227.217:3000/health
curl http://54.247.227.217/health
```

### 2. Verificar EU Chat Bridge
```bash
curl http://54.247.227.217:3001/health
curl http://54.247.227.217:81/health
```

### 3. Verificar Base de Datos
```bash
# Conectar a RDS
psql -h spainbingo-db.clzgxn85wdjh.eu-west-1.rds.amazonaws.com \
     -U spainbingo_admin \
     -d spainbingo

# Verificar tablas de EU Chat Bridge
\dt | grep -E "(users|platforms|messages|conversations)"
```

## 🚨 Troubleshooting

### Problema: Puerto 3001 no responde
```bash
# Verificar que EU Chat Bridge esté corriendo
pm2 status eu-chat-bridge

# Verificar logs
pm2 logs eu-chat-bridge

# Verificar puerto
netstat -tlnp | grep :3001
```

### Problema: Nginx no funciona en puerto 81
```bash
# Verificar configuración
sudo nginx -t

# Verificar estado
sudo systemctl status nginx

# Verificar logs
sudo tail -f /var/log/nginx/error.log
```

### Problema: spainbingo dejó de funcionar
```bash
# Verificar estado
pm2 status spainbingo

# Verificar puerto 3000
netstat -tlnp | grep :3000

# Reiniciar si es necesario
pm2 restart spainbingo
```

## 📊 Monitoreo

### Logs Importantes
- **spainbingo**: `pm2 logs spainbingo`
- **EU Chat Bridge**: `pm2 logs eu-chat-bridge`
- **Nginx**: `/var/log/nginx/`
- **Sistema**: `/var/log/messages`

### Métricas de Rendimiento
```bash
# Uso de CPU y memoria
htop

# Espacio en disco
df -h

# Estado de servicios
sudo systemctl status nginx
pm2 monit
```

## 🔄 Actualizaciones

### Actualizar EU Chat Bridge
```bash
# 1. Conectar al servidor
ssh -i deploy/spainbingo-key.pem ec2-user@54.247.217

# 2. Ir al directorio
cd ~/eu-chat

# 3. Pull de cambios
git pull origin main

# 4. Instalar y construir
npm install
npm run build

# 5. Reiniciar
pm2 restart eu-chat-bridge
pm2 save
```

### Actualizar spainbingo
```bash
# 1. Conectar al servidor
ssh -i deploy/spainbingo-key.pem ec2-user@54.247.227.217

# 2. Ir al directorio de spainbingo
cd ~/spainbingo  # o el directorio correspondiente

# 3. Actualizar y reiniciar
git pull origin main
npm install
pm2 restart spainbingo
pm2 save
```

## ✅ Resumen

- **spainbingo**: ✅ Funcionando en puerto 3000
- **EU Chat Bridge**: 🚀 Nuevo en puerto 3001
- **Base de datos**: 🗄️ Compartida (RDS)
- **Nginx**: 🌐 Proxy para ambas aplicaciones
- **Sin conflictos**: ✅ Puertos separados

## 🎯 Próximos Pasos

1. **Verificar estado actual**: `./check-server-status.sh`
2. **Desplegar EU Chat Bridge**: `./deploy-eu-chat-bridge.sh`
3. **Verificar funcionamiento**: Health checks en ambos puertos
4. **Configurar ALB**: Apuntar a puerto 81 para EU Chat Bridge
