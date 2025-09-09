const corsOptions = {
  origin: function (origin, callback) {
    // Define allowed origins
    const allowedOrigins = [
      process.env.FRONTEND_URL || 'http://localhost:5173',
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5173', // Vite dev server
      'http://localhost:5174', // Additional Vite dev server port
      'https://frontend-ruddy-zeta-89.vercel.app', // Deployed frontend URL
      'https://parking-operator.vercel.app', // Add your production domain
    ];

    // In production, be more permissive for CORS debugging
    if (process.env.NODE_ENV === 'production') {
      // Log the origin for debugging
      console.log('CORS Origin:', origin);
      console.log('Allowed Origins:', allowedOrigins);
    }

    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      // In production, log the rejected origin for debugging
      if (process.env.NODE_ENV === 'production') {
        console.log('CORS Origin Rejected:', origin);
      }
      callback(new Error(`Not allowed by CORS: ${origin}`), false);
    }
  },
  credentials: true, // Allow cookies and authorization headers
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Cache-Control',
    'X-File-Name'
  ],
  exposedHeaders: [
    'X-Total-Count',
    'X-Page-Count',
    'X-Current-Page'
  ],
  maxAge: 86400, // 24 hours
  optionsSuccessStatus: 200, // For legacy browser support
  preflightContinue: false, // Pass control to next handler after preflight
};

module.exports = corsOptions;