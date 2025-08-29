# 🚀 EU Chat Bridge

**Hub unificado de mensajería para Europa - Cumplimiento DMA 2024**

## 📋 Descripción

EU Chat Bridge es una plataforma de mensajería unificada que permite a los usuarios comunicarse a través de múltiples plataformas de mensajería desde una sola aplicación. Diseñada para cumplir con el **Digital Markets Act (DMA) 2024** de la Unión Europea, promueve la interoperabilidad entre plataformas de mensajería.

## ✨ Características Principales

- 🔐 **Autenticación JWT** con refresh tokens
- 💬 **Chat en tiempo real** con WebSockets
- 🔒 **Encriptación E2EE** para mensajes
- 📱 **Integración multi-plataforma**:
  - WhatsApp Business API
  - Telegram Bot API
  - Signal (próximamente)
  - Discord (próximamente)
  - Slack (próximamente)
- 🌍 **Cumplimiento DMA 2024** para interoperabilidad
- 📊 **Dashboard de estadísticas** y métricas
- 🔄 **Sincronización automática** entre plataformas

## 🏗️ Arquitectura

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   Base de       │
│   (React Native)│◄──►│   (Node.js)     │◄──►│   Datos (RDS)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   APIs Externas │
                       │  WhatsApp,      │
                       │  Telegram, etc. │
                       └─────────────────┘
```

## 🛠️ Tecnologías

### Backend
- **Node.js** 18+
- **Express.js** - Framework web
- **Socket.IO** - WebSockets en tiempo real
- **PostgreSQL** - Base de datos principal
- **Redis** - Cache y sesiones
- **JWT** - Autenticación
- **bcryptjs** - Encriptación de contraseñas
- **PM2** - Gestión de procesos

### Frontend
- **React Native** - Aplicación móvil
- **Expo** - Framework de desarrollo
- **React Navigation** - Navegación
- **AsyncStorage** - Almacenamiento local

### Infraestructura
- **AWS EC2** - Servidor de aplicaciones
- **AWS RDS** - Base de datos PostgreSQL
- **AWS ALB** - Load Balancer
- **Docker** - Containerización (opcional)

## 🚀 Instalación y Despliegue

### Prerrequisitos
- Node.js 18+
- PostgreSQL 13+
- Redis 6+
- PM2 (para producción)

### Instalación Local

1. **Clonar repositorio**
```bash
git clone https://github.com/tu-usuario/eu-chat.git
cd eu-chat
```

2. **Instalar dependencias**
```bash
cd backend
npm install
```

3. **Configurar variables de entorno**
```bash
cp env.example .env
# Editar .env con tus credenciales
```

4. **Configurar base de datos**
```bash
npm run migrate
npm run seed
```

5. **Iniciar servidor**
```bash
npm run dev
```

### Despliegue en EC2

1. **Configurar EC2**
```bash
chmod +x deploy/deploy-ec2.sh
./deploy/deploy-ec2.sh
```

2. **Configurar variables de entorno en EC2**
```bash
# Editar /eu-chat/backend/.env
# Configurar contraseña de RDS y tokens de API
```

3. **Iniciar con PM2**
```bash
cd /eu-chat
pm2 start ecosystem.config.js --env production
```

## 📱 Configuración de APIs

### WhatsApp Business API
```bash
WHATSAPP_ACCESS_TOKEN=tu_token_aqui
WHATSAPP_VERIFY_TOKEN=tu_verify_token
WHATSAPP_PHONE_NUMBER_ID=tu_phone_number_id
```

### Telegram Bot API
```bash
TELEGRAM_BOT_TOKEN=tu_bot_token_aqui
TELEGRAM_WEBHOOK_URL=https://tu-dominio.com/api/telegram/webhook
```

## 🔧 Scripts Disponibles

```bash
# Desarrollo
npm run dev          # Iniciar servidor de desarrollo
npm run start        # Iniciar servidor de producción

# Base de datos
npm run migrate      # Ejecutar migraciones
npm run seed         # Ejecutar seeds

# Despliegue
./deploy/deploy-ec2.sh    # Desplegar en EC2
./deploy/connect.sh       # Conectar a EC2
```

## 📊 Estructura de la Base de Datos

### Tablas Principales
- **users** - Usuarios del sistema
- **platforms** - Plataformas de mensajería
- **contacts** - Contactos de los usuarios
- **conversations** - Conversaciones de chat
- **messages** - Mensajes individuales

### Relaciones
```
users (1) ──► (N) contacts
users (1) ──► (N) conversations
platforms (1) ──► (N) contacts
platforms (1) ──► (N) conversations
conversations (1) ──► (N) messages
```

## 🔐 Seguridad

- **JWT** con expiración configurable
- **bcryptjs** para hash de contraseñas
- **Rate limiting** para prevenir abuso
- **CORS** configurado para producción
- **Helmet** para headers de seguridad
- **Validación** de entrada con Joi

## 📈 Monitoreo y Logs

- **PM2** para gestión de procesos
- **Winston** para logging estructurado
- **Health checks** automáticos
- **Métricas** de rendimiento

## 🌐 Endpoints de la API

### Autenticación
- `POST /api/auth/register` - Registro de usuario
- `POST /api/auth/login` - Login de usuario
- `POST /api/auth/refresh` - Refresh de token
- `POST /api/auth/logout` - Logout de usuario

### Usuarios
- `GET /api/users/profile` - Perfil del usuario
- `PUT /api/users/profile` - Actualizar perfil
- `PUT /api/users/change-password` - Cambiar contraseña
- `GET /api/users/stats` - Estadísticas del usuario

### Contactos
- `GET /api/contacts` - Lista de contactos
- `POST /api/contacts` - Crear contacto
- `PUT /api/contacts/:id` - Actualizar contacto
- `DELETE /api/contacts/:id` - Eliminar contacto

### Conversaciones
- `GET /api/conversations` - Lista de conversaciones
- `POST /api/conversations` - Crear conversación
- `PUT /api/conversations/:id` - Actualizar conversación
- `DELETE /api/conversations/:id` - Eliminar conversación

### Mensajes
- `GET /api/messages/conversation/:id` - Mensajes de conversación
- `POST /api/messages` - Enviar mensaje
- `PUT /api/messages/:id/read` - Marcar como leído

### Plataformas
- `GET /api/platforms` - Lista de plataformas
- `GET /api/platforms/:id` - Detalle de plataforma
- `POST /api/platforms` - Crear plataforma
- `PUT /api/platforms/:id` - Actualizar plataforma

### WhatsApp
- `GET /api/whatsapp/webhook` - Verificación de webhook
- `POST /api/whatsapp/webhook` - Webhook de WhatsApp
- `POST /api/whatsapp/send` - Enviar mensaje
- `GET /api/whatsapp/templates` - Plantillas disponibles

## 🧪 Testing

```bash
# Ejecutar tests
npm test

# Tests con coverage
npm run test:coverage

# Tests de integración
npm run test:integration
```

## 📝 Contribución

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT - ver el archivo [LICENSE](LICENSE) para detalles.

## 🤝 Soporte

- **Documentación**: [Wiki del proyecto](https://github.com/tu-usuario/eu-chat/wiki)
- **Issues**: [GitHub Issues](https://github.com/tu-usuario/eu-chat/issues)
- **Discusiones**: [GitHub Discussions](https://github.com/tu-usuario/eu-chat/discussions)

## 🙏 Agradecimientos

- **Unión Europea** por el DMA 2024
- **Meta** por la API de WhatsApp Business
- **Telegram** por la API de bots
- **Comunidad open source** por las librerías utilizadas

---

**Desarrollado con ❤️ para la interoperabilidad de mensajería en Europa**
