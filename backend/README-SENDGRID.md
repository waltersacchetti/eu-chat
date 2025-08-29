# Configuración de SendGrid para EU Chat Bridge

## Requisitos

Para que la funcionalidad de verificación de email funcione, necesitas configurar SendGrid:

### 1. Obtener API Key de SendGrid

1. Ve a [SendGrid](https://sendgrid.com/) y crea una cuenta
2. Genera una API Key con permisos de "Mail Send"
3. Copia la API Key

### 2. Configurar Variables de Entorno

Agrega la siguiente variable a tu archivo `.env`:

```bash
SENDGRID_API_KEY=tu_api_key_aqui
```

### 3. Verificar Configuración

El sistema está configurado para usar:
- **From Email**: noreply@euchatbridge.com
- **From Name**: EU Chat Bridge

### 4. Funcionalidades Disponibles

- ✅ Verificación de email durante registro
- ✅ Reenvío de verificación
- ✅ Recuperación de contraseña
- ✅ Email de bienvenida

### 5. Notas Importantes

- La API Key debe tener permisos de "Mail Send"
- El dominio noreply@euchatbridge.com debe estar verificado en SendGrid
- Los emails se envían automáticamente cuando se registra un usuario

## Solución de Problemas

Si los emails no se envían:

1. Verifica que la API Key esté configurada correctamente
2. Revisa los logs del backend para errores de SendGrid
3. Verifica que el dominio esté verificado en SendGrid
4. Asegúrate de que la API Key tenga los permisos correctos
