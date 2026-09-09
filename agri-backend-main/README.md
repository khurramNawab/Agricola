# AgriCola Backend API

Express.js backend server for the AgriCola agricultural e-commerce platform with MongoDB integration.

## Features

- 🔐 JWT Authentication with refresh tokens
- 👤 User management with role-based access control
- 🛡️ Security middleware (Helmet, CORS, Rate limiting)
- 📝 Input validation with express-validator
- 📊 Admin dashboard with analytics
- 🏪 Product and category management
- 🛒 Shopping cart and order management
- 💳 Payment integration (Razorpay)
- 📱 Indian market optimized (phone, PIN codes, currency)
- 🔄 Error handling and logging
- 📄 API documentation compliance

## Tech Stack

- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT with bcryptjs
- **Validation**: express-validator
- **Security**: Helmet, CORS, Rate limiting
- **File Upload**: Multer with Cloudinary integration
- **Payment**: Razorpay integration
- **Email**: Nodemailer
- **Testing**: Jest with Supertest

## Quick Start

### Prerequisites

- Node.js (v16 or higher)
- MongoDB (local or MongoDB Atlas)
- Cloudinary account (for image uploads)
- Razorpay account (for payments)

### Installation

1. **Clone and setup**
   ```bash
   cd agri-backend
   npm install
   ```

2. **Environment Configuration**
   ```bash
   cp .env.example .env
   ```
   
   Update `.env` with your configurations:
   ```env
   # Database
   MONGODB_URI=mongodb://localhost:27017/agricola
   
   # JWT Secrets (change these!)
   JWT_SECRET=your-super-secret-jwt-key
   JWT_REFRESH_SECRET=your-super-secret-refresh-key
   
   # Cloudinary
   CLOUDINARY_CLOUD_NAME=your-cloudinary-name
   CLOUDINARY_API_KEY=your-cloudinary-api-key
   CLOUDINARY_API_SECRET=your-cloudinary-api-secret
   
   # Razorpay
   RAZORPAY_KEY_ID=your-razorpay-key-id
   RAZORPAY_KEY_SECRET=your-razorpay-key-secret
   
   # Email
   EMAIL_HOST=smtp.gmail.com
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASS=your-app-password
   ```

3. **Start MongoDB**
   ```bash
   # Local MongoDB
   mongod
   
   # Or use MongoDB Atlas URI in .env
   ```

4. **Run the server**
   ```bash
   # Development
   npm run dev
   
   # Production
   npm start
   ```

The server will start on `http://localhost:5000`

## API Endpoints

### Authentication
```http
POST   /api/v1/auth/register     # Register user
POST   /api/v1/auth/login        # Login user  
POST   /api/v1/auth/refresh      # Refresh token
POST   /api/v1/auth/logout       # Logout user
GET    /api/v1/auth/me           # Get current user
```

### Admin Dashboard
```http
GET    /api/v1/admin/dashboard/stats    # Dashboard statistics
GET    /api/v1/admin/users              # List users (paginated)
GET    /api/v1/admin/users/:id          # Get user details
PUT    /api/v1/admin/users/:id          # Update user
POST   /api/v1/admin/users/:id/ban      # Ban user
POST   /api/v1/admin/users/:id/unban    # Unban user
DELETE /api/v1/admin/users/:id          # Delete user
```

### Health Check
```http
GET    /health                          # Server health status
```

## Database Schema

### User Model
```javascript
{
  userId: "U001",              // Auto-generated
  name: "Priya Sharma",
  email: "priya@example.com",
  phone: "+919876543210",
  role: "customer|admin",
  status: "active|banned|inactive",
  addresses: [...],
  orders: 25,                  // Order count
  totalSpent: 15000,          // Total spent amount
  // ... other fields
}
```

### Product Model
```javascript
{
  productId: "P001",          // Auto-generated
  name: "Premium Green Tea",
  description: "...",
  price: 299.99,
  category: ObjectId,
  images: [...],
  stock: 100,
  featured: true,
  rating: { average: 4.5, count: 45 },
  // ... other fields
}
```

### Order Model
```javascript
{
  orderId: "ORD000001",       // Auto-generated
  user: ObjectId,
  items: [...],
  shippingAddress: {...},
  pricing: {
    subtotal: 599.98,
    shipping: 50,
    tax: 117,
    total: 766.98
  },
  status: "pending|confirmed|shipped|delivered",
  paymentStatus: "pending|paid|failed",
  // ... other fields
}
```

## Authentication Flow

1. **Register/Login** → Receive access token + refresh token
2. **API Requests** → Include `Authorization: Bearer <access_token>`
3. **Token Expires** → Use refresh token to get new access token
4. **Admin Routes** → Require admin role verification

## Error Handling

All API responses follow a consistent format:

**Success Response:**
```json
{
  "success": true,
  "message": "Operation successful",
  "data": {...},
  "timestamp": "2025-10-19T10:30:00Z"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": {...}
  },
  "timestamp": "2025-10-19T10:30:00Z"
}
```

## Security Features

- 🔒 JWT tokens with short expiry + refresh mechanism
- 🛡️ Password hashing with bcryptjs (12 rounds)
- 🚦 Rate limiting (100 requests/15min per IP)
- 🔒 Helmet.js for security headers
- ✅ Input validation and sanitization
- 🚫 CORS protection
- 🔐 Role-based access control

## Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Development

### Project Structure
```
src/
├── config/          # Database and app configuration
├── middleware/      # Auth, error handling, validation
├── models/          # Mongoose schemas
├── routes/          # API route handlers
├── utils/           # Helper functions
└── server.js        # Main application entry
```

### Adding New Routes

1. Create route file in `src/routes/`
2. Define endpoints with validation
3. Add authentication/authorization if needed
4. Import and register in `server.js`

### Database Operations

- Use Mongoose ODM for database operations
- Implement proper indexing for performance
- Use aggregation pipelines for complex queries
- Add validation at schema level

## Deployment

### Environment Variables
Ensure all required environment variables are set in production:
- Strong JWT secrets
- Production MongoDB URI
- Valid API keys for services
- Proper CORS origins

### Production Considerations
- Enable MongoDB replica sets
- Implement proper logging
- Set up monitoring and alerts
- Configure reverse proxy (Nginx)
- Use PM2 for process management

## API Documentation

Full API documentation is available in `API_SPECIFICATION.md` in the project root.

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/new-feature`)
3. Commit changes (`git commit -am 'Add new feature'`)
4. Push to branch (`git push origin feature/new-feature`)
5. Create Pull Request

## License

This project is licensed under the MIT License.