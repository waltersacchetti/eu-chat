// Configuración de SendGrid
module.exports = {
  apiKey: process.env.SENDGRID_API_KEY || '',
  fromEmail: 'noreply@euchatbridge.com',
  fromName: 'EU Chat Bridge'
};
