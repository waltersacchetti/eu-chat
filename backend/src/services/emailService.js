const sgMail = require('@sendgrid/mail');
const sendgridConfig = require('../../config/sendgrid');

// Configurar SendGrid con la API key desde la configuración
sgMail.setApiKey(sendgridConfig.apiKey);

class EmailService {
  constructor() {
    this.fromEmail = sendgridConfig.fromEmail;
    this.fromName = sendgridConfig.fromName;
  }

  /**
   * Enviar email de verificación
   */
  async sendVerificationEmail(userEmail, username, verificationToken) {
    const verificationUrl = `http://54.247.227.217:3001/api/auth/verify?token=${verificationToken}`;
    
    const msg = {
      to: userEmail,
      from: {
        email: this.fromEmail,
        name: this.fromName
      },
      subject: 'Verifica tu cuenta - EU Chat Bridge',
      html: this.getVerificationEmailHTML(username, verificationUrl)
    };

    try {
      await sgMail.send(msg);
      console.log(`Email de verificación enviado a ${userEmail}`);
      return true;
    } catch (error) {
      console.error('Error enviando email de verificación:', error);
      // En lugar de fallar, solo loguear el error para debugging
      console.error('Detalles del error:', error.response?.body || error.message);
      return false;
    }
  }

  /**
   * Enviar email de bienvenida
   */
  async sendWelcomeEmail(userEmail, username, firstName) {
    const msg = {
      to: userEmail,
      from: {
        email: this.fromEmail,
        name: this.fromName
      },
      subject: '¡Bienvenido a EU Chat Bridge!',
      html: this.getWelcomeEmailHTML(username, firstName)
    };

    try {
      await sgMail.send(msg);
      console.log(`Email de bienvenida enviado a ${userEmail}`);
      return true;
    } catch (error) {
      console.error('Error enviando email de bienvenida:', error);
      // En lugar de fallar, solo loguear el error para debugging
      console.error('Detalles del error:', error.response?.body || error.message);
      return false;
    }
  }

  /**
   * Enviar email de recuperación de contraseña
   */
  async sendPasswordResetEmail(userEmail, username, resetToken) {
    const resetUrl = `http://54.247.227.217:3001/api/auth/reset-password?token=${resetToken}`;
    
    const msg = {
      to: userEmail,
      from: {
        email: this.fromEmail,
        name: this.fromName
      },
      subject: 'Recupera tu contraseña - EU Chat Bridge',
      html: this.getPasswordResetEmailHTML(username, resetUrl)
    };

    try {
      await sgMail.send(msg);
      console.log(`Email de recuperación enviado a ${userEmail}`);
      return true;
    } catch (error) {
      console.error('Error enviando email de recuperación:', error);
      // En lugar de fallar, solo loguear el error para debugging
      console.error('Detalles del error:', error.response?.body || error.message);
      return false;
    }
  }

  /**
   * HTML para email de verificación
   */
  getVerificationEmailHTML(username, verificationUrl) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verifica tu cuenta - EU Chat Bridge</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #3498db; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #27ae60; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #7f8c8d; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>EU Chat Bridge</h1>
            <p>Verifica tu cuenta</p>
          </div>
          <div class="content">
            <h2>¡Hola ${username}!</h2>
            <p>Gracias por registrarte en EU Chat Bridge. Para completar tu registro, necesitamos verificar tu dirección de email.</p>
            <p>Haz clic en el botón de abajo para verificar tu cuenta:</p>
            <a href="${verificationUrl}" class="button">Verificar Cuenta</a>
            <p>Si el botón no funciona, copia y pega este enlace en tu navegador:</p>
            <p><a href="${verificationUrl}">${verificationUrl}</a></p>
            <p>Este enlace expirará en 24 horas por seguridad.</p>
            <p>Si no solicitaste esta cuenta, puedes ignorar este email.</p>
          </div>
          <div class="footer">
            <p>© 2024 EU Chat Bridge. Todos los derechos reservados.</p>
            <p>Si tienes preguntas, contacta a <a href="mailto:support@euchatbridge.com">support@euchatbridge.com</a></p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * HTML para email de bienvenida
   */
  getWelcomeEmailHTML(username, firstName) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>¡Bienvenido a EU Chat Bridge!</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #27ae60; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
          .footer { text-align: center; margin-top: 30px; color: #7f8c8d; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>EU Chat Bridge</h1>
            <p>¡Cuenta verificada exitosamente!</p>
          </div>
          <div class="content">
            <h2>¡Bienvenido ${firstName}!</h2>
            <p>Tu cuenta ha sido verificada exitosamente. Ya puedes acceder a EU Chat Bridge y conectar todas tus plataformas de mensajería.</p>
            <h3>¿Qué puedes hacer ahora?</h3>
            <ul>
              <li>Conectar tu cuenta de WhatsApp</li>
              <li>Integrar Telegram</li>
              <li>Gestionar tus contactos</li>
              <li>Iniciar conversaciones</li>
            </ul>
            <p>¡Disfruta de una experiencia unificada de mensajería!</p>
          </div>
          <div class="footer">
            <p>© 2024 EU Chat Bridge. Todos los derechos reservados.</p>
            <p>Si tienes preguntas, contacta a <a href="mailto:support@euchatbridge.com">support@euchatbridge.com</a></p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * HTML para email de recuperación de contraseña
   */
  getPasswordResetEmailHTML(username, resetUrl) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Recupera tu contraseña - EU Chat Bridge</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #e74c3c; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #e74c3c; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #7f8c8d; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>EU Chat Bridge</h1>
            <p>Recupera tu contraseña</p>
          </div>
          <div class="content">
            <h2>¡Hola ${username}!</h2>
            <p>Has solicitado recuperar tu contraseña en EU Chat Bridge.</p>
            <p>Haz clic en el botón de abajo para crear una nueva contraseña:</p>
            <a href="${resetUrl}" class="button">Cambiar Contraseña</a>
            <p>Si el botón no funciona, copia y pega este enlace en tu navegador:</p>
            <p><a href="${resetUrl}">${resetUrl}</a></p>
            <p>Este enlace expirará en 1 hora por seguridad.</p>
            <p>Si no solicitaste este cambio, puedes ignorar este email.</p>
          </div>
          <div class="footer">
            <p>© 2024 EU Chat Bridge. Todos los derechos reservados.</p>
            <p>Si tienes preguntas, contacta a <a href="mailto:support@euchatbridge.com">support@euchatbridge.com</a></p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}

module.exports = new EmailService();
