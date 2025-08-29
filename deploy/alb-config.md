# 🚀 Configuración del Application Load Balancer (ALB)

## 📋 Información de la Infraestructura

- **EC2 Instance ID:** `i-04ab7400a1c44d0d6`
- **EC2 Public IP:** `54.247.227.217`
- **EC2 Private IP:** (se obtiene desde la consola AWS)
- **RDS Endpoint:** `spainbingo-db.clzgxn85wdjh.eu-west-1.rds.amazonaws.com`
- **Región:** `eu-west-1`

## 🔧 Configuración del ALB

### Target Group
- **Protocol:** HTTP
- **Port:** 3000
- **Target Type:** Instance
- **Target:** `i-04ab7400a1c44d0d6:3000`
- **Health Check Path:** `/health`
- **Health Check Protocol:** HTTP
- **Health Check Port:** 3000
- **Healthy Threshold:** 2
- **Unhealthy Threshold:** 3
- **Timeout:** 5 seconds
- **Interval:** 30 seconds

### Listener
- **Protocol:** HTTP
- **Port:** 80
- **Default Action:** Forward to Target Group

### Security Group del ALB
```json
{
  "GroupName": "eu-chat-bridge-alb-sg",
  "Description": "Security group for EU Chat Bridge ALB",
  "Rules": [
    {
      "Type": "HTTP",
      "Port": 80,
      "Source": "0.0.0.0/0",
      "Description": "Allow HTTP from anywhere"
    }
  ]
}
```

### Security Group de la EC2
```json
{
  "GroupName": "eu-chat-bridge-ec2-sg",
  "Description": "Security group for EU Chat Bridge EC2",
  "Rules": [
    {
      "Type": "HTTP",
      "Port": 3000,
      "Source": "eu-chat-bridge-alb-sg",
      "Description": "Allow HTTP from ALB"
    },
    {
      "Type": "SSH",
      "Port": 22,
      "Source": "0.0.0.0/0",
      "Description": "Allow SSH from anywhere"
    },
    {
      "Type": "PostgreSQL",
      "Port": 5432,
      "Source": "eu-chat-bridge-rds-sg",
      "Description": "Allow PostgreSQL from RDS"
    }
  ]
}
```

## 🌐 URLs de Acceso

### Desarrollo Local
- **Backend API:** `http://localhost:3000`
- **Health Check:** `http://localhost:3000/health`
- **Mobile App:** `http://localhost:19006`

### Producción (EC2)
- **Backend API:** `http://54.247.227.217:3000`
- **Health Check:** `http://54.247.227.217:3000/health`
- **Nginx Proxy:** `http://54.247.227.217`

### Producción (ALB)
- **Backend API:** `http://tu-alb-dns-name.region.elb.amazonaws.com`
- **Health Check:** `http://tu-alb-dns-name.region.elb.amazonaws.com/health`

## 🔍 Verificación del Despliegue

### 1. Verificar EC2
```bash
# Conectar via SSH
ssh -i deploy/spainbingo-key.pem ec2-user@54.247.227.217

# Verificar estado de la aplicación
pm2 status
pm2 logs eu-chat-bridge

# Verificar Nginx
sudo systemctl status nginx
sudo nginx -t

# Verificar puerto
netstat -tlnp | grep :3000
```

### 2. Verificar Base de Datos
```bash
# Conectar a RDS
psql -h spainbingo-db.clzgxn85wdjh.eu-west-1.rds.amazonaws.com \
     -U spainbingo_admin \
     -d spainbingo

# Verificar tablas
\dt
SELECT * FROM users LIMIT 5;
```

### 3. Verificar ALB
```bash
# Health check desde el ALB
curl -v http://tu-alb-dns-name.region.elb.amazonaws.com/health

# Verificar target group health
aws elbv2 describe-target-health \
  --target-group-arn tu-target-group-arn
```

## 🚨 Troubleshooting

### Problemas Comunes

1. **EC2 no responde en puerto 3000**
   - Verificar que la app esté corriendo: `pm2 status`
   - Verificar logs: `pm2 logs eu-chat-bridge`
   - Verificar firewall: `sudo iptables -L`

2. **Nginx no funciona**
   - Verificar configuración: `sudo nginx -t`
   - Verificar estado: `sudo systemctl status nginx`
   - Verificar logs: `sudo tail -f /var/log/nginx/error.log`

3. **Base de datos no conecta**
   - Verificar security groups
   - Verificar credenciales en `.env`
   - Verificar conectividad: `telnet spainbingo-db.clzgxn85wdjh.eu-west-1.rds.amazonaws.com 5432`

4. **ALB health check falla**
   - Verificar que la EC2 responda en `/health`
   - Verificar security groups del ALB
   - Verificar target group configuration

## 📊 Monitoreo

### CloudWatch Metrics
- **EC2:** CPU, Memory, Network
- **RDS:** CPU, Memory, Connections
- **ALB:** Request Count, Target Response Time, HTTP 5XX Count

### Logs
- **Application:** `pm2 logs eu-chat-bridge`
- **Nginx:** `/var/log/nginx/`
- **System:** `/var/log/messages`
- **PM2:** `~/.pm2/logs/`

## 🔄 Actualizaciones

### Despliegue de Nuevas Versiones
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

# 7. Reiniciar aplicación
pm2 restart eu-chat-bridge
pm2 save
```
