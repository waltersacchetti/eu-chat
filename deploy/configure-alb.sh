#!/bin/bash

# Script para configurar el ALB con listener para puerto 3001
# Mantiene el listener existente del puerto 3000 para spainbingo

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuración del ALB
ALB_ARN="arn:aws:elasticloadbalancing:eu-west-1:426448793571:loadbalancer/app/spainbingo-alb/9e0c2b7458d34fdc"
ALB_NAME="spainbingo-alb"
ALB_DNS="spainbingo-alb-9e0c2b7458d34fdc.eu-west-1.elb.amazonaws.com"
TARGET_GROUP_3000="spainbingo-tg-3000"
TARGET_GROUP_3001="eu-chat-tg-3001"
VPC_ID="vpc-xxxxxxxxx"  # Necesitarás obtener este valor
SUBNET_IDS="subnet-xxxxxxxxx,subnet-yyyyyyyyy"  # Necesitarás obtener estos valores

echo -e "${BLUE}🚀 Configuración del ALB para EU Chat Bridge${NC}"
echo "=================================================="
echo -e "${YELLOW}ALB: ${ALB_NAME}${NC}"
echo -e "${YELLOW}DNS: ${ALB_DNS}${NC}"
echo -e "${YELLOW}Puerto 3000: spainbingo (existente)${NC}"
echo -e "${YELLOW}Puerto 3001: EU Chat Bridge (nuevo)${NC}"
echo ""

# Función para verificar si AWS CLI está instalado
check_aws_cli() {
    if ! command -v aws &> /dev/null; then
        echo -e "${RED}❌ AWS CLI no está instalado${NC}"
        echo "Instala AWS CLI: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
        exit 1
    fi
    
    echo -e "${GREEN}✅ AWS CLI instalado${NC}"
}

# Función para verificar configuración de AWS
check_aws_config() {
    if ! aws sts get-caller-identity &> /dev/null; then
        echo -e "${RED}❌ AWS CLI no está configurado${NC}"
        echo "Configura AWS CLI: aws configure"
        exit 1
    fi
    
    echo -e "${GREEN}✅ AWS CLI configurado${NC}"
    aws sts get-caller-identity
}

# Función para obtener información del ALB
get_alb_info() {
    echo -e "${BLUE}📋 Obteniendo información del ALB...${NC}"
    
    ALB_INFO=$(aws elbv2 describe-load-balancers --names ${ALB_NAME} --query 'LoadBalancers[0]' --output json)
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Error obteniendo información del ALB${NC}"
        exit 1
    fi
    
    VPC_ID=$(echo $ALB_INFO | jq -r '.VpcId')
    SUBNET_IDS=$(echo $ALB_INFO | jq -r '.AvailabilityZones[].SubnetId' | tr '\n' ',' | sed 's/,$//')
    
    echo -e "${GREEN}✅ ALB encontrado${NC}"
    echo -e "   VPC: ${VPC_ID}"
    echo -e "   Subnets: ${SUBNET_IDS}"
}

# Función para crear Target Group para puerto 3001
create_target_group_3001() {
    echo -e "${BLUE}🎯 Creando Target Group para puerto 3001...${NC}"
    
    # Crear Target Group
    TG_3001_ARN=$(aws elbv2 create-target-group \
        --name ${TARGET_GROUP_3001} \
        --protocol HTTP \
        --port 3001 \
        --vpc-id ${VPC_ID} \
        --target-type instance \
        --health-check-protocol HTTP \
        --health-check-port 3001 \
        --health-check-path /health \
        --health-check-interval-seconds 30 \
        --health-check-timeout-seconds 5 \
        --healthy-threshold-count 2 \
        --unhealthy-threshold-count 2 \
        --query 'TargetGroups[0].TargetGroupArn' \
        --output text)
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Error creando Target Group${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Target Group creado: ${TG_3001_ARN}${NC}"
    
    # Registrar la instancia EC2 en el Target Group
    echo -e "${BLUE}📝 Registrando instancia EC2 en Target Group...${NC}"
    
    aws elbv2 register-targets \
        --target-group-arn ${TG_3001_ARN} \
        --targets Id=i-04ab7400a1c44d0d6
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Error registrando instancia${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Instancia registrada${NC}"
}

# Función para crear listener para puerto 3001
create_listener_3001() {
    echo -e "${BLUE}🔊 Creando listener para puerto 3001...${NC}"
    
    # Obtener ARN del Target Group
    TG_3001_ARN=$(aws elbv2 describe-target-groups \
        --names ${TARGET_GROUP_3001} \
        --query 'TargetGroups[0].TargetGroupArn' \
        --output text)
    
    # Crear listener
    LISTENER_3001_ARN=$(aws elbv2 create-listener \
        --load-balancer-arn ${ALB_ARN} \
        --protocol HTTP \
        --port 3001 \
        --default-actions Type=forward,TargetGroupArn=${TG_3001_ARN} \
        --query 'Listeners[0].ListenerArn' \
        --output text)
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Error creando listener${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Listener creado: ${LISTENER_3001_ARN}${NC}"
}

# Función para verificar configuración
verify_configuration() {
    echo -e "${BLUE}🔍 Verificando configuración...${NC}"
    
    # Verificar Target Groups
    echo -e "${YELLOW}Target Groups:${NC}"
    aws elbv2 describe-target-groups --query 'TargetGroups[?contains(TargetGroupName, `eu-chat`) || contains(TargetGroupName, `spainbingo`)].{Name:TargetGroupName,Port:Port,Protocol:Protocol,HealthCheckPath:HealthCheckPath}' --output table
    
    # Verificar Listeners
    echo -e "${YELLOW}Listeners:${NC}"
    aws elbv2 describe-listeners --load-balancer-arn ${ALB_ARN} --query 'Listeners[].{Port:Port,Protocol:Protocol,DefaultActions:DefaultActions[0].Type}' --output table
    
    # Verificar Targets
    echo -e "${YELLOW}Targets registrados:${NC}"
    aws elbv2 describe-target-health --target-group-arn ${TG_3001_ARN} --query 'TargetHealthDescriptions[].{Id:Target.Id,Port:Target.Port,Health:TargetHealth.State}' --output table
}

# Función para mostrar URLs de acceso
show_access_urls() {
    echo -e "${GREEN}🎉 Configuración completada!${NC}"
    echo ""
    echo -e "${BLUE}📋 URLs de acceso:${NC}"
    echo -e "   🌐 spainbingo: http://${ALB_DNS}:3000"
    echo -e "   🚀 EU Chat Bridge: http://${ALB_DNS}:3001"
    echo -e "   🔗 Health Check: http://${ALB_DNS}:3001/health"
    echo ""
    echo -e "${BLUE}🔧 Comandos útiles:${NC}"
    echo -e "   📊 Estado ALB: aws elbv2 describe-load-balancers --names ${ALB_NAME}"
    echo -e "   🎯 Target Groups: aws elbv2 describe-target-groups"
    echo -e "   🔊 Listeners: aws elbv2 describe-listeners --load-balancer-arn ${ALB_ARN}"
}

# Función principal
main() {
    echo -e "${BLUE}🚀 Iniciando configuración del ALB...${NC}"
    
    check_aws_cli
    check_aws_config
    get_alb_info
    create_target_group_3001
    create_listener_3001
    verify_configuration
    show_access_urls
    
    echo -e "${GREEN}✅ Configuración del ALB completada exitosamente!${NC}"
}

# Ejecutar función principal
main "$@"
