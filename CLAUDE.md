# Cloudflare Mailbox Development Guidelines

This document contains guidelines for developing this repository. Since the developers are Japanese, please write PR and Issue content in Japanese.

Therefore, all English documents included in the repository are translated from Japanese. For example, CLAUDE.md is an English translation of CLAUDE_ja.md. Therefore, please avoid editing only CLAUDE.md. After creating a commit that edits CLAUDE_ja.md, please create a commit to update CLAUDE.md.

## Coding Rules

This repository adopts the following coding rules.

### TypeScript (mainly type-related rules)

- Do not use assertions at all; if used, include the reason in comments
  - However, `as const` and `satisfies` may be used
- Do not use `any` or `unknown`
- Do not use `interface` when it can be substituted with `type`
- Define complex types with `type`; they may also be exported

### Naming Conventions

#### camelCase (lowerCamelCase)

- Variable names
- Function names
- Class instance variables
- Class method names

#### PascalCase (UpperCamelCase)

- Class names
- Type aliases

### JavaScript (mainly syntax-related rules)

- Avoid using `let` as much as possible; use `const`
- Avoid using `forEach` as much as possible; use `map` or `filter`
  - `for of` may be used
- Avoid using the `function` keyword as much as possible; define with `const` and arrow functions in principle
- Avoid using Promise `then` as much as possible; use `async/await`
- Object property order should be in the following order:
  - Property names
  - Constructor
  - Methods
  - Getters/setters

# Cloudflare Mailbox System Specification

## Overview

A mailbox management system using Cloudflare Workers and KV. Centrally manages multiple email addresses and provides efficient email processing.

## Key Features

### 1. User Management System

#### Authentication Method

- **Username-based authentication**: Login with username instead of email address
- **Invitation-only**: Registration only through invitation tokens issued by administrators
- **Hybrid session management**: React Router v7 + KV integration approach
  - Cookie: sessionId only (React Router managed)
  - KV: Session data persistence (expiration management & force logout support)

#### User Information

```typescript
User {
  id: string (UUID)
  username: string (3-30 characters, alphanumeric and underscore)
  email: string (contact email address)
  managedEmails: string[] (list of managed email addresses)
  passwordHash: string
  createdAt: number
  lastLogin?: number
}
```

**Important constraints**:

- `email` (for contact) and `managedEmails` (for management) cannot overlap
- `email`: Contact address for system notifications, password resets, etc.
- `managedEmails`: Addresses that actually receive and manage emails

### 2. Multiple Mailbox Management

#### Basic Concept

- One user can manage multiple email addresses
- Each email address has its own independent inbox
- Integrated view for batch display is also possible

#### API Features

- **Integrated display**: Integrated display of all managed mailboxes
- **Individual display**: Display of specific mailboxes only
- **Access control**: Access only to managed email addresses

### 3. Performance Optimization

#### KV Design

- **O(1) access**: Username index (`username:key → userId`)
- **Avoiding list operations**: Minimize high-cost list operations
- **Parallel processing**: Parallel retrieval of multiple mailboxes

#### Data Structure

```
KV structure:
- user:{userId} → User information
- username:{username} → userId (index)
- session:{sessionId} → User session information
- admin:{adminId} → Admin information
- admin-username:{username} → adminId (index)
- admin-session:{sessionId} → Admin session information
- inbox:{email} → EmailMetadata[]
- msg:{messageId} → EmailMessage
- thread:{threadId} → messageId[]

React Router v7 Cookie:
- __user_session: {sessionId: string}
- __admin_session: {sessionId: string}
```

### KV Optimization Strategy

1. **Index utilization**: Create dedicated indexes for frequently accessed data
2. **Avoiding list operations**: Use list only for low-frequency operations like admin screens
3. **Parallel processing**: Efficient data retrieval using Promise.all
4. **Client-side processing**: Sorting and filtering on the client side

### Performance Considerations

- O(1) user search during login
- Parallel retrieval of multiple mailboxes
- Client-side email integration and sorting
- Minimizing high-cost list operations

## Current Implementation Status

### ✅ Completed Features

#### Authentication & Session Management
- **React Router v7 + KV Integration**: Hybrid architecture with Cookie (sessionId) + KV (session data)
- **Admin Authentication**: IP restriction + session authentication with initial setup support
- **User Authentication**: Invitation-based registration, username-based login
- **Unified Session Management**: Both admin and user sessions managed through `session.server.ts`

#### Email Features
- **Email List**: Integrated display of multiple mailboxes, individual mailbox switching
- **Email Details**: HTML/text display with attachment support
- **Read Status Management**: Individual email read status, unread count display
- **Search & Filter**: Filtering by sender, subject, date range

#### Admin Features
- **Dashboard**: Statistics display (user count, admin count)
- **User Management**: List view, deletion functionality
- **Invitation Management**: Invitation URL generation and management screen
- **Administrator Management**: Admin addition, listing, deletion

#### UI Implementation
- **Responsive Design**: Complete mobile support for all pages
  - Unified breakpoints: 768px (mobile), 1024px (tablet)
  - Mobile drawer navigation + desktop sidebar
  - CSS Modules for scoped style management
- **Landing Page**: Home page for unauthenticated users
- **User Dashboard**: Main screen after authentication

#### User Settings Features
- **Basic Settings Page**: `/settings` - Theme, language, timezone, notification settings
- **Profile Management**: `/profile` - User information display and editing, managed email configuration
- **Password Change**: `/settings/password` - Secure password updates
- **Unified Settings Navigation**: Responsive navigation system

#### Email Feature Extensions
- **Pagination**: Efficient pagination with 50 items per page (completed)
- **Folder Management**: Custom folder creation and email movement
- **Signed URLs**: External access support for attachments

### 🚧 In Progress / Incomplete Features

#### UI/UX Improvements
- **Dark Mode Support**: Theme switching functionality (settings items implemented)
- **Notifications & Toasts**: Enhanced user feedback
- **Loading States**: Proper state display during operations

### 🏗️ Architecture Features

#### React Router v7 Support
- **File-based routing**: Intuitive route structure
- **Loader/Action pattern**: Separation of data fetching and updates
- **Type-safe**: Full TypeScript support

#### Cloudflare Workers Optimization
- **Edge computing**: Low-latency delivery worldwide
- **KV Storage**: Efficient data persistence
- **R2 Storage**: Secure attachment storage

#### Security Measures
- **IP Restrictions**: Geographic restrictions for admin access
- **Session Management**: Proper expiration and invalidation
- **Access Control**: Permission control based on managed email addresses

## Future Expansion Plans

### Short-term Plans (1-2 months)
- Dark mode implementation (settings items completed)
- UI/UX improvements (notification features, loading states)
- Signed URL support for attachments

### Medium-term Plans (3-6 months)
- Custom folder functionality
- Email sending functionality
- Advanced search and filtering

### Long-term Plans (6+ months)
- Metrics and log collection
- Failure monitoring and alerts
- Backup and recovery systems
- Scaling support

---

## Frontend Design Specifications

### Responsive Design

#### Breakpoint Strategy
```scss
// Unified breakpoints
@media (max-width: 768px)  // Mobile
@media (max-width: 1024px) // Tablet
// 1024px and above: Desktop
```

#### Layout Patterns
- **Mobile (~768px)**: Drawer navigation + fullscreen content
- **Tablet (769px~1024px)**: Adaptive layout
- **Desktop (1025px~)**: Sidebar + main content

#### Navigation Design
- **SettingsNav**: CSS Modules + React state management
  - Mobile: Hamburger menu + overlay drawer
  - Desktop: Fixed sidebar
  - Auto-close functionality (on link click/overlay tap)

### CSS Architecture

#### Styling Strategy
- **CSS Modules**: Component-specific styles (`.module.scss`)
- **Tailwind CSS**: Utility classes (layout, colors, spacing)
- **SCSS**: Complex responsive logic and nested structures

#### File Structure
```
src/app/
├── components/
│   ├── SettingsNav.tsx
│   └── SettingsNav.module.scss
├── routes/
│   ├── messages.tsx
│   └── messages.module.scss
```

---

Last updated: June 30, 2025 (Responsive design specifications added)