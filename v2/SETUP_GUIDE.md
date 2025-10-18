# Email Classification System - Setup Guide

## Overview
An AI-powered email classification system that automatically organizes Gmail emails using OpenAI embeddings and vector similarity matching.

## Features

### Core Features
- **AI-Powered Classification**: Uses OpenAI embeddings for intelligent email categorization
- **Gmail Integration**: Syncs emails directly from Gmail
- **Vector Search**: Leverages Supabase's pgvector for similarity matching
- **User Authentication**: Secure login and registration system
- **Dark Mode**: Full dark mode support with theme toggle

### Advanced Features
- **Advanced Filtering**: Filter by date range, sender, category, and archived status
- **Full-Text Search**: Search across email subject, sender, and body content
- **Bulk Actions**: Select multiple emails for batch operations
- **Email Archiving**: Archive emails to keep inbox organized
- **Interactive Dashboard**: Visual analytics with pie charts and bar graphs
- **Category Management**: Create, edit, and delete custom categories with colors and icons
- **Manual Override**: Manually reclassify emails when AI gets it wrong
- **Confidence Scores**: See AI confidence for each classification

## Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for blazing-fast development
- **TailwindCSS** for styling
- **Shadcn/ui** for beautiful components
- **Recharts** for data visualization
- **TanStack Query** for data fetching
- **Wouter** for routing

### Backend
- **Express.js** API server
- **Supabase** PostgreSQL database with pgvector
- **Drizzle ORM** for type-safe database queries
- **OpenAI API** for embeddings (text-embedding-3-small)
- **Gmail API** for email synchronization

## Prerequisites

1. **Node.js** 18+ and npm
2. **Supabase Account** (database is pre-configured in this environment)
3. **OpenAI API Key** - Get from https://platform.openai.com/api-keys
4. **Gmail API Access** (configured via Replit Connectors)

## Environment Setup

The following environment variables are already configured:

```bash
VITE_SUPABASE_URL=<your_supabase_url>
VITE_SUPABASE_ANON_KEY=<your_supabase_anon_key>
OPENAI_API_KEY=<your_openai_api_key>
SESSION_SECRET=<random_session_secret>
```

## Installation

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Start the server
npm start
```

For development:
```bash
npm run dev
```

## Database Schema

The Supabase database includes:

### Tables
1. **users** - User accounts with email and hashed passwords
2. **categories** - Email categories with custom colors and icons
3. **emails** - Synced Gmail emails with vector embeddings
4. **classifications** - Links emails to categories with confidence scores

### Features
- **Row Level Security (RLS)** - All data is user-scoped
- **Vector Search** - HNSW index for fast similarity queries
- **Cascading Deletes** - Clean data relationships
- **Timestamps** - Automatic creation timestamps

## Usage Guide

### First Time Setup

1. **Create Account**
   - Navigate to the login page
   - Click "Chưa có tài khoản? Đăng ký"
   - Enter email and password (min 6 characters)

2. **Create Categories**
   - Go to "Danh mục" (Categories) page
   - Click "+ Tạo Danh mục"
   - Choose name, description, color, and icon
   - Save category

3. **Sync Emails**
   - Go to "Dashboard" or "Emails" page
   - Click "Đồng bộ Gmail" button
   - Wait for sync to complete (processes 10 emails at a time to avoid rate limits)

4. **Classification**
   - AI automatically classifies synced emails
   - View confidence scores on each email
   - Manually reclassify by clicking email → changing category

### Advanced Usage

#### Filtering Emails
- **Search**: Type in search box to filter by subject, sender, or content
- **Category Filter**: Select specific category from dropdown
- **Date Range**: Filter by today, 7 days, or 30 days
- **Sender Filter**: Filter by specific sender email
- **Archived**: Toggle to show/hide archived emails

#### Bulk Actions
1. Select emails using checkboxes
2. Use "Chọn tất cả" to select all visible emails
3. Click bulk action buttons (Archive, Categorize)
4. Selected count shows in header

#### Dashboard Analytics
- View total emails, categorized count, and categories
- See average AI confidence score
- Interactive pie chart shows distribution
- Bar chart shows counts per category
- Category list with percentages

## API Endpoints

### Authentication
- `POST /api/auth/register` - Create new account
- `POST /api/auth/login` - Login to account
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user

### Categories
- `GET /api/categories` - List all categories
- `GET /api/categories/stats` - Categories with email counts
- `POST /api/categories` - Create category
- `PATCH /api/categories/:id` - Update category
- `DELETE /api/categories/:id` - Delete category

### Emails
- `GET /api/emails` - List emails (with filters)
- `POST /api/emails/sync` - Sync from Gmail
- `POST /api/emails/:id/classify` - Classify email
- `POST /api/emails/compute-embeddings` - Recompute all embeddings

### Stats
- `GET /api/stats` - Dashboard statistics

## AI Classification

### How It Works

1. **Email Sync**: Fetches emails from Gmail API
2. **Embedding Generation**: Creates vector embeddings using OpenAI
3. **Similarity Search**: Compares new email to classified emails
4. **Auto-Classification**: Assigns category based on highest similarity
5. **Threshold**: Only auto-classifies if confidence > 0.5

### Improving Accuracy

- Manually classify more emails to build training data
- Create specific categories for different email types
- Use descriptive category names
- Reclassify misclassified emails to improve future predictions

## Performance Optimization

### Rate Limiting
- Gmail sync processes 10 emails at a time
- 100ms delay between Gmail API calls
- 200ms delay between OpenAI API calls

### Database
- Vector index (HNSW) for fast similarity search
- Indexed on user_id, gmail_id, received_at
- Composite indexes for common queries

### Frontend
- TanStack Query for caching and optimistic updates
- Lazy loading for email lists
- Skeleton loaders for better UX

## Troubleshooting

### Common Issues

**Gmail Sync Fails**
- Check Gmail API permissions
- Ensure Gmail connection is active
- Check rate limits (max 10 emails per sync)

**AI Classification Not Working**
- Verify OPENAI_API_KEY is set
- Check OpenAI API quota
- Ensure embeddings are generated

**Database Connection Issues**
- Verify VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
- Check Supabase project is active
- Review RLS policies

## Security Best Practices

- Passwords are SHA-256 hashed
- Session cookies are httpOnly
- Row Level Security enforces data isolation
- No SQL injection via parameterized queries
- Environment variables for secrets

## Future Enhancements

- Email templates and quick replies
- Advanced analytics and insights
- Email scheduling and reminders
- Integration with other email providers
- Mobile app
- Real-time notifications
- Machine learning model training
- Export/import functionality

## Support

For issues or questions:
1. Check this guide
2. Review error logs in browser console
3. Check server logs for API errors
4. Verify environment variables are set correctly

## License

MIT License - See LICENSE file for details
