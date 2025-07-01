# Cloudflare Mailbox Development Guidelines

This document contains guidelines for developing this repository. Since the developers are Japanese, please write PR and Issue content in Japanese.

Therefore, all English documents included in the repository are translated from Japanese. For example, CLAUDE.md is an English translation of CLAUDE_ja.md. Please avoid editing only CLAUDE.md. Create a commit to update CLAUDE.md after committing edits to CLAUDE_ja.md.

## Coding Rules

This repository adopts the following coding rules.

### TypeScript (mainly type-related rules)

- Do not use assertions at all; if you must use them, provide a comment explaining the reason
  - However, `as const` and `satisfies` may be used
- Do not use `any` or `unknown`
- Do not use `interface` when it can be substituted with `type`
- Define complex types with `type`; exporting them is also acceptable

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

- Avoid using `let`; use `const` instead
- Avoid using `forEach`; use `map` or `filter` instead
  - `for of` is acceptable
- Avoid using the `function` keyword; in principle, define with `const` and arrow functions
- Avoid using `then` for Promises; use `async/await` instead
- Object property order should be as follows:
  - Property names
  - Constructor
  - Methods
  - getter/setter

## Development Environment Guidelines

### Package Management

- **Use bun**: Use `bun` instead of `npm`
  - Installation: `bun install`
  - Execution: `bun run dev`, `bun run build`, etc.

### Git Management

- **Do not commit ignored files**: Do not commit files excluded by `.gitignore` (such as `wrangler.jsonc`) using the `-f` flag
- **Commit only related files**: When implementing features, commit only related files incrementally

### React Router v7 Routing

- **Explicit route definition required**: When creating new pages, add route definitions to `src/app/routes.ts`
  - Example: `route("/admin/new-page", "routes/admin/new-page.tsx")`
- **Nested routes**: Sub-pages also need individual definitions
  - Example: `route("/admin/settings/history", "routes/admin/settings/history.tsx")`

### Guidelines for AI Assistants

- **Do not start development servers**: AIs like Claude or Gemini must not execute server startup commands like `npm run dev` or `bun run dev`
  - Reason: The process does not stop, making the session unresponsive

# Cloudflare Mailbox System Specifications

## Overview

A mailbox management system using Cloudflare Workers and KV. Provides centralized management of multiple email addresses and efficient email processing.

## Key Features

### 1. User Management System

- **Username-based authentication**: Login with username instead of email address
- **Invitation-only**: Registration only through invitation tokens issued by administrators
- **Hybrid session management**: React Router v7 + KV integration approach
  - Cookie: sessionId only (React Router managed)
  - KV: Session data persistence (expiration management & forced logout support)

### 2. Multiple Mailbox Management

- One user can manage multiple email addresses
- Each email address has an independent inbox
- Unified view for batch display is also possible

### 3. Performance Optimization

#### KV Design

- **O(1) access**: Username index (`username:key → userId`)
- **Avoiding list operations**: Minimize high-cost list operations
- **Parallel processing**: Parallel retrieval of multiple mailboxes

#### Data Structure

- src/utils/kv contains data structures for KV storage.
  - src/utils/kv/schema.ts: Validation schema for data stored in KV
  - Others contain utility functions for KV storage operations.

**Always use utility functions when accessing KV storage. Avoid direct access**

### 🏗️ Architecture Features

- **React Router v7**: Utilizing the latest routing capabilities
- **Cloudflare Workers**: High-speed edge computing

---

## Frontend Design Specifications

### Responsive Design

#### Layout Patterns

- **Mobile (~768px)**: Drawer navigation + full-screen content
- **Tablet (769px ~ 1024px)**: Adaptive layout
- **Desktop (1025px ~)**: Sidebar + main content

### CSS Architecture

#### Styling Strategy

Styling is performed in the following priority order:

1. **Tailwind CSS**: Basically implement all styles with Tailwind CSS.
2. **CSS Modules + SCSS**: For styles that cannot be implemented with Tailwind CSS, use CSS Modules and SCSS.
3. **Inline Styles**: When you need to dynamically change CSS, use React inline styles. However, try to implement dynamic styles using CSS Modules or Tailwind CSS whenever possible.

---

Last updated: June 30, 2025 (Responsive design specifications added)
