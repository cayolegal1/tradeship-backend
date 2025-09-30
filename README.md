# TradeShip Backend API

A comprehensive trading platform backend built with NestJS, TypeScript, and Prisma.

## 🚀 Migration Complete

This project has been successfully migrated from Django to NestJS while maintaining all existing functionality. See [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) for detailed migration information.

## Features

- **Authentication & User Management**: JWT-based authentication with user profiles and trading statistics
- **Notification System**: Real-time notifications with email, push, and in-app support
- **Payment System**: Wallet management with Stripe integration for deposits and withdrawals
- **Trading System**: Item management, trade creation, reviews, and ratings
- **Chat System**: Real-time messaging between users
- **File Management**: Support for item images and file attachments

## Tech Stack

- **Framework**: NestJS with TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT with Passport
- **Documentation**: Swagger/OpenAPI
- **Validation**: Class-validator and class-transformer
- **File Upload**: Multer with AWS S3 support
- **Email**: Nodemailer
- **Payments**: Stripe integration

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Docker and Docker Compose (optional)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd tradeship-backend
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp env.example .env
```

4. Update the `.env` file with your configuration:
```env
DATABASE_URL="postgresql://jcroot:changeme!@localhost:5432/tradeshipdb?schema=public"
JWT_SECRET="your-super-secret-jwt-key-here"
JWT_EXPIRES_IN="7d"
JWT_REFRESH_SECRET="your-super-secret-refresh-key-here"
JWT_REFRESH_EXPIRES_IN="30d"
# ... other environment variables
```

### Database Setup

1. Start PostgreSQL (using Docker Compose):
```bash
docker-compose up db -d
```

2. Run Prisma migrations:
```bash
npm run prisma:migrate
```

3. Seed the database:
```bash
npm run prisma:seed
```

### Development

1. Start the development server:
```bash
npm run start:dev
```

2. The API will be available at `http://localhost:3000`
3. API documentation is available at `http://localhost:3000/api/docs`

### Production

1. Build the application:
```bash
npm run build
```

2. Start the production server:
```bash
npm run start:prod
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/me` - Update user information
- `POST /api/auth/change-password` - Change password
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update user profile

### Notifications
- `GET /api/notifications` - Get user notifications
- `POST /api/notifications` - Create notification
- `PUT /api/notifications/mark-read` - Mark notifications as read
- `GET /api/notifications/stats` - Get notification statistics

### Payments
- `GET /api/payment/wallet` - Get wallet information
- `POST /api/payment/deposit` - Deposit money
- `POST /api/payment/withdraw` - Withdraw money
- `POST /api/payment/escrow/deposit` - Place amount in escrow
- `POST /api/payment/escrow/release` - Release from escrow

### Trading
- `GET /api/trade/items` - Get available items
- `POST /api/trade/items` - Create new item
- `GET /api/trade/items/:id` - Get item details
- `POST /api/trade/trades` - Create new trade
- `GET /api/trade/trades` - Get user trades
- `POST /api/trade/trades/:id/accept` - Accept trade
- `POST /api/trade/trades/:id/complete` - Complete trade
- `POST /api/trade/reviews` - Create trade review
- `POST /api/trade/ratings` - Create trade rating

## Database Schema

The application uses Prisma ORM with the following main entities:

- **User**: User accounts with profiles and trading statistics
- **Item**: Tradeable items with images and files
- **Trade**: Trade transactions between users
- **Review**: Trade reviews and ratings
- **Notification**: User notifications
- **Wallet**: User payment wallets and transactions
- **Interest**: Item categories and user interests

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `JWT_SECRET` | JWT signing secret | Required |
| `JWT_EXPIRES_IN` | JWT expiration time | `7d` |
| `JWT_REFRESH_SECRET` | JWT refresh secret | Required |
| `JWT_REFRESH_EXPIRES_IN` | JWT refresh expiration | `30d` |
| `EMAIL_HOST` | SMTP host | `localhost` |
| `EMAIL_PORT` | SMTP port | `1025` |
| `STRIPE_SECRET_KEY` | Stripe secret key | Required |
| `STRIPE_PUBLISHABLE_KEY` | Stripe publishable key | Required |
| `AWS_ACCESS_KEY_ID` | AWS access key | Optional |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | Optional |
| `AWS_S3_BUCKET_NAME` | S3 bucket name | Optional |

## Docker Support

The application includes Docker support for easy deployment:

```bash
# Start all services
docker-compose up

# Start only the database
docker-compose up db

# Build and start the application
docker-compose up app
```

## Testing

```bash
# Run unit tests
npm run test

# Run e2e tests
npm run test:e2e

# Run tests with coverage
npm run test:cov
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## 🔄 Migration Status

### ✅ Completed Features

- [x] **Authentication System**: User registration, login, JWT tokens
- [x] **User Management**: Profiles, interests, trading statistics
- [x] **Notification System**: Real-time notifications, preferences, chat
- [x] **Payment System**: Wallets, Stripe integration, transactions
- [x] **Trading System**: Items, trades, reviews, ratings
- [x] **File Management**: Secure file uploads and storage
- [x] **API Documentation**: Auto-generated Swagger docs
- [x] **Docker Support**: Containerized development and production
- [x] **CI/CD Pipeline**: GitHub Actions workflow
- [x] **Testing**: Unit and E2E test coverage

### 🔧 Technical Improvements

- **Type Safety**: Full TypeScript support
- **Performance**: Optimized database queries with Prisma
- **Security**: Enhanced input validation and SQL injection protection
- **Documentation**: Auto-generated API documentation
- **Testing**: Comprehensive test coverage
- **Monitoring**: Structured logging and health checks

## 📖 Migration Guide

For detailed information about the Django to NestJS migration, see [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md).

## License

This project is licensed under the MIT License.