require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { clerkMiddleware } = require('@clerk/express');

const db = require('./config/database');

const app = express();
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../uploads');

// Middleware: Security headers
// CSP configurata per permettere Clerk auth + Google OAuth
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://*.clerk.accounts.dev", "https://challenges.cloudflare.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "blob:", "https://*.clerk.accounts.dev", "https://img.clerk.com", "https://*.googleusercontent.com"],
        connectSrc: ["'self'", "https://*.clerk.accounts.dev", "https://api.clerk.com", "https://accounts.google.com"],
        frameSrc: ["'self'", "https://*.clerk.accounts.dev", "https://accounts.google.com", "https://challenges.cloudflare.com"],
        workerSrc: ["'self'", "blob:"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
  })
);

// Middleware: CORS
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || (NODE_ENV === 'production' ? false : 'http://localhost:3000'),
    credentials: true,
  })
);

// Middleware: Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Middleware: Static files for uploads
app.use('/uploads', express.static(UPLOAD_DIR));

// Middleware: Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
});
app.use('/api/', limiter);

// Middleware: Clerk authentication
app.use(clerkMiddleware());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', environment: NODE_ENV });
});

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/servizi', require('./routes/servizi'));
app.use('/api/messaggi', require('./routes/messaggi'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api', require('./routes/public'));

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';
  res.status(status).json({ error: message });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`FestaDeiPiccoli server running on port ${PORT} in ${NODE_ENV} mode`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    db.closePool().then(() => {
      console.log('Database pool closed');
      process.exit(0);
    });
  });
});

module.exports = app;
