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
    | 'log_fuel'

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
    | 'view_orders';

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
    [Role.SUPER_ADMIN]: [
        'manage_users',
        'manage_staff',
        'view_staff', // Added
        'manage_fleet',
        'view_fleet', // Added
        'manage_maintenance', // Added - was missing, caused crashes
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
    ],
    [Role.MANAGER]: [
        'view_staff',
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

export function hasPermission(userRole: string, permission: Permission): boolean {
    const role = Object.values(Role).find((r) => r === userRole);
    if (!role) return false;
    return ROLE_PERMISSIONS[role].includes(permission);
}

export function checkPermission(userRole: string, permission: Permission): void {
    if (!hasPermission(userRole, permission)) {
        throw new Error(`Unauthorized: Missing permission ${permission}`);
    }
}
