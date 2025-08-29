#!/bin/bash

# Conexión rápida SSH a la instancia EC2
# Archivo: spainbingo-key.pem debe estar en la carpeta deploy/

EC2_HOST="54.247.227.217"
EC2_USER="ec2-user"
KEY_FILE="spainbingo-key.pem"

# Verificar que existe la clave privada
if [ ! -f "$KEY_FILE" ]; then
    echo "❌ Error: No se encontró el archivo de clave $KEY_FILE"
    echo "Por favor, coloca el archivo spainbingo-key.pem en la carpeta deploy/"
    exit 1
fi

# Configurar permisos de la clave
chmod 400 "$KEY_FILE"

echo "🔗 Conectando a EU Chat Bridge EC2..."
echo "📍 IP: $EC2_HOST"
echo "👤 Usuario: $EC2_USER"
echo ""

# Conectar via SSH
ssh -i "$KEY_FILE" -o StrictHostKeyChecking=no "$EC2_USER@$EC2_HOST"
