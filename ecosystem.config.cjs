module.exports = {
  apps: [
    {
      name: "rifapro-saas",
      script: "dist/server.js",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "512M",
      env_production: {
        NODE_ENV: "production",
        ENABLE_PUBLIC_DEBUG: "false"
      }
    }
  ]
};
