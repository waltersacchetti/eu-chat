#!/bin/bash

# Script para verificar el estado actual del servidor EC2
# y ver qué aplicaciones están corriendo

EC2_HOST="54.247.227.217"
EC2_USER="ec2-user"
KEY_FILE="spainbingo-key.pem"

echo "🔍 Verificando estado del servidor EC2..."
echo "=========================================="

# Verificar que existe la clave privada
if [ ! -f "$KEY_FILE" ]; then
    echo "❌ Error: No se encontró $KEY_FILE"
    exit 1
fi

# Configurar permisos de la clave
chmod 400 "$KEY_FILE"

echo ""
echo "📊 Estado de PM2:"
echo "-----------------"
ssh -i "$KEY_FILE" -o StrictHostKeyChecking=no "$EC2_USER@$EC2_HOST" "pm2 status"

echo ""
echo "🌐 Puertos en uso:"
echo "------------------"
ssh -i "$KEY_FILE" -o StrictHostKeyChecking=no "$EC2_USER@$EC2_HOST" "netstat -tlnp | grep LISTEN"

echo ""
echo "📦 Procesos Node.js:"
echo "-------------------"
ssh -i "$KEY_FILE" -o StrictHostKeyChecking=no "$EC2_USER@$EC2_HOST" "ps aux | grep node"

echo ""
echo "🗄️ Estado de Nginx:"
echo "------------------"
ssh -i "$KEY_FILE" -o StrictHostKeyChecking=no "$EC2_USER@$EC2_HOST" "sudo systemctl status nginx --no-pager"

echo ""
echo "💾 Espacio en disco:"
echo "-------------------"
ssh -i "$KEY_FILE" -o StrictHostKeyChecking=no "$EC2_USER@$EC2_HOST" "df -h"

echo ""
echo "🧠 Uso de memoria:"
echo "-----------------"
ssh -i "$KEY_FILE" -o StrictHostKeyChecking=no "$EC2_USER@$EC2_HOST" "free -h"

echo ""
echo "🔍 Verificando puerto 3000 (spainbingo):"
echo "----------------------------------------"
ssh -i "$KEY_FILE" -o StrictHostKeyChecking=no "$EC2_USER@$EC2_HOST" "curl -s http://localhost:3000/health || echo 'Puerto 3000 no responde'"

echo ""
echo "🔍 Verificando puerto 3001 (disponible para EU Chat Bridge):"
echo "----------------------------------------------------------"
ssh -i "$KEY_FILE" -o StrictHostKeyChecking=no "$EC2_USER@$EC2_HOST" "curl -s http://localhost:3001/health || echo 'Puerto 3001 disponible'"

echo ""
echo "✅ Verificación completada"
