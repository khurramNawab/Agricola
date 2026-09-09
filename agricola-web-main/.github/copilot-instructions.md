# AI Coding Agent Instructions for Agri

## Project Overview
This is an agricultural e-commerce React application built with TypeScript, Vite, TailwindCSS v4, and React Router DOM. The app appears to be focused on tea/agricultural products with a component-based architecture.

## Architecture & Structure

### Routing Pattern
- **Main routing** is in `src/main.tsx` using React Router with nested routes
- **App.tsx** serves as layout wrapper that renders the Admin component
- **Public Pages** are in `src/Pages/` (note: capital P) - includes `Landing.tsx`, `Products.tsx`, `Contact.tsx`, `Blog.tsx`
- **Admin Module** is a complete SPA in `src/admin/` with internal state-based routing
- Landing page uses sectioned components for modular design

### Component Organization
```
src/
├── components/
│   ├── layout/      # Shared layout components (Header, Footer)
│   └── sections/    # Landing page sections with index.ts barrel export
├── Pages/           # Public-facing pages (Landing, Products, etc.)
└── admin/           # Complete admin dashboard module
    ├── admin.tsx    # Main admin component with state-based routing
    ├── components/  # Admin-specific UI components (Sidebar, Header, StatsCard)
    └── pages/       # Admin pages (Dashboard, Products, Orders, Payment)
```

**Key Patterns**: 
- Public sections use barrel exports but Landing.tsx imports directly
- Admin module is self-contained with internal state routing (`activePage`)
- Admin uses Lucide React icons, public uses react-icons + custom SVGs

### Icon & Asset Management
- **Custom icon system** in `src/assets/icons.tsx` with accessibility wrapper `withA11y()`
- Combines custom SVG (`AgriWordmark`) with react-icons
- **Pattern**: All icons have consistent a11y props and optional title support
- **Brand**: "AgriCola" wordmark with green (#80B314) primary color

## Technology Stack

### Build & Dev Tools
- **Vite** with `@vitejs/plugin-react` and `@tailwindcss/vite`
- **TailwindCSS v4** (note: newer syntax, not v3)
- **TypeScript** with separate app/node configs
- **ESLint** with flat config, includes react-hooks and react-refresh plugins

### Key Dependencies
- `react-router-dom` v7.9.1 (newer version, use current patterns)
- `lucide-react` + `react-icons` for iconography
- No state management library (using React state)

## Development Patterns

### Component Style
- **Functional components** with TypeScript
- **CSS-in-JS animations** embedded in components (see Hero.tsx keyframes)
- **Container/responsive** pattern: `container mx-auto px-4`
- **Green color scheme**: Primary green-500/600, secondary gray-100

### File Naming
- **Pages**: PascalCase with capital folder (`Pages/Landing.tsx`)
- **Components**: PascalCase files, default exports
- **Assets**: lowercase folders (`assets/icons.tsx`)

### Import Patterns
- Prefer **direct imports** over barrel exports for components
- **Relative imports** from src root (`../../assets/icons`)

## Admin Dashboard Architecture
- **State-based routing** in `admin.tsx` using `activePage` state (not React Router)
- **Sidebar navigation** with Lucide React icons and consistent styling
- **Dashboard components**: StatsCard for metrics, table layouts for data management
- **Page structure**: Dashboard (user management), Products, Orders, Payments, Support, Settings
- **Styling consistency**: Uses same green brand colors and TailwindCSS patterns

## Known Issues to Address
1. **Header component** is commented out in Landing.tsx
2. **Admin page titles** all return "Dashboard" regardless of active page (see `getPageTitle()`)
3. **Support & Settings** pages are placeholder implementations

## Development Commands
```bash
npm run dev          # Start Vite dev server
npm run build        # TypeScript compile + Vite build  
npm run lint         # ESLint with flat config
npm run preview      # Preview production build
```

## Quick Start Guidelines
- Fix the broken admin import in App.tsx first
- Follow the sectioned component pattern for new landing areas
- Use the established icon system for consistent a11y
- Maintain the green color scheme and responsive container pattern
- Test both routing and component rendering during development