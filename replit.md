# ZATCA QR Code Scanner Application

## Overview

This is a full-stack React application designed for scanning and processing Saudi Arabia's ZATCA QR codes on invoices. The application provides a web-based interface for businesses to scan QR codes using camera or file upload, parse invoice data, and export the results to Excel format.

## System Architecture

The application follows a monorepo structure with clear separation between client, server, and shared code:

- **Frontend**: React with TypeScript, using Vite for bundling and development
- **Backend**: Express.js with TypeScript running on Node.js
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Deployment**: Configured for Replit's autoscale deployment platform

## Key Components

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Bundler**: Vite with custom configuration for development and production
- **State Management**: TanStack Query (React Query) for server state management
- **UI Components**: Radix UI primitives with shadcn/ui component library
- **Styling**: Tailwind CSS with custom design system
- **QR Scanning**: Native QR scanner library with camera and file upload support
- **Export**: Excel export functionality using XLSX library

### Backend Architecture  
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **Database ORM**: Drizzle ORM with PostgreSQL adapter
- **Session Management**: Express sessions with PostgreSQL store
- **API Design**: RESTful API with consistent error handling
- **Development**: Hot reload with tsx for TypeScript execution

### Database Schema
Two main tables managed by Drizzle ORM:
- **scan_sessions**: Tracks scanning sessions with unique session IDs
- **scanned_qrs**: Stores individual QR scan records with parsed invoice data including seller details, amounts, and validation status

### Data Storage Strategy
The application implements a flexible storage interface (`IStorage`) with two implementations:
- **MemStorage**: In-memory storage for development and testing
- **Database Storage**: PostgreSQL implementation for production (referenced but not fully implemented in current codebase)

## Data Flow

1. **Session Creation**: User starts a scanning session, generating a unique session ID
2. **QR Code Scanning**: Camera or file upload captures QR codes
3. **Data Parsing**: ZATCA QR parser extracts invoice information using TLV format
4. **Data Validation**: Parsed data is validated against expected ZATCA structure
5. **Storage**: Valid and invalid scans are stored with session association
6. **Display**: Real-time updates show scan results in a tabular format
7. **Export**: Users can export filtered data to Excel with customizable options

## External Dependencies

### Core Framework Dependencies
- React ecosystem (React, React DOM, React Router via Wouter)
- Node.js/Express for backend services
- PostgreSQL with Neon serverless adapter
- Drizzle ORM for database operations

### UI and Styling
- Radix UI component primitives for accessible components
- Tailwind CSS for utility-first styling
- Lucide React for consistent iconography
- shadcn/ui component system

### Development Tools
- Vite for fast development and bundling
- TypeScript for type safety
- ESBuild for production bundling
- tsx for TypeScript execution in development

### Business Logic
- QR Scanner library for camera/file QR code reading
- XLSX library for Excel export functionality
- Custom ZATCA parser for Saudi invoice QR format
- TanStack Query for data fetching and caching

## Deployment Strategy

The application is configured for deployment on Replit's platform:

- **Development**: `npm run dev` starts both frontend and backend in development mode
- **Build**: `npm run build` creates optimized production bundles
- **Production**: `npm run start` serves the production application
- **Database**: Configured for PostgreSQL with environment-based connection strings
- **Port Configuration**: Backend serves on port 5000, frontend proxied through Vite in development

The build process creates static assets for the frontend and a bundled Node.js application for the backend, suitable for serverless deployment environments.

## Changelog

```
Changelog:
- June 16, 2025. Initial setup
```

## User Preferences

```
Preferred communication style: Simple, everyday language.
```