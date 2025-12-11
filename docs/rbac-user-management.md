# User Management & Role-Based Access Control (RBAC)

This document describes the comprehensive Role-Based Access Control (RBAC) system implemented for the Wet & Dry ERP application.

## Overview

The RBAC system provides secure, granular access control across all application modules. It enforces permissions at the server action level, ensuring that unauthorized operations are blocked regardless of client-side UI state.

## User Roles

The system defines four distinct roles:

| Role | Description |
|------|-------------|
| **Super Admin** | Full unrestricted access to all system features |
| **Manager** | Operational oversight with approval capabilities |
| **Storekeeper** | Day-to-day operations (stock, production, requests) |
| **Accountant** | Financial visibility, view-only access to operations |

## Permissions by Module

### Inventory Module

| Permission | Super Admin | Manager | Storekeeper | Accountant |
|------------|:-----------:|:-------:|:-----------:|:----------:|
| `manage_inventory` | ✅ | ❌ | ❌ | ❌ |
| `create_inventory_item` | ✅ | ❌ | ✅ | ❌ |
| `view_inventory` | ✅ | ✅ | ✅ | ✅ |
| `create_stock_transactions` | ✅ | ✅ | ✅ | ❌ |
| `approve_stock_transactions` | ✅ | ✅ | ❌ | ❌ |
| `view_stock_transactions` | ✅ | ✅ | ❌ | ✅ |
| `create_material_requests` | ✅ | ✅ | ✅ | ❌ |
| `approve_material_requests` | ✅ | ✅ | ❌ | ❌ |
| `view_material_requests` | ✅ | ✅ | ❌ | ✅ |

### Fleet & Trucks Module

| Permission | Super Admin | Manager | Storekeeper | Accountant |
|------------|:-----------:|:-------:|:-----------:|:----------:|
| `manage_fleet` | ✅ | ❌ | ❌ | ❌ |
| `view_fleet` | ✅ | ✅ | ❌ | ✅ |
| `manage_maintenance` | ✅ | ✅ | ❌ | ❌ |
| `manage_truck_documents` | ✅ | ❌ | ❌ | ❌ |
| `view_truck_documents` | ✅ | ✅ | ❌ | ✅ |

### Production Module

| Permission | Super Admin | Manager | Storekeeper | Accountant |
|------------|:-----------:|:-------:|:-----------:|:----------:|
| `manage_recipes` | ✅ | ❌ | ❌ | ❌ |
| `view_recipes` | ✅ | ✅ | ✅ | ✅ |
| `log_production` | ✅ | ✅ | ✅ | ❌ |
| `view_production_runs` | ✅ | ✅ | ❌ | ✅ |

### Fuel & Exceptions Module

| Permission | Super Admin | Manager | Storekeeper | Accountant |
|------------|:-----------:|:-------:|:-----------:|:----------:|
| `manage_fuel` | ✅ | ❌ | ❌ | ❌ |
| `log_fuel` | ✅ | ✅ | ✅ | ❌ |
| `view_fuel_logs` | ✅ | ✅ | ✅ | ✅ |
| `manage_exceptions` | ✅ | ✅ | ❌ | ❌ |
| `create_exception` | ✅ | ✅ | ✅ | ❌ |
| `view_exceptions` | ✅ | ✅ | ✅ | ✅ |

### Staff & Users Module

| Permission | Super Admin | Manager | Storekeeper | Accountant |
|------------|:-----------:|:-------:|:-----------:|:----------:|
| `manage_users` | ✅ | ❌ | ❌ | ❌ |
| `manage_staff` | ✅ | ❌ | ❌ | ❌ |
| `view_staff` | ✅ | ✅ | ❌ | ❌ |

### Analytics & Settings

| Permission | Super Admin | Manager | Storekeeper | Accountant |
|------------|:-----------:|:-------:|:-----------:|:----------:|
| `view_analytics` | ✅ | ✅ | ❌ | ✅ |
| `view_financials` | ✅ | ✅ | ❌ | ✅ |
| `manage_system_settings` | ✅ | ❌ | ❌ | ❌ |

## Architecture

### Key Files

| File | Purpose |
|------|---------|
| `src/lib/permissions.ts` | Core permission definitions and helper functions |
| `src/types/next-auth.d.ts` | NextAuth type extensions for role |
| `src/auth.ts` | Authentication with role in JWT/session |
| `src/lib/actions/users.ts` | User management server actions |

### How It Works

1. **Authentication**: User logs in via NextAuth credentials provider
2. **JWT Population**: User's `role` is stored in the JWT token
3. **Session Hydration**: Role is available in `session.user.role`
4. **Server Action Guard**: Each server action calls `checkPermission()` or `hasPermission()`
5. **Enforcement**: Unauthorized actions throw errors or return gracefully

### Permission Checking Functions

```typescript
// Throws error if permission is missing (use for write operations)
checkPermission(userRole: string, permission: Permission): void

// Returns boolean (use for read operations that should degrade gracefully)
hasPermission(userRole: string, permission: Permission): boolean
```

## Usage Examples

### In Server Actions (Write Operations)

```typescript
export async function createTruck(formData: FormData) {
    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')
    checkPermission(session.user.role, 'manage_fleet')
    
    // ... create truck logic
}
```

### In Server Actions (Read Operations)

```typescript
export async function getFuelLogs() {
    const session = await auth()
    // Gracefully return empty if no permission
    if (!session?.user?.role || !hasPermission(session.user.role, 'view_fuel_logs')) {
        return []
    }
    
    return await prisma.fuelLog.findMany({...})
}
```

## Database Schema

The `User` model includes a `role` field:

```prisma
model User {
  id        String   @id @default(cuid())
  name      String
  email     String   @unique
  password  String
  role      String   @default("Storekeeper")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

Valid role values: `"Super Admin"`, `"Manager"`, `"Storekeeper"`, `"Accountant"`

## Frontend Integration (Future)

### Planned Components

- **`usePermissions` hook**: React hook for checking permissions in components
- **User Management UI**: Interface for Super Admins to manage user roles
- **Role-based Navigation**: Sidebar items hidden based on user role
- **UI Guards**: Buttons/forms disabled when user lacks permission

## Session Token Refresh

> **Important**: If a user logs in before their role is properly configured, they may need to log out and log back in to receive a fresh JWT token with their role.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Unauthorized" error on dashboard | User needs to log out and log back in |
| "Missing permission" error | User's role doesn't have that permission |
| Role is `undefined` | Check NextAuth callbacks in `auth.ts` |
