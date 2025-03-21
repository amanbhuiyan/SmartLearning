# EduQuest - Educational Platform Technical Documentation

## 1. Application Overview
EduQuest is an advanced educational platform designed to provide personalized learning experiences for children through intelligent question generation and adaptive learning paths.

## 2. Core Features

### 2.1 User Authentication & Management
- Secure user registration and login system
- Password encryption using scrypt
- Session management with PostgreSQL session store
- User profile management with first name, last name, and email

### 2.2 Student Profile Management
- Child name registration
- Multiple subject selection
- Grade level specification
- Subject-specific progress tracking
- Last question date tracking per subject

### 2.3 Question Generation System
- Dynamic question generation for multiple subjects:
  - Math: Addition, subtraction, multiplication based on grade level
  - English: Grammar, vocabulary, and comprehension questions
- Difficulty adjustment based on grade level
- Automatic explanation generation for each question
- Support for 20 questions per subject daily

### 2.4 Email Notification System
- Automated daily question delivery
- Personalized emails with child's name
- Professional HTML email templates
- Subject-wise question organization
- Built-in explanation system
- Scheduled delivery system (every 5 minutes)

### 2.5 Subscription Management
- Stripe integration for payment processing
- Trial period management
- Subscription status tracking
- Customer ID management

## 3. Technical Architecture

### 3.1 Frontend Stack
- React 18 with TypeScript
- TanStack Query for state management
- Tailwind CSS for styling
- shadcn/ui component library
- Wouter for routing
- React Hook Form for form management
- Zod for form validation

### 3.2 Backend Stack
- Node.js with Express
- TypeScript for type safety
- PostgreSQL database
- Drizzle ORM for database operations
- Express session with PostgreSQL store
- Resend API for email delivery

### 3.3 Database Schema
```sql
Tables:
1. users
   - user_id (PK)
   - email (unique)
   - password
   - first_name
   - last_name
   - stripe_customer_id
   - stripe_subscription_id
   - is_subscribed
   - trial_ends_at

2. student_subjects
   - student_subject_id (PK)
   - user_id (FK)
   - subject
   - grade
   - child_name
   - last_question_date
```

### 3.4 API Endpoints
- Authentication:
  - POST /api/register
  - POST /api/login
  - POST /api/logout
  - GET /api/user

- Subject Management:
  - POST /api/subjects
  - GET /api/subjects
  - PUT /api/subjects/:id

- Subscription:
  - POST /api/create-subscription
  - POST /api/cancel-subscription

### 3.5 External Service Integrations
1. Resend API
   - Email delivery service
   - HTML template support
   - Delivery tracking

2. Stripe
   - Payment processing
   - Subscription management
   - Customer management

## 4. Security Features
- Password hashing with salt
- Session-based authentication
- CSRF protection
- Rate limiting
- Secure headers
- Input validation with Zod
- PostgreSQL injection prevention with Drizzle ORM

## 5. Development Tools
- Vite for development server
- TypeScript for type checking
- ESLint for code quality
- Prettier for code formatting
- Drizzle for database migrations

## 6. Deployment
- Hosted on Replit
- PostgreSQL database
- Environment variables for configuration
- Automatic deployment through Replit
- Zero-downtime updates

## 7. Performance Optimizations
- React Query caching
- Database indexing
- Efficient question generation
- Optimized email delivery
- Lazy loading of components

## 8. Monitoring and Logging
- Server-side logging
- API request logging
- Email delivery tracking
- Error tracking and reporting
- Performance monitoring

This documentation provides a comprehensive overview of the EduQuest platform's features and technical implementation. It can be used as a reference for rebuilding the application with different technologies while maintaining the same functionality.
