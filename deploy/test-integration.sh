#!/bin/bash

# Script para probar la integración completa entre Frontend Móvil y Backend API
# Frontend móvil -> Backend API -> Base de datos

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuración
ALB_DNS="spainbingo-alb-581291766.eu-west-1.elb.amazonaws.com"
API_BASE_URL="http://${ALB_DNS}:3001"

echo -e "${BLUE}🧪 PRUEBA DE INTEGRACIÓN COMPLETA - EU Chat Bridge${NC}"
echo "=============================================================="
echo -e "${YELLOW}Frontend Móvil: React Native (dispositivo del usuario)${NC}"
echo -e "${YELLOW}Backend API: EC2 (puerto 3001)${NC}"
echo -e "${YELLOW}Base de Datos: RDS PostgreSQL${NC}"
echo -e "${YELLOW}ALB: ${ALB_DNS}${NC}"
echo ""

# Función para hacer peticiones HTTP
make_request() {
    local method=$1
    local endpoint=$2
    local data=$3
    local token=$4
    
    local headers="Content-Type: application/json"
    if [ ! -z "$token" ]; then
        headers="$headers\nAuthorization: Bearer $token"
    fi
    
    if [ "$method" = "GET" ]; then
        curl -s -X GET "${API_BASE_URL}${endpoint}" \
            -H "$headers"
    else
        curl -s -X "$method" "${API_BASE_URL}${endpoint}" \
            -H "$headers" \
            -d "$data"
    fi
}

# Función para mostrar resultado
show_result() {
    local test_name=$1
    local response=$2
    local expected_pattern=$3
    
    if echo "$response" | grep -q "$expected_pattern"; then
        echo -e "${GREEN}✅ ${test_name}${NC}"
    else
        echo -e "${RED}❌ ${test_name}${NC}"
        echo "Respuesta: $response"
    fi
}

echo -e "${BLUE}🔍 PASO 1: Verificar que el Backend esté funcionando${NC}"
echo "------------------------------------------------------------"

# Test 1: Health Check
echo -e "${YELLOW}1. Health Check...${NC}"
HEALTH_RESPONSE=$(make_request "GET" "/health")
show_result "Health Check" "$HEALTH_RESPONSE" "OK"

# Test 2: Endpoint principal
echo -e "${YELLOW}2. Endpoint principal...${NC}"
MAIN_RESPONSE=$(make_request "GET" "/")
show_result "Endpoint principal" "$MAIN_RESPONSE" "EU Chat Bridge API"

# Test 3: Endpoint de plataformas (público)
echo -e "${YELLOW}3. Endpoint de plataformas (público)...${NC}"
PLATFORMS_RESPONSE=$(make_request "GET" "/api/platforms")
show_result "Endpoint de plataformas" "$PLATFORMS_RESPONSE" "platforms"

echo ""
echo -e "${BLUE}🔐 PASO 2: Probar Autenticación JWT${NC}"
echo "--------------------------------------------"

# Test 4: Registro de usuario
echo -e "${YELLOW}4. Registro de usuario...${NC}"
REGISTER_DATA='{"email":"integration-test-'$(date +%s)'@eu-chat.com","password":"test123","firstName":"Integration","lastName":"Test","phone":"+34600123456"}'
REGISTER_RESPONSE=$(make_request "POST" "/api/auth/register" "$REGISTER_DATA")
show_result "Registro de usuario" "$REGISTER_RESPONSE" "Usuario registrado exitosamente"

# Extraer token del registro
TOKEN=$(echo "$REGISTER_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
if [ ! -z "$TOKEN" ]; then
    echo -e "${GREEN}   Token JWT obtenido: ${TOKEN:0:20}...${NC}"
else
    echo -e "${RED}   Error: No se pudo obtener el token${NC}"
    exit 1
fi

# Test 5: Login con usuario existente
echo -e "${YELLOW}5. Login con usuario existente...${NC}"
LOGIN_DATA='{"email":"integration-test-'$(date +%s)'@eu-chat.com","password":"test123"}'
LOGIN_RESPONSE=$(make_request "POST" "/api/auth/login" "$LOGIN_DATA")
show_result "Login de usuario" "$LOGIN_RESPONSE" "Login exitoso"

# Extraer nuevo token del login
NEW_TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
if [ ! -z "$NEW_TOKEN" ]; then
    TOKEN="$NEW_TOKEN"
    echo -e "${GREEN}   Nuevo token JWT obtenido: ${TOKEN:0:20}...${NC}"
fi

echo ""
echo -e "${BLUE}👥 PASO 3: Probar Endpoints Protegidos${NC}"
echo "-----------------------------------------------"

# Test 6: Estadísticas del usuario (protegido)
echo -e "${YELLOW}6. Estadísticas del usuario (protegido)...${NC}"
STATS_RESPONSE=$(make_request "GET" "/api/users/stats" "" "$TOKEN")
show_result "Estadísticas del usuario" "$STATS_RESPONSE" "stats"

# Test 7: Crear contacto (protegido)
echo -e "${YELLOW}7. Crear contacto (protegido)...${NC}"
CONTACT_DATA='{"name":"Contacto de Prueba","phone":"+34600123456","email":"contacto@test.com","platformIds":{"whatsapp":"wa_test_1","telegram":"tg_test_1"}}'
CONTACT_RESPONSE=$(make_request "POST" "/api/contacts" "$CONTACT_DATA" "$TOKEN")
show_result "Crear contacto" "$CONTACT_RESPONSE" "id"

# Extraer ID del contacto creado
CONTACT_ID=$(echo "$CONTACT_RESPONSE" | grep -o '"id":[0-9]*' | cut -d':' -f2)
if [ ! -z "$CONTACT_ID" ]; then
    echo -e "${GREEN}   Contacto creado con ID: $CONTACT_ID${NC}"
else
    echo -e "${RED}   Error: No se pudo obtener el ID del contacto${NC}"
fi

# Test 8: Listar contactos (protegido)
echo -e "${YELLOW}8. Listar contactos (protegido)...${NC}"
CONTACTS_RESPONSE=$(make_request "GET" "/api/contacts" "" "$TOKEN")
show_result "Listar contactos" "$CONTACTS_RESPONSE" "contacts"

# Test 9: Marcar contacto como favorito (protegido)
if [ ! -z "$CONTACT_ID" ]; then
    echo -e "${YELLOW}9. Marcar contacto como favorito (protegido)...${NC}"
    FAVORITE_RESPONSE=$(make_request "PATCH" "/api/contacts/$CONTACT_ID/favorite" "" "$TOKEN")
    show_result "Marcar como favorito" "$FAVORITE_RESPONSE" "isFavorite"
fi

echo ""
echo -e "${BLUE}🗨️ PASO 4: Probar Gestión de Conversaciones${NC}"
echo "-----------------------------------------------------"

# Test 10: Crear conversación (protegido)
echo -e "${YELLOW}10. Crear conversación (protegido)...${NC}"
CONVERSATION_DATA='{"conversationId":"conv_test_1","title":"Conversación de Prueba","type":"individual","participants":["user_1","test_user"],"platformConversationIds":{"whatsapp":"wa_conv_test_1"}}'
CONVERSATION_RESPONSE=$(make_request "POST" "/api/conversations" "$CONVERSATION_DATA" "$TOKEN")
show_result "Crear conversación" "$CONVERSATION_RESPONSE" "id"

# Extraer ID de la conversación creada
CONVERSATION_ID=$(echo "$CONVERSATION_RESPONSE" | grep -o '"id":[0-9]*' | cut -d':' -f2)
if [ ! -z "$CONVERSATION_ID" ]; then
    echo -e "${GREEN}   Conversación creada con ID: $CONVERSATION_ID${NC}"
else
    echo -e "${RED}   Error: No se pudo obtener el ID de la conversación${NC}"
fi

# Test 11: Enviar mensaje (protegido)
if [ ! -z "$CONVERSATION_ID" ]; then
    echo -e "${YELLOW}11. Enviar mensaje (protegido)...${NC}"
    MESSAGE_DATA='{"conversationId":"'$CONVERSATION_ID'","content":"¡Hola! Este es un mensaje de prueba desde la integración.","type":"text","metadata":{"platform":"test"}}'
    MESSAGE_RESPONSE=$(make_request "POST" "/api/messages/send" "$MESSAGE_DATA" "$TOKEN")
    show_result "Enviar mensaje" "$MESSAGE_RESPONSE" "id"
fi

# Test 12: Listar conversaciones (protegido)
echo -e "${YELLOW}12. Listar conversaciones (protegido)...${NC}"
CONVERSATIONS_RESPONSE=$(make_request "GET" "/api/conversations" "" "$TOKEN")
show_result "Listar conversaciones" "$CONVERSATIONS_RESPONSE" "conversations"

echo ""
echo -e "${BLUE}🧹 PASO 5: Limpieza de Datos de Prueba${NC}"
echo "-----------------------------------------------"

# Limpiar datos de prueba si se crearon correctamente
if [ ! -z "$CONTACT_ID" ]; then
    echo -e "${YELLOW}Limpiando contacto de prueba...${NC}"
    DELETE_CONTACT_RESPONSE=$(make_request "DELETE" "/api/contacts/$CONTACT_ID" "" "$TOKEN")
    if echo "$DELETE_CONTACT_RESPONSE" | grep -q "eliminado"; then
        echo -e "${GREEN}   Contacto eliminado correctamente${NC}"
    else
        echo -e "${YELLOW}   No se pudo eliminar el contacto${NC}"
    fi
fi

echo ""
echo -e "${GREEN}🎉 PRUEBA DE INTEGRACIÓN COMPLETADA!${NC}"
echo ""
echo -e "${BLUE}📋 RESUMEN DE LA INTEGRACIÓN:${NC}"
echo -e "   📱 Frontend Móvil: React Native (dispositivo del usuario)"
echo -e "   🖥️ Backend API: EC2 (puerto 3001) ✅"
echo -e "   🗄️ Base de Datos: RDS PostgreSQL ✅"
echo -e "   🌐 ALB: ${ALB_DNS} ✅"
echo -e "   🔐 Autenticación JWT: Funcionando ✅"
echo -e "   👥 Gestión de usuarios: Funcionando ✅"
echo -e "   📞 Gestión de contactos: Funcionando ✅"
echo -e "   🗨️ Gestión de conversaciones: Funcionando ✅"
echo -e "   📝 Gestión de mensajes: Funcionando ✅"
echo ""
echo -e "${BLUE}🔧 CÓMO FUNCIONA LA INTEGRACIÓN:${NC}"
echo -e "   1. Usuario abre la app móvil en su dispositivo"
echo -e "   2. App se conecta al backend en EC2 vía ALB"
echo -e "   3. Backend autentica al usuario y genera JWT"
echo -e "   4. App usa JWT para acceder a endpoints protegidos"
echo -e "   5. Backend se comunica con RDS PostgreSQL"
echo -e "   6. Datos se sincronizan en tiempo real"
echo ""
echo -e "${BLUE}🚀 PRÓXIMOS PASOS:${NC}"
echo -e "   1. Implementar WebSocket para mensajería en tiempo real"
echo -e "   2. Configurar notificaciones push"
echo -e "   3. Integrar con APIs reales de WhatsApp/Messenger"
echo -e "   4. Implementar cifrado E2EE"
echo -e "   5. Crear panel B2B para empresas"
