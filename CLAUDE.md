# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
```bash
npm run dev      # Start Next.js development server on http://localhost:3000
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
```

## Architecture Overview

This is a **Mercado Libre management application** built with Next.js 15 App Router, TypeScript, and Supabase.

### Key Technology Stack
- **Frontend**: Next.js 15, React 18, TypeScript
- **Database**: Supabase (PostgreSQL)
- **Styling**: Tailwind CSS with shadcn/ui components
- **Authentication**: Mercado Libre OAuth
- **External APIs**: Mercado Libre API, Google Sheets API

### Project Structure
- `/src/app/` - Next.js App Router pages and API routes
  - `/api/` - Backend API endpoints for Mercado Libre integration
  - `/admin/` - Admin dashboard for user management
  - `/dashboard/` - Main user dashboard for product management
  - `/auth/` - Authentication flow pages
- `/src/components/` - React components
  - `/ui/` - Reusable UI components (shadcn/ui based)
  - `/admin/` - Admin-specific components
  - `/dashboard/` - Dashboard components
- `/src/lib/` - Utility functions, API clients, and business logic
- `/src/hooks/` - Custom React hooks for data fetching and state management
- `middleware.ts` - Handles authentication and route protection

### Core Features Architecture
1. **Multi-tenant System**: Users can manage multiple Mercado Libre stores with store selection
2. **Team Management**: Invite system with role-based permissions
3. **Product Management**: Track items, sync with Mercado Libre, bulk operations
4. **Google Sheets Integration**: Sync product data with Google Sheets
5. **Webhook System**: Real-time updates from Mercado Libre
6. **Cron Jobs**: Automatic item updates via `/api/cron/update-items`

### Authentication Flow
- Users authenticate via Mercado Libre OAuth (`/api/auth/callback`)
- Store selection required after authentication
- Session managed via cookies and middleware protection

### Key API Patterns
- API routes follow REST conventions under `/api/`
- Supabase client initialization in `/src/lib/supabase/`
- Mercado Libre API wrapper functions in `/src/lib/`
- Error handling with consistent response formats