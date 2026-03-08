module.exports = {
  apps: [
    {
      name: 'roomlenspro-web',
      script: 'npx',
      args: 'next dev --port 3000',
      cwd: '/home/user/RoomLens/webapp-web',
      env: { NODE_ENV: 'development', PORT: 3000 },
      watch: false,
      instances: 1,
      exec_mode: 'fork',
    },
  ],
};
