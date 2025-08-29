module.exports = {
  apps: [{
    name: 'eu-chat-backend-simple',
    script: './backend-simple.js',
    cwd: '/home/ec2-user/eu-chat',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
