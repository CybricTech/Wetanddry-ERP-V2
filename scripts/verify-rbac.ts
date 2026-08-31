/**
 * End-to-end RBAC verification.
 *  Phase 1 - the converted checks still behave identically for built-in roles.
 *  Phase 2 - custom roles resolve, built-ins are unchanged, unknown roles denied.
 *
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/verify-rbac.ts
 */
import { PrismaClient } from '../src/generated/prisma';
import {
    hasPermission,
    primeRoleCache,
    clearRoleCache,
    ROLE_PERMISSIONS,
    Role,
    PAGE_PERMISSIONS,
    type Permission,
} from '../src/lib/permissions';

const prisma = new PrismaClient();
const TEST_ROLE = '__verify_site_supervisor';
const ROLES = ['Super Admin', 'Manager', 'Storekeeper', 'Accountant'];

let failures = 0;
function check(label: string, actual: boolean, expected: boolean) {
    const ok = actual === expected;
    if (!ok) {
        failures++;
        console.log(`  FAIL  ${label} (expected ${expected}, got ${actual})`);
    }
}

// Each converted site, with the hardcoded role list it used before Phase 1.
const PHASE1: { site: string; oldRoles: string[]; perm: Permission }[] = [
    { site: 'finance.ts x5', oldRoles: ['Super Admin', 'Manager', 'Accountant'], perm: 'view_financials' },
    { site: 'inventory.ts valuation x3', oldRoles: ['Super Admin', 'Manager', 'Accountant'], perm: 'view_financials' },
    { site: 'inventory.ts:178 stock auto-approve', oldRoles: ['Super Admin', 'Manager'], perm: 'approve_stock_transactions' },
    { site: 'inventory.ts:472 item auto-approve', oldRoles: ['Super Admin', 'Manager'], perm: 'approve_inventory_items' },
    { site: 'crm.ts approve/reject expense', oldRoles: ['Super Admin', 'Manager'], perm: 'approve_expenses' },
    { site: 'duplicates page', oldRoles: ['Super Admin'], perm: 'manage_system_settings' },
    { site: 'CRMClient canManageClients', oldRoles: ['Super Admin', 'Manager'], perm: 'manage_clients' },
    { site: 'FinanceClient canManageExpenses', oldRoles: ['Super Admin', 'Manager', 'Accountant'], perm: 'manage_expenses' },
    { site: 'FinanceClient canApproveExpenses', oldRoles: ['Super Admin', 'Manager'], perm: 'approve_expenses' },
    { site: 'TruckDetails edit/delete', oldRoles: ['Super Admin'], perm: 'manage_fleet' },
    { site: 'ActivityTab confirm dialog', oldRoles: ['Super Admin'], perm: 'require_approval_confirmation' },
];

async function main() {
    const roles = await prisma.role.findMany({ select: { name: true, permissions: true } });
    primeRoleCache(roles);

    console.log('Phase 1 - converted checks match the old hardcoded role lists');
    for (const { site, oldRoles, perm } of PHASE1) {
        for (const role of ROLES) {
            check(`${site} / ${role}`, hasPermission(role, perm), oldRoles.includes(role));
        }
    }
    console.log(`  ${PHASE1.length * ROLES.length} assertions`);

    console.log('\nPhase 3 - approval rights ship Super Admin only');
    for (const perm of ['approve_maintenance', 'approve_fuel_requests'] as Permission[]) {
        for (const role of ROLES) {
            check(`${perm} / ${role}`, hasPermission(role, perm), role === 'Super Admin');
        }
    }
    // Creating still has to be open to non-approvers, otherwise nothing ever reaches
    // the queue in the first place.
    check('Manager keeps manage_maintenance', hasPermission('Manager', 'manage_maintenance'), true);
    check('Storekeeper keeps log_fuel', hasPermission('Storekeeper', 'log_fuel'), true);
    check('Accountant keeps log_fuel', hasPermission('Accountant', 'log_fuel'), true);


    console.log('\nFuel log edits - request is open to page holders, approval is not');
    for (const role of ROLES) {
        // All four built-in roles can reach the fuel page, so all four may request.
        check(`view_fuel_logs / ${role}`, hasPermission(role, 'view_fuel_logs'), true);
        // Approving is Super Admin only until delegated from Settings > Roles.
        check(`approve_fuel_requests / ${role}`, hasPermission(role, 'approve_fuel_requests'), role === 'Super Admin');
    }
    // The feature reuses view_fuel_logs and approve_fuel_requests; it must not have
    // invented a permission, which would require a sync-role-permissions run to work.
    // Exact names, not substrings - 'view_fuel_logs' contains 'fuel_log'.
    const INVENTED = ['edit_fuel_log', 'delete_fuel_log', 'approve_edit_requests', 'manage_edit_requests'];
    const superAdminPerms = ROLE_PERMISSIONS[Role.SUPER_ADMIN] as readonly string[];
    check(
        'no new permission invented for fuel edits',
        INVENTED.some((p) => superAdminPerms.includes(p)),
        false
    );
    console.log('\nPhase 2 - built-in permission sets intact');
    for (const role of Object.values(Role)) {
        const missing = ROLE_PERMISSIONS[role].filter((p) => !hasPermission(role, p));
        check(`${role} resolves all ${ROLE_PERMISSIONS[role].length}`, missing.length === 0, true);
        if (missing.length) console.log(`        missing: ${missing.join(', ')}`);
    }

    console.log('\nPhase 2 - custom role');
    await prisma.role.deleteMany({ where: { name: TEST_ROLE } });
    await prisma.role.create({
        data: {
            name: TEST_ROLE,
            permissions: ['view_inventory', 'view_orders'],
            isBuiltIn: false,
            color: 'emerald',
        },
    });
    primeRoleCache(await prisma.role.findMany({ select: { name: true, permissions: true } }));

    check('granted view_inventory', hasPermission(TEST_ROLE, 'view_inventory'), true);
    check('granted view_orders', hasPermission(TEST_ROLE, 'view_orders'), true);
    check('not granted manage_users', hasPermission(TEST_ROLE, 'manage_users'), false);
    check('not granted view_financials', hasPermission(TEST_ROLE, 'view_financials'), false);

    // The sidebar filters on exactly these permissions.
    const visible = PAGE_PERMISSIONS.filter((p) => hasPermission(TEST_ROLE, p.permission)).map((p) => p.label);
    const expected = ['Orders', 'Inventory'];
    check(
        `sidebar shows only ${expected.join(' + ')} (got ${visible.join(', ') || 'none'})`,
        visible.length === expected.length && expected.every((e) => visible.includes(e)),
        true
    );

    console.log('\nFail-closed behaviour');
    check('unknown role denied', hasPermission('No Such Role', 'view_inventory'), false);
    clearRoleCache();
    check('cold cache: built-in still works', hasPermission(Role.SUPER_ADMIN, 'manage_users'), true);
    check('cold cache: custom denied', hasPermission(TEST_ROLE, 'view_inventory'), false);

    await prisma.role.deleteMany({ where: { name: TEST_ROLE } });
    console.log(failures === 0 ? '\nPASS - all assertions held' : `\nFAIL - ${failures} assertion(s) failed`);
    process.exit(failures === 0 ? 0 : 1);
}

main()
    .catch(async (e) => {
        console.error(e);
        await prisma.role.deleteMany({ where: { name: TEST_ROLE } }).catch(() => {});
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
