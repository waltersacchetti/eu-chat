module.exports = {
  apps: [{
    name: 'eu-chat',
    script: 'dist/index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    kill_timeout: 5000,
    wait_ready: true,
    listen_timeout: 8000
  }],

  deploy: {
    production: {
      user: 'ec2-user',
      host: '54.247.227.217',
      key: 'deploy/spainbingo-key.pem',
      ref: 'origin/main',
      repo: 'git@github.com:tu-usuario/eu-chat-bridge.git',
      path: '/home/ec2-user/eu-chat',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    }
  }
};
