# Sparkee Operator Backend

A comprehensive backend API for the Sparkee Parking Operator System, built with Node.js, Express, and MongoDB.

## 🚀 Features

- **Authentication & Authorization**
  - JWT-based authentication with refresh tokens
  - Role-based access control (Admin, Supervisor, Operator)
  - Password reset with OTP verification
  - Account lockout protection

- **Core Functionality**
  - User management with operator ID system
  - Customer management with vehicle tracking
  - Booking management with OTP-based vehicle retrieval
  - Machine and pallet management
  - Real-time booking status updates

- **Security**
  - Rate limiting on authentication endpoints
  - Input validation and sanitization
  - Bcrypt password hashing
  - CORS protection
  - Helmet security headers

- **Communication**
  - Email service for notifications
  - OTP service for secure operations
  - SMS integration ready

- **Data Models**
  - User (Operators with roles and permissions)
  - Customer (with vehicle and membership info)
  - Booking (with payment and OTP tracking)
  - Machine (with pallet management)

## 📋 Prerequisites

- Node.js (v16 or higher)
- MongoDB (v4.4 or higher)
- npm or yarn

## 🛠️ Installation

1. **Clone and navigate to backend**
   ```bash
   cd backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment setup**
   ```bash
   cp .env.example .env
   ```

4. **Configure environment variables**
   Edit `.env` file with your configuration:
   ```env
   # Essential configurations
   NODE_ENV=development
   PORT=5000
   
   # Database
   MONGODB_URI=mongodb://localhost:27017/sparkee-operator
   
   # JWT Secrets (CHANGE THESE!)
   JWT_SECRET=your-super-secret-jwt-key
   JWT_REFRESH_SECRET=your-super-secret-refresh-key
   
   # Admin User (created automatically)
   ADMIN_OPERATOR_ID=OP001
   ADMIN_EMAIL=admin@parking-operator.com
   ADMIN_PASSWORD=ChangeThisPassword123!
   ```

5. **Start MongoDB**
   ```bash
   # If using Docker
   docker run -d -p 27017:27017 --name mongodb mongo:latest
   
   # Or start local MongoDB service
   sudo systemctl start mongodb
   ```

6. **Run the server**
   ```bash
   # Development mode with nodemon
   npm run dev
   
   # Production mode
   npm start
   ```

## 📚 API Documentation

### Authentication Endpoints

#### POST `/api/auth/register`
Register a new user (Admin only in production)

**Request Body:**
```json
{
  "operatorId": "OP002",
  "email": "operator@example.com",
  "password": "SecurePass123!",
  "confirmPassword": "SecurePass123!",
  "firstName": "John",
  "lastName": "Doe",
  "phoneNumber": "9876543210",
  "role": "operator",
  "shift": "morning"
}
```

#### POST `/api/auth/login`
Login with operator ID and password

**Request Body:**
```json
{
  "operatorId": "OP001",
  "password": "your-password"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "_id": "user-id",
      "operatorId": "OP001",
      "email": "user@example.com",
      "fullName": "John Doe",
      "role": "operator"
    },
    "accessToken": "jwt-access-token"
  }
}
```

#### POST `/api/auth/refresh`
Refresh access token using refresh token from cookie

#### POST `/api/auth/logout`
Logout and invalidate refresh token

#### GET `/api/auth/profile`
Get current user profile (requires authentication)

#### POST `/api/auth/forgot-password`
Request password reset

**Request Body:**
```json
{
  "operatorId": "OP001",
  "email": "user@example.com"
}
```

#### POST `/api/auth/reset-password`
Reset password with OTP

**Request Body:**
```json
{
  "resetToken": "reset-token",
  "otp": "123456",
  "newPassword": "NewSecurePass123!",
  "confirmPassword": "NewSecurePass123!"
}
```

### Data Models

#### User Model
```javascript
{
  operatorId: "OP001", // Unique operator ID
  email: "user@example.com",
  firstName: "John",
  lastName: "Doe",
  phoneNumber: "9876543210",
  role: "operator", // admin, supervisor, operator
  status: "active", // active, inactive, suspended
  permissions: ["create_booking", "update_booking"],
  shift: "morning", // morning, afternoon, night
  department: "Operations",
  lastLogin: Date,
  createdAt: Date
}
```

#### Customer Model
```javascript
{
  customerId: "CUST123456", // Auto-generated
  firstName: "Customer",
  lastName: "Name",
  phoneNumber: "9876543210", // Unique
  email: "customer@example.com",
  vehicles: [{
    vehicleNumber: "KA01AB1234",
    vehicleType: "two-wheeler", // two-wheeler, four-wheeler
    vehicleModel: "Honda Activa",
    isActive: true
  }],
  membership: {
    membershipNumber: "MEM001",
    membershipType: "monthly",
    expiryDate: Date,
    isActive: true
  },
  totalBookings: 10,
  totalAmount: 1500,
  status: "active"
}
```

#### Booking Model
```javascript
{
  bookingNumber: "BKTW12345678", // Auto-generated
  customer: ObjectId, // Reference to Customer
  customerName: "Customer Name",
  phoneNumber: "9876543210",
  vehicleNumber: "KA01AB1234",
  vehicleType: "two-wheeler",
  machineNumber: "M001",
  palletNumber: 5,
  status: "active", // active, completed, cancelled
  startTime: Date,
  endTime: Date,
  otp: {
    code: "123456",
    expiresAt: Date,
    isUsed: false
  },
  payment: {
    amount: 25,
    method: "cash", // cash, upi, card, membership
    status: "pending"
  },
  createdBy: ObjectId // Reference to User
}
```

#### Machine Model
```javascript
{
  machineNumber: "M001",
  machineName: "Main Entrance Parking",
  status: "online", // online, offline, maintenance
  capacity: {
    total: 8,
    available: 6,
    occupied: 2
  },
  pallets: [{
    number: 1,
    status: "occupied", // available, occupied, maintenance
    currentBooking: ObjectId,
    vehicleNumber: "KA01AB1234"
  }],
  specifications: {
    supportedVehicleTypes: ["two-wheeler", "four-wheeler"],
    maxVehicleWeight: 2000
  },
  pricing: {
    twoWheeler: {
      baseRate: 10,
      minimumCharge: 10
    },
    fourWheeler: {
      baseRate: 20,
      minimumCharge: 20
    }
  }
}
```

## 🔐 Authentication & Authorization

### JWT Authentication
- Access tokens expire in 7 days (configurable)
- Refresh tokens expire in 30 days (configurable)
- Refresh tokens are stored in HTTP-only cookies

### User Roles & Permissions

#### Admin
- Full system access
- User management
- System configuration
- All booking operations
- Analytics and reports

#### Supervisor
- Booking management
- Customer management
- Basic analytics
- User profile management

#### Operator
- Create and manage bookings
- Customer lookup and creation
- Basic profile management

## ⚡ Rate Limiting

- **General API**: 100 requests per 15 minutes
- **Authentication**: 5 attempts per 15 minutes
- **Password Reset**: 3 attempts per hour
- **Account Creation**: 3 accounts per hour per IP

## 🔒 Security Features

1. **Password Security**
   - Bcrypt hashing with 12 salt rounds
   - Password strength validation
   - Password change tracking

2. **Account Protection**
   - Account lockout after 5 failed attempts
   - 2-hour lockout duration
   - Login attempt tracking

3. **Input Validation**
   - All endpoints have input validation
   - SQL injection prevention
   - XSS protection with sanitization

4. **CORS Configuration**
   - Configurable allowed origins
   - Credential support for frontend

## 📧 Email Configuration

The system supports email notifications for:
- Password reset requests
- Account lockout notifications
- Welcome emails for new users
- Booking confirmations

Configure SMTP settings in `.env`:
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
FROM_EMAIL=noreply@parking-operator.com
```

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests with watch
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## 📊 Logging

The application uses a custom logger with:
- Different log levels (error, warn, info, debug)
- File logging in production
- Console logging in development
- Request/response logging
- Error tracking

## 🚀 Deployment

### Production Checklist

1. **Environment Variables**
   ```bash
   NODE_ENV=production
   JWT_SECRET=strong-secret-key
   JWT_REFRESH_SECRET=another-strong-secret
   MONGODB_URI=mongodb://production-server/database
   ```

2. **Security Settings**
   ```bash
   FORCE_HTTPS=true
   SECURE_COOKIES=true
   ALLOWED_ORIGINS=https://yourdomain.com
   ```

3. **Database**
   - Set up MongoDB replica set
   - Configure database backups
   - Set up monitoring

4. **Process Management**
   ```bash
   # Using PM2
   npm install -g pm2
   pm2 start ecosystem.config.js
   ```

5. **Reverse Proxy**
   - Configure Nginx/Apache
   - Set up SSL certificates
   - Configure load balancing if needed

### Docker Deployment

```bash
# Build image
docker build -t sparkee-backend .

# Run with docker-compose
docker-compose up -d
```

## 📝 Environment Variables Reference

See `.env.example` for complete list of configuration options.

### Essential Variables
- `NODE_ENV`: Environment (development/production)
- `PORT`: Server port (default: 5000)
- `MONGODB_URI`: Database connection string
- `JWT_SECRET`: JWT signing secret
- `JWT_REFRESH_SECRET`: Refresh token signing secret

### Optional Variables
- Email configuration (SMTP_*)
- Rate limiting settings
- File upload settings
- Payment gateway configuration
- Machine integration settings

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new features
5. Run tests and linting
6. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Check the API documentation
- Review the logs for error details
- Ensure all environment variables are configured
- Verify database connectivity
- Check rate limiting if experiencing 429 errors

## 🔄 API Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (authentication required)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (duplicate resource)
- `422` - Unprocessable Entity (validation errors)
- `429` - Too Many Requests (rate limited)
- `500` - Internal Server Error