// PM2 process definition for the vu-backend service.
// The app reads its config from .env via dotenv (src/config/env.ts), so PM2
// only needs to know how to start it. Reload = zero-downtime restart.
module.exports = {
  apps: [
    {
      name: "backend",
      script: "dist/server.js",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "400M",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
