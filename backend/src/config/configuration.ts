export default () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  database: {
    url: process.env.DATABASE_URL,
    directUrl: process.env.DIRECT_URL,
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  sepay: {
    secretKey: process.env.SEPAY_SECRET_KEY,
    apiBase: process.env.SEPAY_API_BASE,
  },
  fastapi: {
    url: process.env.FASTAPI_URL || 'http://localhost:8000',
  },
  platform: {
    settingsId: process.env.PLATFORM_SETTINGS_ID,
    feePct: parseFloat(process.env.PLATFORM_FEE_PCT || '0.05'),
  },
});
