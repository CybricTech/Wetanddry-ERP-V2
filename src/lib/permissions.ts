// This module is imported by BOTH server and client code, so it must never import
// prisma or anything server-only. Database-backed roles are loaded by
// src/lib/roles.server.ts, which primes the cache below via primeRoleCache().

export enum Role {
    SUPER_ADMIN = 'Super Admin',
    MANAGER = 'Manager',
    STOREKEEPER = 'Storekeeper',
    ACCOUNTANT = 'Accountant',
}

export type Permission =
    // User Management
    | 'manage_users'
    | 'manage_staff'
    | 'view_staff'

    // Fleet
    | 'manage_fleet'
    | 'view_fleet'
    | 'manage_maintenance'
    | 'approve_maintenance'

    // Documents
    | 'manage_truck_documents'
    | 'view_truck_documents'

    // Inventory
    | 'manage_inventory' // Full CRUD + Override
    | 'view_inventory'
    | 'create_inventory_item'

    // Material Requests
    | 'approve_material_requests'
    | 'create_material_requests'
    | 'view_material_requests' // View all
    | 'view_own_material_requests'

    // Stock Transactions
    | 'approve_stock_transactions'
    | 'create_stock_transactions'
    | 'view_stock_transactions'

    // Silo Management (Super Admin only)
    | 'manage_silos'

    // Inventory Approval
    | 'approve_inventory_items'

    // Production
    | 'manage_recipes'
    | 'view_recipes'
    | 'log_production'
    | 'view_production_runs'

    // Fuel
    | 'manage_fuel'
    | 'view_fuel_logs'
    | 'log_fuel' // Submit a fuel request; the issuance itself needs approval
    | 'approve_fuel_requests'

    // Exceptions
    | 'manage_exceptions' // Resolve/Delete
    | 'create_exception'
    | 'view_exceptions'

    // Reporting & Settings
    | 'view_analytics' // Dashboard
    | 'view_financials' // Costs/Values
    | 'manage_system_settings'

    // CRM
    | 'view_crm'
    | 'manage_clients'
    | 'manage_expenses'
    | 'approve_expenses'
    | 'view_expense_reports'

    // Orders & Payments
    | 'manage_orders'
    | 'approve_orders'
    | 'view_orders'

    // Behaviour flags - these do NOT grant access, they modify how an already
    // authorised action behaves. Keep them grouped and out of PAGE_PERMISSIONS.
    | 'require_approval_confirmation';

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
    [Role.SUPER_ADMIN]: [
        'manage_users',
        'manage_staff',
        'view_staff', // Added
        'manage_fleet',
        'view_fleet', // Added
        'manage_maintenance', // Added - was missing, caused crashes
        'approve_maintenance',
        'manage_truck_documents',
        'view_truck_documents', // Added (just in case)
        'manage_inventory',
        'view_inventory', // Added
        'create_inventory_item', // Added
        'approve_material_requests',
        'create_material_requests',
        'view_material_requests',
        'approve_stock_transactions',
        'create_stock_transactions',
        'view_stock_transactions',
        'manage_silos',
        'approve_inventory_items',
        'manage_recipes',
        'view_recipes', // Added
        'log_production',
        'view_production_runs',
        'manage_fuel',
        'view_fuel_logs', // Added
        'log_fuel', // Added
        'approve_fuel_requests',
        'manage_exceptions',
        'create_exception',
        'view_exceptions',
        'view_analytics',
        'view_financials',
        'manage_system_settings',
        // CRM
        'view_crm',
        'manage_clients',
        'manage_expenses',
        'approve_expenses',
        'view_expense_reports',
        // Orders
        'manage_orders',
        'approve_orders',
        'view_orders',
        // Behaviour: preserves the pre-existing Super Admin confirmation dialog
        'require_approval_confirmation',
    ],
    [Role.MANAGER]: [
        'view_staff',
        'manage_staff',
        'view_fleet',
        'manage_maintenance',
        'manage_truck_documents', // Added - was missing, caused crashes
        'view_truck_documents',
        'view_inventory', // Added - per documentation Manager can view inventory
        'approve_material_requests',
        'create_material_requests',
        'view_material_requests',
        'approve_stock_transactions',
        'create_stock_transactions',
        'view_stock_transactions',
        'approve_inventory_items',
        'view_recipes',
        'log_production',
        'view_production_runs',
        'view_fuel_logs',
        'log_fuel',
        'create_exception',
        'manage_exceptions', // Resolve only, handled in logic
        'view_exceptions',
        'view_analytics',
        'view_financials',
        // CRM
        'view_crm',
        'manage_clients',
        'manage_expenses',
        'approve_expenses',
        'view_expense_reports',
        // Orders
        'manage_orders',
        'approve_orders',
        'view_orders',
    ],
    [Role.STOREKEEPER]: [
        'create_inventory_item',
        'view_inventory',
        'create_material_requests',
        'view_own_material_requests',
        'create_stock_transactions',
        'view_recipes',
        'log_production',
        'create_exception',
        'view_exceptions',
        'log_fuel',
        'view_fuel_logs',
        'view_orders',
    ],
    [Role.ACCOUNTANT]: [
        'view_fleet',
        'view_truck_documents',
        'view_inventory',
        'view_material_requests',
        'view_stock_transactions',
        'view_recipes',
        'view_production_runs',
        'view_fuel_logs',
        'log_fuel', // Fuel requests are open to anyone who can reach the fuel page
        'view_exceptions',
        'view_analytics',
        'view_financials',
        // CRM (view and record expenses only)
        'view_crm',
        'manage_expenses',
        'view_expense_reports',
        'view_orders',
    ],
};

// ==================== PAGE ACCESS ====================

// The pages a role can be granted in the role editor. Each maps to the permission
// that src/components/Layout/Sidebar.tsx already uses to filter its nav items, so
// granting a page here is what makes the sidebar and page guards let the user in.
// Dashboard and Settings are intentionally absent: both are ungated in Sidebar.tsx
// and every authenticated user reaches them.
export const PAGE_PERMISSIONS: { id: string; label: string; permission: Permission }[] = [
    { id: 'crm', label: 'Customers', permission: 'view_crm' },
    { id: 'orders', label: 'Orders', permission: 'view_orders' },
    { id: 'trucks', label: 'Fleet', permission: 'view_fleet' },
    { id: 'inventory', label: 'Inventory', permission: 'view_inventory' },
    { id: 'fuel', label: 'Fuel', permission: 'view_fuel_logs' },
    { id: 'production', label: 'Production', permission: 'view_recipes' },
    { id: 'finance', label: 'Reports', permission: 'view_financials' },
    { id: 'exceptions', label: 'Exceptions', permission: 'view_exceptions' },
    { id: 'staff', label: 'Staff', permission: 'view_staff' },
];

// Behaviour flags surfaced in the role editor, kept separate from page access
// because they modify how an action behaves rather than granting entry anywhere.
export const BEHAVIOUR_FLAGS: { permission: Permission; label: string; help: string }[] = [
    {
        permission: 'require_approval_confirmation',
        label: 'Require confirmation before approving',
        help: 'Adds a confirmation step before an approval is committed. This does not grant or remove the ability to approve.',
    },
];

// Approval rights surfaced in the role editor. Separate from page access because
// holding one of these does not open a page - it decides who can sign off on work
// submitted from a page the role can already reach. Ships Super Admin-only, but is
// delegable from Settings > Roles without a code change.
export const APPROVAL_PERMISSIONS: { permission: Permission; label: string; help: string }[] = [
    {
        permission: 'approve_maintenance',
        label: 'Approve maintenance',
        help: 'Sign off on maintenance records and service schedules submitted by other users. Until approved, a record does not update the truck or raise service alerts.',
    },
    {
        permission: 'approve_fuel_requests',
        label: 'Approve fuel requests',
        help: 'Sign off on fuel requests. Holders issue fuel directly without a request step; everyone else submits a request that waits here.',
    },
    {
        permission: 'approve_inventory_items',
        label: 'Approve new inventory items',
        help: 'Sign off on items added to inventory before they become active stock.',
    },
    {
        permission: 'approve_stock_transactions',
        label: 'Approve stock movements',
        help: 'Sign off on stock in, stock out, and adjustment transactions.',
    },
    {
        permission: 'approve_material_requests',
        label: 'Approve material requests',
        help: 'Sign off on requests to move or issue materials.',
    },
    {
        permission: 'approve_expenses',
        label: 'Approve expenses',
        help: 'Sign off on expenses recorded against clients, projects, and trucks.',
    },
    {
        permission: 'approve_orders',
        label: 'Approve orders',
        help: 'Confirm sales orders so they can be fulfilled.',
    },
];

export const ROLE_COLORS = ['blue', 'amber', 'emerald', 'purple', 'rose', 'slate'] as const;
export type RoleColor = (typeof ROLE_COLORS)[number];

// ==================== ROLE RESOLUTION ====================

// Populated on the server by src/lib/roles.server.ts. On the client this stays
// null and the built-in table below is used instead, which is why client code
// must read session.user.permissions (see usePermissions) to see custom roles.
let roleCache: Map<string, ReadonlySet<Permission>> | null = null;

export function primeRoleCache(roles: { name: string; permissions: string[] }[]): void {
    roleCache = new Map(
        roles.map((r) => [r.name, new Set(r.permissions as Permission[]) as ReadonlySet<Permission>])
    );
}

export function clearRoleCache(): void {
    roleCache = null;
}

export function isRoleCachePrimed(): boolean {
    return roleCache !== null;
}

function resolvePermissions(userRole: string): ReadonlySet<Permission> | null {
    const cached = roleCache?.get(userRole);
    if (cached) return cached;

    // Fall back to the built-in table when the cache is cold or the role predates
    // it. Deliberately NOT a blanket deny: a transient database problem would
    // otherwise lock every user out, including the Super Admin needed to fix it.
    // Unknown custom roles still resolve to null and are denied.
    const builtIn = Object.values(Role).find((r) => r === userRole);
    if (builtIn) return new Set(ROLE_PERMISSIONS[builtIn]);

    return null;
}

export function hasPermission(userRole: string, permission: Permission): boolean {
    return resolvePermissions(userRole)?.has(permission) ?? false;
}

export function checkPermission(userRole: string, permission: Permission): void {
    if (!hasPermission(userRole, permission)) {
        throw new Error(`Unauthorized: Missing permission ${permission}`);
    }
}

export function getPermissionsForRole(userRole: string): Permission[] {
    const resolved = resolvePermissions(userRole);
    return resolved ? Array.from(resolved) : [];
}

// Client-side counterpart to hasPermission, over the resolved list carried on the
// session. Used by usePermissions so custom roles work in the browser.
export function hasPermissionIn(
    permissions: readonly Permission[] | readonly string[] | undefined,
    permission: Permission
): boolean {
    return permissions ? (permissions as readonly string[]).includes(permission) : false;
}
