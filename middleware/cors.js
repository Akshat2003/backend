// Enhanced CORS middleware for production deployment
const cors = require('cors');

const createCorsMiddleware = () => {
  const corsOptions = {
    origin: function (origin, callback) {
      // Define allowed origins
      const allowedOrigins = [
        // Development URLs
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:5173',
        'http://localhost:5174',
        
        // Production URLs
        'https://frontend-ruddy-zeta-89.vercel.app',
        'https://parking-operator.vercel.app',
        
        // Environment-based URL
        process.env.FRONTEND_URL,
        
        // Additional domains from environment
        ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : [])
      ].filter(Boolean);

      // Log CORS requests in production for debugging
      if (process.env.NODE_ENV === 'production') {
        console.log(`[CORS] Request from origin: ${origin || 'null'}`);
        console.log(`[CORS] Allowed origins:`, allowedOrigins);
      }

      // Allow requests with no origin (mobile apps, Postman, curl, etc.)
      if (!origin) {
        return callback(null, true);
      }

      // Check if origin is allowed
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.error(`[CORS] Origin ${origin} not allowed. Allowed origins:`, allowedOrigins);
        callback(new Error(`CORS: Origin ${origin} not allowed`), false);
      }
    },
    
    credentials: true,
    
    methods: [
      'GET', 
      'POST', 
      'PUT', 
      'DELETE', 
      'PATCH', 
      'OPTIONS', 
      'HEAD'
    ],
    
    allowedHeaders: [
      'Content-Type',
      'Authorization', 
      'X-Requested-With',
      'Accept',
      'Origin',
      'Cache-Control',
      'X-File-Name',
      'X-Access-Token',
      'X-API-Key'
    ],
    
    exposedHeaders: [
      'X-Total-Count',
      'X-Page-Count', 
      'X-Current-Page',
      'X-Rate-Limit',
      'X-Rate-Limit-Remaining'
    ],
    
    maxAge: 86400, // 24 hours
    optionsSuccessStatus: 200,
    preflightContinue: false
  };

  return cors(corsOptions);
};

// Error handler for CORS issues
const handleCorsError = (err, req, res, next) => {
  if (err && err.message && err.message.includes('CORS')) {
    console.error('[CORS Error]', {
      origin: req.get('origin'),
      method: req.method,
      url: req.url,
      headers: req.headers,
      error: err.message
    });
    
    return res.status(403).json({
      success: false,
      error: 'CORS Error',
      message: 'Cross-Origin Request Blocked',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
  next(err);
};

module.exports = {
  createCorsMiddleware,
  handleCorsError
};