module.exports = {
  apps: [{
    name: 'eu-chat-backend',
    script: './dist/index.js',
    cwd: '/home/ec2-user/eu-chat/backend',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3001,
      DB_HOST: 'spainbingo-db.clzgxn85wdjh.eu-west-1.rds.amazonaws.com',
      DB_PORT: 5432,
      DB_NAME: 'spainbingo',
      DB_USERNAME: 'spainbingo_admin',
      DB_PASSWORD: 'SpainBingo2024!'
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
