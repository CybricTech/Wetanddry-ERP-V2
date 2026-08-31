# Fuel Log Edit & Delete Approvals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let anyone who can open Diesel & Fuel Intelligence propose an edit or deletion of a fuel log, which changes nothing until a holder of `approve_fuel_requests` (Super Admin today) approves it.

**Architecture:** A generic, polymorphic `EditRequest` table parks proposed changes as JSON. A registry of per-entity "appliers" owns the domain semantics — field whitelist, validation, how to apply, what to recompute — so the generic core never merges untrusted JSON blindly. Only a `fuel_log` applier is registered here; the maintenance appliers designed in the sibling spec slot in later with no rework.

**Tech Stack:** Next.js App Router server actions, Prisma + PostgreSQL (Neon), NextAuth session with permissions resolved per-request, Tailwind, lucide-react.

**Spec:** `docs/superpowers/specs/2026-08-31-fuel-log-edit-approvals-design.md`

## Global Constraints

- **Do not touch the truck odometer.** Concurrent work owns it. No task may read *or* write `Truck.mileage`, add `Truck.manualMileage`/`manualMileageAt`, or modify `src/lib/actions/trucks.ts`, `updateTruck`, `applyMaintenanceRecordToTruck`, `updateTruckMileage`, or the truck detail page. Reading `MaintenanceRecord.mileageAtService` is permitted and required.
- **No new permission.** Request gate is `view_fuel_logs`; approve gate is `approve_fuel_requests`. `ROLE_PERMISSIONS` is unchanged and `scripts/sync-role-permissions.ts` must **not** be run.
- **Permission checks are on the permission, never the role name.** Never compare against the string `'Super Admin'`.
- **Whitelist for `fuel_log`:** `date`, `liters`, `cost`, `mileage`. Never writable: `id`, `truckId`, `equipmentId`, `efficiency`, `createdAt`, `updatedAt`, the `fuelRequest` relation. Stripping happens **at request time**, not approval time.
- **Efficiency recompute set (approach B):** the edited log **and its immediate chronological successor on the same truck**, ordered by `(date asc, createdAt asc)`. Never more.
- **Recompute triggers only when `mileage`, `liters`, or `date` changed.** A cost-only edit leaves `efficiency` untouched.
- **`'use server'` files may only export async functions.** Types, constants, and sync helpers live in plain modules under `src/lib/edit-requests/`.
- This repo has **no test framework**. Verification is a runnable script, following `scripts/verify-rbac.ts`. Run scripts with:
  `TS_NODE_BASEURL=. npx ts-node --compiler-options '{"module":"CommonJS"}' -r dotenv/config -r tsconfig-paths/register scripts/<name>.ts`
- Typecheck with `npx tsc --noEmit -p tsconfig.json`. ESLint is currently broken repo-wide (`eslint-plugin-react-refresh` missing from `node_modules`) — do not treat its failure as your regression.

## File Structure

**Create:**
| File | Responsibility |
|---|---|
| `src/lib/edit-requests/types.ts` | `EntityApplier` interface, `EditRequestResult`, snapshot types. No runtime code. |
| `src/lib/edit-requests/core.ts` | Generic, session-free mechanics: whitelist stripping, snapshotting, staleness detection, open-request lookup, applying an approved request. **All verification targets live here.** |
| `src/lib/edit-requests/fuel-log.ts` | The `fuel_log` applier — the only place fuel domain semantics live. |
| `src/lib/edit-requests/registry.ts` | `entityType` → applier map. |
| `src/lib/actions/edit-requests.ts` | `'use server'` actions: auth + permission gate, then delegate to core. |
| `src/lib/fuel-stock.ts` | `getFuelStockPosition` / `costOf`, extracted from `fuel.ts` so the applier can use them without importing a `'use server'` module. |
| `src/lib/fuel-metrics.ts` | Efficiency recompute. Reads `FuelLog` + `MaintenanceRecord`, writes `FuelLog.efficiency`. **Never touches `Truck`.** |
| `src/components/fuel/EditFuelLogModal.tsx` | Edit / delete-request form. |
| `src/components/fuel/FuelEditRequestsSection.tsx` | Approver diff view, rendered inside the Requests tab. |
| `scripts/verify-fuel-edits.ts` | The verification harness, grown one task at a time. |
| `prisma/migrations/20260831120000_fuel_log_edit_approvals/migration.sql` | Creates `EditRequest`. |

**Modify:**
| File | Change |
|---|---|
| `prisma/schema.prisma` | Add `EditRequest` model. No change to any existing model. |
| `src/lib/actions/fuel.ts` | Extract stock helpers out; add `requestFuelLogEdit`, `requestFuelLogDelete`, `getFuelLogEditRequests`. |
| `src/lib/actions/notifications.ts` | Three new types + config; widen `notifyApprovers` union. |
| `src/lib/actions/approvals.ts` | Add `fuel_log_edit` kind to the unified queue. |
| `src/components/fuel/FuelClient.tsx` | Actions column on log rows, pending pill, modal wiring. |
| `src/components/fuel/FuelRequestsTab.tsx` | Render the edit-requests section. |
| `src/app/(main)/fuel/page.tsx` | Fetch edit requests, compute gates, pass props. |
| `scripts/verify-rbac.ts` | Assert the two fuel gates resolve correctly for all four built-in roles. |

**A note on what can be verified.** Server actions call `auth()` and cannot run in a script without a session. That is why every decision with real logic in it lives in `src/lib/edit-requests/core.ts`, `fuel-log.ts`, or `fuel-metrics.ts` — plain modules the harness imports directly. The `'use server'` wrappers stay thin enough that reading them is sufficient review. Session-gated behaviour and all UI are verified manually per Task 10.

---

### Task 1: EditRequest table and verification harness

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260831120000_fuel_log_edit_approvals/migration.sql`
- Create: `scripts/verify-fuel-edits.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: the `EditRequest` Prisma model (`prisma.editRequest`), and a `check(label, actual, expected)` harness later tasks append assertions to.

- [ ] **Step 1: Add the model to the schema**

Append to `prisma/schema.prisma`. Do not modify any existing model.

```prisma
// Generic parking space for a proposed change to a row that already exists and must
// keep serving its current values until an approver signs off. Polymorphic by
// (entityType, entityId) with no FK, matching this schema's existing string-reference
// convention — so a request survives its target after an approved delete, which is
// what preserves the audit trail.
model EditRequest {
  id              String    @id @default(cuid())
  entityType      String    // "fuel_log" (later: "maintenance_record", "maintenance_schedule")
  entityId        String
  operation       String    @default("update") // "update" | "delete"
  proposedChanges Json?     // null for a delete
  previousValues  Json?     // whitelisted fields as they stood at request time
  status          String    @default("Pending") // "Pending", "Approved", "Rejected"
  requestedBy     String
  requestedById   String?
  approvedBy      String?
  approvedAt      DateTime?
  rejectionReason String?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@index([entityType, entityId])
  @@index([status])
}
```

- [ ] **Step 2: Hand-write the migration**

Create `prisma/migrations/20260831120000_fuel_log_edit_approvals/migration.sql`, matching the repo's existing hand-authored migration folders:

```sql
-- CreateTable
CREATE TABLE "EditRequest" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "operation" TEXT NOT NULL DEFAULT 'update',
    "proposedChanges" JSONB,
    "previousValues" JSONB,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "requestedBy" TEXT NOT NULL,
    "requestedById" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EditRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EditRequest_entityType_entityId_idx" ON "EditRequest"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "EditRequest_status_idx" ON "EditRequest"("status");
```

- [ ] **Step 3: Write the failing verification harness**

Create `scripts/verify-fuel-edits.ts`:

```ts
/**
 * Verification for fuel log edit & delete approvals.
 * Spec: docs/superpowers/specs/2026-08-31-fuel-log-edit-approvals-design.md
 *
 *   TS_NODE_BASEURL=. npx ts-node --compiler-options '{"module":"CommonJS"}' -r dotenv/config -r tsconfig-paths/register scripts/verify-fuel-edits.ts
 *
 * Creates its own throwaway truck and fuel logs, prefixed __verify_, and removes them
 * on every exit path. Never asserts against pre-existing production rows.
 */
import { PrismaClient } from '../src/generated/prisma';

const prisma = new PrismaClient();
const TAG = '__verify_fuel_edits';

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    if (ok) return;
    failures++;
    console.log(`  FAIL  ${label}\n        expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

async function cleanup() {
    const trucks = await prisma.truck.findMany({ where: { plateNumber: { startsWith: TAG } }, select: { id: true } });
    const truckIds = trucks.map((t) => t.id);
    if (truckIds.length) {
        const logs = await prisma.fuelLog.findMany({ where: { truckId: { in: truckIds } }, select: { id: true } });
        await prisma.fuelRequest.updateMany({
            where: { fuelLogId: { in: logs.map((l) => l.id) } },
            data: { fuelLogId: null },
        });
        await prisma.editRequest.deleteMany({ where: { entityId: { in: logs.map((l) => l.id) } } });
        await prisma.fuelLog.deleteMany({ where: { truckId: { in: truckIds } } });
        await prisma.maintenanceRecord.deleteMany({ where: { truckId: { in: truckIds } } });
        await prisma.truck.deleteMany({ where: { id: { in: truckIds } } });
    }
}

async function main() {
    await cleanup();

    console.log('Task 1 - EditRequest table');
    const row = await prisma.editRequest.create({
        data: { entityType: 'fuel_log', entityId: `${TAG}_probe`, requestedBy: TAG },
    });
    check('defaults to Pending', row.status, 'Pending');
    check('defaults to update', row.operation, 'update');
    check('proposedChanges nullable', row.proposedChanges, null);
    await prisma.editRequest.delete({ where: { id: row.id } });

    await cleanup();
    console.log(failures === 0 ? '\nPASS - all assertions held' : `\nFAIL - ${failures} assertion(s) failed`);
    process.exit(failures === 0 ? 0 : 1);
}

main()
    .catch(async (e) => {
        console.error(e);
        await cleanup().catch(() => {});
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
```

- [ ] **Step 4: Run it and confirm it fails**

Run: `TS_NODE_BASEURL=. npx ts-node --compiler-options '{"module":"CommonJS"}' -r dotenv/config -r tsconfig-paths/register scripts/verify-fuel-edits.ts`
Expected: FAIL — `prisma.editRequest` is undefined, because the client has not been regenerated.

- [ ] **Step 5: Apply the migration and regenerate the client**

```bash
npx prisma migrate deploy
npx prisma generate
```

If `migrate deploy` reports drift, stop and report it rather than running `migrate reset` — the database is a shared Neon instance.

- [ ] **Step 6: Run it and confirm it passes**

Run: `TS_NODE_BASEURL=. npx ts-node --compiler-options '{"module":"CommonJS"}' -r dotenv/config -r tsconfig-paths/register scripts/verify-fuel-edits.ts`
Expected: `PASS - all assertions held`

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations scripts/verify-fuel-edits.ts
git commit -m "feat: add EditRequest table for approval-gated record edits"
```

---

### Task 2: Shared fuel helpers — stock position and efficiency recompute

**Files:**
- Create: `src/lib/fuel-stock.ts`
- Create: `src/lib/fuel-metrics.ts`
- Modify: `src/lib/actions/fuel.ts` (delete the two local helpers, import them instead)
- Modify: `scripts/verify-fuel-edits.ts`

**Interfaces:**
- Consumes: `prisma.editRequest` from Task 1.
- Produces:
  - `getFuelStockPosition(): Promise<{ currentStock: number; blendedCostPerLiter: number }>`
  - `costOf(liters: number, blendedCostPerLiter: number): number`
  - `recomputeFuelLogEfficiency(logId: string): Promise<void>`
  - `findSuccessorLogId(truckId: string, date: Date, excludeId: string): Promise<string | null>`
  - `recomputeAfterFuelLogChange(before: { id: string; truckId: string | null; date: Date }): Promise<void>`

- [ ] **Step 1: Write the failing assertions**

Insert into `scripts/verify-fuel-edits.ts`, immediately before the final `await cleanup();`:

```ts
    console.log('\nTask 2 - efficiency recompute');
    const truck = await prisma.truck.create({
        data: { plateNumber: `${TAG}_A`, model: 'Verify', purchaseDate: new Date('2026-01-01'), mileage: 0 },
    });
    const d = (day: number) => new Date(`2026-03-${String(day).padStart(2, '0')}T00:00:00.000Z`);
    // Three fills: 1000 -> 1500 -> 2000 km, 100 L each.
    const l1 = await prisma.fuelLog.create({ data: { truckId: truck.id, date: d(1), liters: 100, cost: 1, mileage: 1000, efficiency: null } });
    const l2 = await prisma.fuelLog.create({ data: { truckId: truck.id, date: d(2), liters: 100, cost: 1, mileage: 1500, efficiency: null } });
    const l3 = await prisma.fuelLog.create({ data: { truckId: truck.id, date: d(3), liters: 100, cost: 1, mileage: 2000, efficiency: null } });

    await recomputeFuelLogEfficiency(l2.id);
    check('l2 = (1500-1000)/100', (await prisma.fuelLog.findUnique({ where: { id: l2.id } }))!.efficiency, 5);

    await recomputeFuelLogEfficiency(l1.id);
    check('first fill has no baseline', (await prisma.fuelLog.findUnique({ where: { id: l1.id } }))!.efficiency, null);

    check('successor of l2 is l3', await findSuccessorLogId(truck.id, d(2), l2.id), l3.id);
    check('l3 has no successor', await findSuccessorLogId(truck.id, d(3), l3.id), null);

    // A maintenance reading between two fills becomes the baseline.
    await prisma.maintenanceRecord.create({
        data: { truckId: truck.id, date: d(2), type: 'Service', cost: 0, mileageAtService: 1700, approvalStatus: 'Approved' },
    });
    await recomputeFuelLogEfficiency(l3.id);
    check('l3 baselines off maintenance 1700', (await prisma.fuelLog.findUnique({ where: { id: l3.id } }))!.efficiency, 3);

    // A Pending maintenance reading must be ignored.
    await prisma.maintenanceRecord.create({
        data: { truckId: truck.id, date: d(2), type: 'Service', cost: 0, mileageAtService: 1900, approvalStatus: 'Pending' },
    });
    await recomputeFuelLogEfficiency(l3.id);
    check('pending maintenance ignored', (await prisma.fuelLog.findUnique({ where: { id: l3.id } }))!.efficiency, 3);

    // Non-forward odometer yields null, not a negative figure.
    await prisma.fuelLog.update({ where: { id: l3.id }, data: { mileage: 1600 } });
    await recomputeFuelLogEfficiency(l3.id);
    check('backwards odometer -> null', (await prisma.fuelLog.findUnique({ where: { id: l3.id } }))!.efficiency, null);

    const truckMileageAfter = (await prisma.truck.findUnique({ where: { id: truck.id } }))!.mileage;
    check('BOUNDARY: Truck.mileage untouched by recompute', truckMileageAfter, 0);
```

Add the import at the top of the file:

```ts
import { recomputeFuelLogEfficiency, findSuccessorLogId } from '../src/lib/fuel-metrics';
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `TS_NODE_BASEURL=. npx ts-node --compiler-options '{"module":"CommonJS"}' -r dotenv/config -r tsconfig-paths/register scripts/verify-fuel-edits.ts`
Expected: FAIL — cannot resolve `../src/lib/fuel-metrics`.

- [ ] **Step 3: Extract the stock helpers**

Create `src/lib/fuel-stock.ts`, moving the two functions verbatim out of `src/lib/actions/fuel.ts` (they currently sit at `fuel.ts:29` and `fuel.ts:44`):

```ts
// Extracted from actions/fuel.ts so non-action modules (the fuel_log edit applier)
// can use them. A 'use server' file may only export async functions, so costOf
// cannot live there and be imported.
import prisma from '@/lib/prisma';

/**
 * Current fuel stock and the blended cost per litre across all deposits. Shared by the
 * request path (for an estimate) and the approval path (for the cost actually booked),
 * so the two can never drift apart.
 */
export async function getFuelStockPosition() {
    const [depositAgg, depositCostAgg, issuanceAgg] = await Promise.all([
        prisma.fuelDeposit.aggregate({ _sum: { liters: true } }),
        prisma.fuelDeposit.aggregate({ _sum: { totalCost: true } }),
        prisma.fuelLog.aggregate({ _sum: { liters: true } }),
    ]);

    const totalDeposited = depositAgg._sum.liters ?? 0;
    const totalDepositCost = depositCostAgg._sum.totalCost ?? 0;
    const totalIssued = issuanceAgg._sum.liters ?? 0;

    return {
        currentStock: totalDeposited - totalIssued,
        blendedCostPerLiter: totalDeposited > 0 ? totalDepositCost / totalDeposited : 0,
    };
}

export function costOf(liters: number, blendedCostPerLiter: number) {
    return Math.round(liters * blendedCostPerLiter * 100) / 100;
}
```

In `src/lib/actions/fuel.ts`: delete both function bodies and add to the imports at the top:

```ts
import { getFuelStockPosition, costOf } from '@/lib/fuel-stock'
```

Every existing call site is unchanged.

- [ ] **Step 4: Write the recompute module**

Create `src/lib/fuel-metrics.ts`:

```ts
// Efficiency recompute for fuel logs.
//
// BOUNDARY: this module never reads or writes Truck.mileage. The truck odometer is
// owned by separate concurrent work; see "The odometer seam" in
// docs/superpowers/specs/2026-08-31-fuel-log-edit-approvals-design.md.
import prisma from '@/lib/prisma';

export interface FuelLogSnapshot {
    id: string;
    truckId: string | null;
    date: Date;
}

/**
 * The next fill on the same truck after `date`, ordered (date asc, createdAt asc).
 * Its stored efficiency was computed as a delta from the log at `excludeId`, so it is
 * the only other row whose inputs change when that log moves or is deleted.
 */
export async function findSuccessorLogId(
    truckId: string,
    date: Date,
    excludeId: string
): Promise<string | null> {
    const successor = await prisma.fuelLog.findFirst({
        where: { truckId, id: { not: excludeId }, date: { gte: date } },
        orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
        select: { id: true },
    });
    return successor?.id ?? null;
}

/**
 * Reconstructs the write-time formula at the log's own point in time.
 *
 * issueFuel compares against Truck.mileage, which is the running maximum across fuel
 * and approved maintenance readings. `baseline` rebuilds exactly that maximum as it
 * stood before this fill — without reading Truck, which this module must not do.
 *
 * A log with no prior reading has no recoverable starting odometer and resolves to
 * null. Callers therefore only invoke this when mileage, liters, or date changed.
 */
export async function recomputeFuelLogEfficiency(logId: string): Promise<void> {
    const log = await prisma.fuelLog.findUnique({
        where: { id: logId },
        select: { id: true, truckId: true, date: true, liters: true, mileage: true },
    });
    if (!log) return;

    // Equipment fills carry no odometer, so km/L is not defined for them.
    if (!log.truckId || log.mileage === null) {
        await prisma.fuelLog.update({ where: { id: log.id }, data: { efficiency: null } });
        return;
    }

    const [priorFuel, priorService] = await Promise.all([
        prisma.fuelLog.aggregate({
            _max: { mileage: true },
            where: { truckId: log.truckId, id: { not: log.id }, date: { lt: log.date } },
        }),
        prisma.maintenanceRecord.aggregate({
            _max: { mileageAtService: true },
            where: { truckId: log.truckId, approvalStatus: 'Approved', date: { lt: log.date } },
        }),
    ]);

    const candidates = [priorFuel._max.mileage, priorService._max.mileageAtService].filter(
        (v): v is number => v !== null && v !== undefined
    );
    const baseline = candidates.length ? Math.max(...candidates) : null;

    const efficiency =
        baseline !== null && log.mileage > baseline && log.liters > 0
            ? (log.mileage - baseline) / log.liters
            : null;

    await prisma.fuelLog.update({ where: { id: log.id }, data: { efficiency } });
}

/**
 * Approach B: recompute the changed log and its immediate successor, nothing else.
 *
 * Takes the log as it stood BEFORE the change, because an edit may move its date (so
 * the successor differs before and after) and a delete leaves nothing to read. Both
 * positions are collected and de-duplicated, so update and delete share one path.
 */
export async function recomputeAfterFuelLogChange(before: FuelLogSnapshot): Promise<void> {
    const affected = new Set<string>();

    if (before.truckId) {
        const oldSuccessor = await findSuccessorLogId(before.truckId, before.date, before.id);
        if (oldSuccessor) affected.add(oldSuccessor);
    }

    const still = await prisma.fuelLog.findUnique({
        where: { id: before.id },
        select: { id: true, truckId: true, date: true },
    });

    if (still) {
        affected.add(still.id);
        if (still.truckId) {
            const newSuccessor = await findSuccessorLogId(still.truckId, still.date, still.id);
            if (newSuccessor) affected.add(newSuccessor);
        }
    }

    for (const id of affected) {
        await recomputeFuelLogEfficiency(id);
    }
}
```

- [ ] **Step 5: Run it and confirm it passes**

Run: `TS_NODE_BASEURL=. npx ts-node --compiler-options '{"module":"CommonJS"}' -r dotenv/config -r tsconfig-paths/register scripts/verify-fuel-edits.ts`
Expected: `PASS - all assertions held`

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no output. If `fuel.ts` errors on a missing helper, the Step 3 import was not added.

- [ ] **Step 7: Commit**

```bash
git add src/lib/fuel-stock.ts src/lib/fuel-metrics.ts src/lib/actions/fuel.ts scripts/verify-fuel-edits.ts
git commit -m "feat: extract fuel stock helpers and add fuel log efficiency recompute"
```

---

### Task 3: Generic edit-request core and the fuel_log applier

**Files:**
- Create: `src/lib/edit-requests/types.ts`
- Create: `src/lib/edit-requests/core.ts`
- Create: `src/lib/edit-requests/fuel-log.ts`
- Create: `src/lib/edit-requests/registry.ts`
- Modify: `scripts/verify-fuel-edits.ts`

**Interfaces:**
- Consumes: `getFuelStockPosition` from `@/lib/fuel-stock`; `recomputeAfterFuelLogChange`, `FuelLogSnapshot` from `@/lib/fuel-metrics`.
- Produces:
  - `EntityApplier`, `EditRequestResult`, `FieldValues` (types)
  - `pickEditable(raw: Record<string, unknown>, fields: readonly string[]): FieldValues`
  - `snapshotOf(entity: FieldValues, fields: readonly string[]): FieldValues`
  - `detectStale(previous: FieldValues, current: FieldValues, fields: readonly string[]): string[]`
  - `findOpenRequest(entityType: string, entityId: string)`
  - `getApplier(entityType: string): EntityApplier | null`
  - `fuelLogApplier: EntityApplier`

- [ ] **Step 1: Write the failing assertions**

Insert into `scripts/verify-fuel-edits.ts` before the final `await cleanup();`:

```ts
    console.log('\nTask 3 - whitelist, snapshot, staleness');
    const applier = getApplier('fuel_log')!;
    check('fuel_log applier registered', applier !== null && applier !== undefined, true);
    check('request gate', applier.requestPermission, 'view_fuel_logs');
    check('approve gate', applier.approvePermission, 'approve_fuel_requests');

    const stripped = pickEditable(
        { liters: 50, cost: 10, mileage: 2100, date: '2026-03-04T00:00:00.000Z',
          truckId: 'hijack', equipmentId: 'hijack', efficiency: 999, id: 'hijack',
          createdAt: 'hijack', updatedAt: 'hijack' },
        applier.editableFields
    );
    check('keeps only whitelisted keys', Object.keys(stripped).sort(), ['cost', 'date', 'liters', 'mileage']);
    check('truckId stripped', 'truckId' in stripped, false);
    check('efficiency stripped', 'efficiency' in stripped, false);
    check('id stripped', 'id' in stripped, false);

    const loaded = (await applier.load(l2.id))!;
    check('load returns whitelisted fields', Object.keys(snapshotOf(loaded, applier.editableFields)).sort(), ['cost', 'date', 'liters', 'mileage']);

    const prev = snapshotOf(loaded, applier.editableFields);
    check('identical snapshot is not stale', detectStale(prev, prev, applier.editableFields), []);
    check('changed liters is stale', detectStale(prev, { ...prev, liters: 999 }, applier.editableFields), ['liters']);

    check('no open request yet', await findOpenRequest('fuel_log', l2.id), null);
    const open = await prisma.editRequest.create({
        data: { entityType: 'fuel_log', entityId: l2.id, requestedBy: TAG, proposedChanges: { liters: 90 } },
    });
    check('open request found', (await findOpenRequest('fuel_log', l2.id))?.id, open.id);
    await prisma.editRequest.update({ where: { id: open.id }, data: { status: 'Rejected' } });
    check('rejected is not open', await findOpenRequest('fuel_log', l2.id), null);
    await prisma.editRequest.delete({ where: { id: open.id } });

    console.log('\nTask 3 - stock guard');
    const { currentStock } = await getFuelStockPosition();
    const raise = await applier.validate!({ liters: loaded.liters as number + currentStock + 10 }, loaded);
    check('raising liters past stock is refused', typeof raise === 'string', true);
    check('lowering liters is allowed', await applier.validate!({ liters: 1 }, loaded), null);
    check('zero liters refused', typeof (await applier.validate!({ liters: 0 }, loaded)) === 'string', true);
    check('cost-only edit allowed', await applier.validate!({ cost: 42 }, loaded), null);
```

Add the imports at the top of the file:

```ts
import { pickEditable, snapshotOf, detectStale, findOpenRequest } from '../src/lib/edit-requests/core';
import { getApplier } from '../src/lib/edit-requests/registry';
import { getFuelStockPosition } from '../src/lib/fuel-stock';
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `TS_NODE_BASEURL=. npx ts-node --compiler-options '{"module":"CommonJS"}' -r dotenv/config -r tsconfig-paths/register scripts/verify-fuel-edits.ts`
Expected: FAIL — cannot resolve `../src/lib/edit-requests/core`.

- [ ] **Step 3: Write the types**

Create `src/lib/edit-requests/types.ts`:

```ts
import type { Permission } from '@/lib/permissions';

export type FieldValues = Record<string, unknown>;

export type EditRequestResult = { success: true } | { error: string };

export type EditOperation = 'update' | 'delete';

/**
 * An EditRequest as it crosses to a client component, after the page's
 * JSON.parse(JSON.stringify(...)) pass. Lives here rather than beside a component so
 * FuelClient and FuelEditRequestsSection can both use it without importing each other.
 */
export interface EditRequestView {
    id: string;
    entityId: string;
    operation: string;
    proposedChanges: FieldValues | null;
    previousValues: FieldValues | null;
    status: string;
    requestedBy: string;
    rejectionReason: string | null;
    createdAt: string;
}

/**
 * Domain semantics for one entityType. The generic core never merges proposed JSON
 * into a Prisma update on its own — it always goes through an applier, whose
 * editableFields whitelist is the only thing standing between a crafted payload and
 * mass assignment.
 */
export interface EntityApplier {
    /** Permission required to submit a request. */
    requestPermission: Permission;
    /** Permission required to approve or reject one, and to bypass the queue entirely. */
    approvePermission: Permission;
    /** The ONLY fields that may be written through this path. */
    editableFields: readonly string[];
    /** Current values, or null if the row is gone. Returns at least every editable field. */
    load(id: string): Promise<FieldValues | null>;
    /** Domain validation at approval time. Returns an error message, or null if fine. */
    validate?(changes: FieldValues, current: FieldValues): Promise<string | null>;
    applyUpdate(id: string, changes: FieldValues): Promise<void>;
    applyDelete(id: string): Promise<void>;
    /** Human-readable label for notification text. */
    describe(entity: FieldValues): string;
    /** Recompute hook, given the entity as it stood BEFORE the change. */
    onApplied?(before: FieldValues, operation: EditOperation, changes: FieldValues): Promise<void>;
}
```

- [ ] **Step 4: Write the generic core**

Create `src/lib/edit-requests/core.ts`:

```ts
// Session-free mechanics shared by every entityType. Deliberately contains no auth()
// call: everything here is directly runnable from scripts/verify-fuel-edits.ts, which
// is the only way this logic can be verified in a repo with no test framework.
import prisma from '@/lib/prisma';
import type { FieldValues } from './types';

/**
 * Strips everything outside the whitelist. Called at REQUEST time, not approval time,
 * so a crafted payload never reaches the database in the first place and the stored
 * proposedChanges is exactly what an approver sees.
 */
export function pickEditable(raw: FieldValues, fields: readonly string[]): FieldValues {
    const out: FieldValues = {};
    for (const field of fields) {
        if (field in raw && raw[field] !== undefined) out[field] = raw[field];
    }
    return out;
}

/** The whitelisted subset of an entity, for previousValues and diffing. */
export function snapshotOf(entity: FieldValues, fields: readonly string[]): FieldValues {
    const out: FieldValues = {};
    for (const field of fields) out[field] = entity[field] ?? null;
    return out;
}

/**
 * Fields that moved between request time and now. Compared through JSON so a Date and
 * the ISO string it round-tripped to are treated as equal — proposedChanges is stored
 * as JSON, so previousValues has already been through that conversion.
 */
export function detectStale(
    previous: FieldValues,
    current: FieldValues,
    fields: readonly string[]
): string[] {
    const stale: string[] = [];
    for (const field of fields) {
        const a = JSON.stringify(previous[field] ?? null);
        const b = JSON.stringify(current[field] ?? null);
        if (a !== b) stale.push(field);
    }
    return stale;
}

/** The open request blocking a second one, or null. Only Pending counts. */
export async function findOpenRequest(entityType: string, entityId: string) {
    return prisma.editRequest.findFirst({
        where: { entityType, entityId, status: 'Pending' },
        orderBy: { createdAt: 'desc' },
    });
}
```

- [ ] **Step 5: Write the fuel_log applier**

Create `src/lib/edit-requests/fuel-log.ts`:

```ts
import prisma from '@/lib/prisma';
import { getFuelStockPosition } from '@/lib/fuel-stock';
import { recomputeAfterFuelLogChange } from '@/lib/fuel-metrics';
import type { EditOperation, EntityApplier, FieldValues } from './types';

// Changing any of these invalidates the stored km/L. A cost-only correction does not,
// and must not trigger a recompute that could null a legitimate figure.
const EFFICIENCY_INPUTS = ['mileage', 'liters', 'date'] as const;

/**
 * proposedChanges round-trips through JSON, so a Date arrives back as an ISO string
 * and a number may arrive as a string from a form. Each applier coerces its own types.
 */
function coerce(changes: FieldValues): FieldValues {
    const out: FieldValues = {};
    if ('date' in changes) out.date = new Date(changes.date as string);
    if ('liters' in changes) out.liters = Number(changes.liters);
    if ('cost' in changes) out.cost = Number(changes.cost);
    if ('mileage' in changes) {
        const raw = changes.mileage;
        out.mileage = raw === null || raw === '' ? null : Number(raw);
    }
    return out;
}

export const fuelLogApplier: EntityApplier = {
    requestPermission: 'view_fuel_logs',
    approvePermission: 'approve_fuel_requests',

    // truckId/equipmentId are absent on purpose: reassigning a log across trucks would
    // need a recompute on two trucks. The fix for a wrong-truck log is delete + re-issue.
    // efficiency is absent because it is derived, never entered.
    editableFields: ['date', 'liters', 'cost', 'mileage'],

    async load(id) {
        const log = await prisma.fuelLog.findUnique({
            where: { id },
            select: {
                id: true, date: true, liters: true, cost: true, mileage: true,
                truckId: true,
                truck: { select: { plateNumber: true } },
                equipment: { select: { name: true } },
            },
        });
        return log as FieldValues | null;
    },

    async validate(changes, current) {
        if (!('liters' in changes)) return null;

        const next = Number(changes.liters);
        if (!Number.isFinite(next) || next <= 0) return 'Litres must be greater than zero';

        const delta = next - Number(current.liters);
        if (delta <= 0) return null; // lowering returns fuel to stock, always fine

        const { currentStock } = await getFuelStockPosition();
        if (delta > currentStock) {
            return currentStock <= 0
                ? 'Cannot increase litres. Current stock is 0 L. Record a deposit first.'
                : `Insufficient fuel stock. Current stock: ${currentStock.toFixed(1)} L, this edit needs a further ${delta.toFixed(1)} L.`;
        }
        return null;
    },

    async applyUpdate(id, changes) {
        await prisma.fuelLog.update({ where: { id }, data: coerce(changes) });
    },

    async applyDelete(id) {
        // FuelRequest.fuelLog is an optional relation with no explicit referential
        // action, so Prisma's default SetNull applies: the request keeps its Approved
        // status with fuelLogId cleared. It WAS approved; rewriting that would be a lie.
        await prisma.fuelLog.delete({ where: { id } });
    },

    describe(entity) {
        const target =
            (entity.truck as { plateNumber?: string } | null)?.plateNumber ??
            (entity.equipment as { name?: string } | null)?.name ??
            'unassigned';
        return `${entity.liters} L to ${target}`;
    },

    async onApplied(before, operation: EditOperation, changes) {
        const touchesEfficiency =
            operation === 'delete' || EFFICIENCY_INPUTS.some((field) => field in changes);
        if (!touchesEfficiency) return;

        await recomputeAfterFuelLogChange({
            id: before.id as string,
            truckId: (before.truckId as string | null) ?? null,
            date: new Date(before.date as string),
        });
    },
};
```

- [ ] **Step 6: Write the registry**

Create `src/lib/edit-requests/registry.ts`:

```ts
import { fuelLogApplier } from './fuel-log';
import type { EntityApplier } from './types';

// Only fuel_log is registered. The maintenance appliers designed in
// 2026-08-31-maintenance-edit-approvals-design.md register here later with no change
// to the core, the actions, or this file's shape.
const APPLIERS: Record<string, EntityApplier> = {
    fuel_log: fuelLogApplier,
};

export function getApplier(entityType: string): EntityApplier | null {
    return APPLIERS[entityType] ?? null;
}

export function registeredEntityTypes(): string[] {
    return Object.keys(APPLIERS);
}
```

- [ ] **Step 7: Run it and confirm it passes**

Run: `TS_NODE_BASEURL=. npx ts-node --compiler-options '{"module":"CommonJS"}' -r dotenv/config -r tsconfig-paths/register scripts/verify-fuel-edits.ts`
Expected: `PASS - all assertions held`

- [ ] **Step 8: Typecheck and commit**

```bash
npx tsc --noEmit -p tsconfig.json
git add src/lib/edit-requests scripts/verify-fuel-edits.ts
git commit -m "feat: add generic edit-request core and fuel_log applier"
```

---

### Task 4: Applying an approved request

**Files:**
- Modify: `src/lib/edit-requests/core.ts`
- Modify: `scripts/verify-fuel-edits.ts`

**Interfaces:**
- Consumes: `getApplier`, `detectStale`, `snapshotOf` from Task 3.
- Produces: `applyApprovedRequest(requestId: string, opts?: { acceptStale?: boolean }): Promise<EditRequestResult>` in `core.ts`.

- [ ] **Step 1: Write the failing assertions**

Insert into `scripts/verify-fuel-edits.ts` before the final `await cleanup();`:

```ts
    console.log('\nTask 4 - applying an approved request');
    await prisma.fuelLog.update({ where: { id: l3.id }, data: { mileage: 2000, liters: 100 } });
    await recomputeFuelLogEfficiency(l3.id);

    // A fourth fill, two positions after l2, to prove the recompute set stops at the
    // immediate successor (approach B) rather than walking the whole chain.
    const l4 = await prisma.fuelLog.create({ data: { truckId: truck.id, date: d(5), liters: 100, cost: 1, mileage: 3000, efficiency: null } });
    await recomputeFuelLogEfficiency(l4.id);
    const l4Frozen = (await prisma.fuelLog.findUnique({ where: { id: l4.id } }))!.efficiency;

    // An update that moves mileage recomputes l2 and its immediate successor l3.
    const upd = await prisma.editRequest.create({
        data: {
            entityType: 'fuel_log', entityId: l2.id, operation: 'update', requestedBy: TAG,
            proposedChanges: { mileage: 1400 },
            previousValues: snapshotOf((await getApplier('fuel_log')!.load(l2.id))!, getApplier('fuel_log')!.editableFields),
        },
    });
    const applied = await applyApprovedRequest(upd.id);
    check('update applies', applied, { success: true });
    check('mileage written', (await prisma.fuelLog.findUnique({ where: { id: l2.id } }))!.mileage, 1400);
    check('l2 efficiency recomputed', (await prisma.fuelLog.findUnique({ where: { id: l2.id } }))!.efficiency, 4);
    check('successor l3 recomputed', (await prisma.fuelLog.findUnique({ where: { id: l3.id } }))!.efficiency, 3);
    check('two fills later stays frozen', (await prisma.fuelLog.findUnique({ where: { id: l4.id } }))!.efficiency, l4Frozen);
    check('request marked Approved', (await prisma.editRequest.findUnique({ where: { id: upd.id } }))!.status, 'Approved');

    // A cost-only edit must not disturb efficiency.
    const before2 = (await prisma.fuelLog.findUnique({ where: { id: l2.id } }))!.efficiency;
    const costOnly = await prisma.editRequest.create({
        data: {
            entityType: 'fuel_log', entityId: l2.id, operation: 'update', requestedBy: TAG,
            proposedChanges: { cost: 777 },
            previousValues: snapshotOf((await getApplier('fuel_log')!.load(l2.id))!, getApplier('fuel_log')!.editableFields),
        },
    });
    await applyApprovedRequest(costOnly.id);
    check('cost written', (await prisma.fuelLog.findUnique({ where: { id: l2.id } }))!.cost, 777);
    check('cost-only leaves efficiency alone', (await prisma.fuelLog.findUnique({ where: { id: l2.id } }))!.efficiency, before2);

    // Staleness blocks by default and is overridable explicitly.
    const staleReq = await prisma.editRequest.create({
        data: {
            entityType: 'fuel_log', entityId: l2.id, operation: 'update', requestedBy: TAG,
            proposedChanges: { cost: 5 },
            previousValues: { date: null, liters: 0, cost: 0, mileage: 0 },
        },
    });
    const blocked = await applyApprovedRequest(staleReq.id);
    check('stale request blocked', 'error' in blocked, true);
    check('stale request still Pending', (await prisma.editRequest.findUnique({ where: { id: staleReq.id } }))!.status, 'Pending');
    check('stale accepted when forced', await applyApprovedRequest(staleReq.id, { acceptStale: true }), { success: true });

    // A delete returns litres to stock and nulls the FuelRequest link.
    const stockBefore = (await getFuelStockPosition()).currentStock;
    const linked = await prisma.fuelRequest.create({
        data: { truckId: truck.id, liters: 100, status: 'Approved', requestedBy: TAG, fuelLogId: l3.id },
    });
    const del = await prisma.editRequest.create({
        data: {
            entityType: 'fuel_log', entityId: l3.id, operation: 'delete', requestedBy: TAG,
            previousValues: snapshotOf((await getApplier('fuel_log')!.load(l3.id))!, getApplier('fuel_log')!.editableFields),
        },
    });
    check('delete applies', await applyApprovedRequest(del.id), { success: true });
    check('log gone', await prisma.fuelLog.findUnique({ where: { id: l3.id } }), null);
    check('litres returned to stock', (await getFuelStockPosition()).currentStock, stockBefore + 100);
    const linkedAfter = (await prisma.fuelRequest.findUnique({ where: { id: linked.id } }))!;
    check('FuelRequest link nulled', linkedAfter.fuelLogId, null);
    check('FuelRequest stays Approved', linkedAfter.status, 'Approved');
    await prisma.fuelRequest.delete({ where: { id: linked.id } });

    // An already-decided request cannot be applied twice.
    check('double-apply refused', 'error' in (await applyApprovedRequest(upd.id)), true);

    check('BOUNDARY: Truck.mileage still untouched', (await prisma.truck.findUnique({ where: { id: truck.id } }))!.mileage, 0);
```

Extend the existing core import line to include `applyApprovedRequest`, and the metrics import to include `recomputeFuelLogEfficiency` if not already present:

```ts
import { pickEditable, snapshotOf, detectStale, findOpenRequest, applyApprovedRequest } from '../src/lib/edit-requests/core';
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `TS_NODE_BASEURL=. npx ts-node --compiler-options '{"module":"CommonJS"}' -r dotenv/config -r tsconfig-paths/register scripts/verify-fuel-edits.ts`
Expected: FAIL — `applyApprovedRequest` is not exported.

- [ ] **Step 3: Implement it**

Append to `src/lib/edit-requests/core.ts` (and extend the imports at the top of that file):

```ts
import { getApplier } from './registry';
import type { EditOperation, EditRequestResult, FieldValues } from './types';
```

```ts
/**
 * Runs an approved request against the live row. Session-free on purpose — the caller
 * has already established that the actor holds the applier's approvePermission.
 *
 * Order matters: snapshot BEFORE the write, because the recompute hook needs the old
 * date and truckId to find the successor whose efficiency depended on this row.
 */
export async function applyApprovedRequest(
    requestId: string,
    opts?: { acceptStale?: boolean }
): Promise<EditRequestResult> {
    const request = await prisma.editRequest.findUnique({ where: { id: requestId } });
    if (!request) return { error: 'Edit request not found' };
    if (request.status !== 'Pending') {
        return { error: `This request has already been ${request.status.toLowerCase()}` };
    }

    const applier = getApplier(request.entityType);
    if (!applier) return { error: `No applier registered for ${request.entityType}` };

    const current = await applier.load(request.entityId);
    if (!current) return { error: 'The record this request targets no longer exists' };

    const before = { ...current };
    const operation = request.operation as EditOperation;
    const changes = (request.proposedChanges ?? {}) as FieldValues;

    if (request.previousValues) {
        const stale = detectStale(
            request.previousValues as FieldValues,
            snapshotOf(current, applier.editableFields),
            applier.editableFields
        );
        if (stale.length && !opts?.acceptStale) {
            return {
                error: `This record changed since the request was made (${stale.join(', ')}). Review the current values and confirm.`,
            };
        }
    }

    if (operation === 'update') {
        if (Object.keys(changes).length === 0) return { error: 'This request proposes no changes' };
        if (applier.validate) {
            const problem = await applier.validate(changes, current);
            if (problem) return { error: problem };
        }
        await applier.applyUpdate(request.entityId, changes);
    } else {
        await applier.applyDelete(request.entityId);
    }

    // After the write, so a delete's recompute sees the row already gone.
    if (applier.onApplied) await applier.onApplied(before, operation, changes);

    await prisma.editRequest.update({
        where: { id: request.id },
        data: { status: 'Approved', approvedAt: new Date() },
    });

    return { success: true };
}
```

- [ ] **Step 4: Run it and confirm it passes**

Run: `TS_NODE_BASEURL=. npx ts-node --compiler-options '{"module":"CommonJS"}' -r dotenv/config -r tsconfig-paths/register scripts/verify-fuel-edits.ts`
Expected: `PASS - all assertions held`

- [ ] **Step 5: Typecheck and commit**

```bash
npx tsc --noEmit -p tsconfig.json
git add src/lib/edit-requests/core.ts scripts/verify-fuel-edits.ts
git commit -m "feat: apply approved edit requests with staleness and validation guards"
```

---

### Task 5: Server actions and fuel entry points

**Files:**
- Create: `src/lib/actions/edit-requests.ts`
- Modify: `src/lib/actions/fuel.ts`

**Interfaces:**
- Consumes: everything from Tasks 3–4.
- Produces:
  - `createEditRequest(entityType, entityId, operation, rawChanges, reason?): Promise<EditRequestResult>`
  - `approveEditRequest(id, opts?): Promise<EditRequestResult>`
  - `rejectEditRequest(id, reason): Promise<EditRequestResult>`
  - `getEditRequestsFor(entityType, entityId)`
  - `getPendingEditRequests(entityType?)`
  - In `fuel.ts`: `requestFuelLogEdit(id, formData)`, `requestFuelLogDelete(id, reason)`, `getFuelLogEditRequests()`

- [ ] **Step 1: Write the actions**

Create `src/lib/actions/edit-requests.ts`:

```ts
'use server'

import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'
import { auth } from '@/auth'
import { hasPermission } from '@/lib/permissions'
import { findOpenRequest, pickEditable, snapshotOf, applyApprovedRequest } from '@/lib/edit-requests/core'
import { getApplier } from '@/lib/edit-requests/registry'
import type { EditOperation, EditRequestResult, FieldValues } from '@/lib/edit-requests/types'

// A 'use server' module may only export async functions. All shared logic lives in
// src/lib/edit-requests/, which the verification script imports directly.

/**
 * Submits a proposed change. The whitelist is applied HERE, at request time, so a
 * crafted payload never reaches the database and the stored proposedChanges is exactly
 * what an approver will see.
 *
 * Callers holding the approve permission never reach this - fuel.ts applies directly.
 */
export async function createEditRequest(
    entityType: string,
    entityId: string,
    operation: EditOperation,
    rawChanges: FieldValues,
    reason?: string
): Promise<EditRequestResult> {
    const session = await auth()
    const role = session?.user?.role
    if (!role) return { error: 'Unauthorized' }

    const applier = getApplier(entityType)
    if (!applier) return { error: 'Unknown record type' }
    if (!hasPermission(role, applier.requestPermission)) return { error: 'Unauthorized' }

    const current = await applier.load(entityId)
    if (!current) return { error: 'Record not found' }

    const open = await findOpenRequest(entityType, entityId)
    if (open) {
        return { error: `${open.requestedBy} already has a change awaiting approval on this record.` }
    }

    const changes = pickEditable(rawChanges, applier.editableFields)
    if (operation === 'update' && Object.keys(changes).length === 0) {
        return { error: 'No editable fields were changed' }
    }
    if (operation === 'delete' && !reason?.trim()) {
        return { error: 'A reason is required to request deletion' }
    }

    await prisma.editRequest.create({
        data: {
            entityType,
            entityId,
            operation,
            proposedChanges: operation === 'update' ? (changes as object) : undefined,
            previousValues: snapshotOf(current, applier.editableFields) as object,
            rejectionReason: operation === 'delete' ? reason!.trim() : undefined,
            requestedBy: session.user.name || session.user.email || role,
            requestedById: session.user.id ?? undefined,
        },
    })

    revalidatePath('/fuel')
    return { success: true }
}

export async function approveEditRequest(
    id: string,
    opts?: { acceptStale?: boolean }
): Promise<EditRequestResult> {
    const session = await auth()
    const role = session?.user?.role
    if (!role) return { error: 'Unauthorized' }

    const request = await prisma.editRequest.findUnique({ where: { id } })
    if (!request) return { error: 'Edit request not found' }

    const applier = getApplier(request.entityType)
    if (!applier) return { error: 'Unknown record type' }
    if (!hasPermission(role, applier.approvePermission)) return { error: 'Unauthorized' }

    const result = await applyApprovedRequest(id, opts)
    if ('error' in result) return result

    await prisma.editRequest.update({
        where: { id },
        data: { approvedBy: session.user.name || session.user.email || role },
    })

    revalidatePath('/fuel')
    return { success: true }
}

export async function rejectEditRequest(id: string, reason: string): Promise<EditRequestResult> {
    const session = await auth()
    const role = session?.user?.role
    if (!role) return { error: 'Unauthorized' }
    if (!reason?.trim()) return { error: 'A reason is required' }

    const request = await prisma.editRequest.findUnique({ where: { id } })
    if (!request) return { error: 'Edit request not found' }
    if (request.status !== 'Pending') {
        return { error: `This request has already been ${request.status.toLowerCase()}` }
    }

    const applier = getApplier(request.entityType)
    if (!applier) return { error: 'Unknown record type' }
    if (!hasPermission(role, applier.approvePermission)) return { error: 'Unauthorized' }

    // The live record is deliberately untouched. Rejected rows stay for audit.
    await prisma.editRequest.update({
        where: { id },
        data: {
            status: 'Rejected',
            rejectionReason: reason.trim(),
            approvedBy: session.user.name || session.user.email || role,
            approvedAt: new Date(),
        },
    })

    revalidatePath('/fuel')
    return { success: true }
}

export async function getEditRequestsFor(entityType: string, entityId: string) {
    const session = await auth()
    if (!session?.user?.role) return []
    const applier = getApplier(entityType)
    if (!applier || !hasPermission(session.user.role, applier.requestPermission)) return []

    return prisma.editRequest.findMany({
        where: { entityType, entityId },
        orderBy: { createdAt: 'desc' },
    })
}

/**
 * Pending requests the caller may act on. Approvers see everything; a requester sees
 * only their own, so they can tell a submitted change from a landed one.
 */
export async function getPendingEditRequests(entityType?: string) {
    const session = await auth()
    const role = session?.user?.role
    if (!role) return []

    const applier = entityType ? getApplier(entityType) : null
    if (entityType && !applier) return []

    const canApprove = applier ? hasPermission(role, applier.approvePermission) : false
    if (applier && !canApprove && !hasPermission(role, applier.requestPermission)) return []

    return prisma.editRequest.findMany({
        where: {
            status: 'Pending',
            ...(entityType ? { entityType } : {}),
            ...(canApprove ? {} : { requestedById: session.user.id ?? '__none__' }),
        },
        orderBy: { createdAt: 'desc' },
    })
}
```

- [ ] **Step 2: Add the fuel entry points**

Append to `src/lib/actions/fuel.ts`, and add these imports at the top:

```ts
import { createEditRequest } from '@/lib/actions/edit-requests'
import { applyApprovedRequest } from '@/lib/edit-requests/core'
import { fuelLogApplier } from '@/lib/edit-requests/fuel-log'
import { getPendingEditRequests } from '@/lib/actions/edit-requests'
```

```ts
/**
 * Proposes an edit to a fuel log. Mirrors createFuelRequest: an approver skips the
 * queue and the change lands immediately; everyone else with page access submits a
 * request that waits. The check is on the permission, never the role name.
 */
export async function requestFuelLogEdit(
    id: string,
    formData: FormData
): Promise<{ success: true; applied: boolean } | { error: string }> {
    const session = await auth()
    const role = session?.user?.role
    if (!role) return { error: 'Unauthorized' }
    if (!hasPermission(role, 'view_fuel_logs')) return { error: 'Unauthorized' }

    const raw: Record<string, unknown> = {}
    for (const field of fuelLogApplier.editableFields) {
        const value = formData.get(field)
        if (value !== null && value !== '') raw[field] = value
    }

    if (!hasPermission(role, 'approve_fuel_requests')) {
        const result = await createEditRequest('fuel_log', id, 'update', raw)
        if ('error' in result) return result
        revalidatePath('/fuel')
        return { success: true, applied: false }
    }

    // Approver path: create the request already decided, so the audit trail is
    // identical whether a change was queued or applied directly.
    const current = await fuelLogApplier.load(id)
    if (!current) return { error: 'Fuel log not found' }

    const { pickEditable, snapshotOf } = await import('@/lib/edit-requests/core')
    const changes = pickEditable(raw, fuelLogApplier.editableFields)
    if (Object.keys(changes).length === 0) return { error: 'No editable fields were changed' }

    const request = await prisma.editRequest.create({
        data: {
            entityType: 'fuel_log',
            entityId: id,
            operation: 'update',
            proposedChanges: changes as object,
            previousValues: snapshotOf(current, fuelLogApplier.editableFields) as object,
            requestedBy: session.user.name || session.user.email || role,
            requestedById: session.user.id ?? undefined,
        },
    })

    const applied = await applyApprovedRequest(request.id, { acceptStale: true })
    if ('error' in applied) {
        await prisma.editRequest.delete({ where: { id: request.id } })
        return applied
    }
    await prisma.editRequest.update({
        where: { id: request.id },
        data: { approvedBy: session.user.name || session.user.email || role },
    })

    revalidatePath('/fuel')
    return { success: true, applied: true }
}

/** Proposes deletion of a fuel log. Same approver split as requestFuelLogEdit. */
export async function requestFuelLogDelete(
    id: string,
    reason: string
): Promise<{ success: true; applied: boolean } | { error: string }> {
    const session = await auth()
    const role = session?.user?.role
    if (!role) return { error: 'Unauthorized' }
    if (!hasPermission(role, 'view_fuel_logs')) return { error: 'Unauthorized' }
    if (!reason?.trim()) return { error: 'A reason is required to delete a fuel log' }

    if (!hasPermission(role, 'approve_fuel_requests')) {
        const result = await createEditRequest('fuel_log', id, 'delete', {}, reason)
        if ('error' in result) return result
        revalidatePath('/fuel')
        return { success: true, applied: false }
    }

    const current = await fuelLogApplier.load(id)
    if (!current) return { error: 'Fuel log not found' }

    const { snapshotOf } = await import('@/lib/edit-requests/core')
    const request = await prisma.editRequest.create({
        data: {
            entityType: 'fuel_log',
            entityId: id,
            operation: 'delete',
            previousValues: snapshotOf(current, fuelLogApplier.editableFields) as object,
            rejectionReason: reason.trim(),
            requestedBy: session.user.name || session.user.email || role,
            requestedById: session.user.id ?? undefined,
        },
    })

    const applied = await applyApprovedRequest(request.id, { acceptStale: true })
    if ('error' in applied) {
        await prisma.editRequest.delete({ where: { id: request.id } })
        return applied
    }
    await prisma.editRequest.update({
        where: { id: request.id },
        data: { approvedBy: session.user.name || session.user.email || role },
    })

    revalidatePath('/fuel')
    return { success: true, applied: true }
}

/** Pending fuel log edit requests, scoped by getPendingEditRequests' own visibility rules. */
export async function getFuelLogEditRequests() {
    return getPendingEditRequests('fuel_log')
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no output.

- [ ] **Step 4: Re-run verification (regression check)**

Run: `TS_NODE_BASEURL=. npx ts-node --compiler-options '{"module":"CommonJS"}' -r dotenv/config -r tsconfig-paths/register scripts/verify-fuel-edits.ts`
Expected: `PASS - all assertions held`

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/edit-requests.ts src/lib/actions/fuel.ts
git commit -m "feat: add edit-request server actions and fuel log entry points"
```

---

### Task 6: Notifications

**Files:**
- Modify: `src/lib/actions/notifications.ts`
- Modify: `src/lib/actions/edit-requests.ts`

**Interfaces:**
- Consumes: `notifyApprovers`, `notifyRequester` from `notifications.ts`.
- Produces: notification types `fuel_edit_pending`, `fuel_edit_approved`, `fuel_edit_rejected`.

- [ ] **Step 1: Add the notification types**

In `src/lib/actions/notifications.ts`, add to the `NotificationType` union (beside the `maintenance_*` members near line 32):

```ts
    | 'fuel_edit_pending'
    | 'fuel_edit_approved'
    | 'fuel_edit_rejected'
```

Add to `NOTIFICATION_CONFIG`, beside the existing fuel entries:

```ts
    fuel_edit_pending: { defaultPriority: 'high', requiredPermissions: ['approve_fuel_requests'] },
    fuel_edit_approved: { defaultPriority: 'medium' },
    fuel_edit_rejected: { defaultPriority: 'medium' },
```

Widen the `notifyApprovers` parameter union (currently five literals at line 487):

```ts
export async function notifyApprovers(
    type:
        | 'new_inventory_item'
        | 'stock_transaction_pending'
        | 'material_request_pending'
        | 'maintenance_approval_pending'
        | 'fuel_request_pending'
        | 'fuel_edit_pending',
    title: string,
    message: string,
    entityType: string,
    entityId: string
) {
```

- [ ] **Step 2: Wire the triggers**

In `src/lib/actions/edit-requests.ts`, add the import:

```ts
import { notifyApprovers, notifyRequester } from '@/lib/actions/notifications'
```

In `createEditRequest`, after the `prisma.editRequest.create(...)` call, capture the created row and notify:

```ts
    const created = await prisma.editRequest.create({ /* ...unchanged data... */ })

    const label = applier.describe(current)
    await notifyApprovers(
        'fuel_edit_pending',
        operation === 'delete' ? 'Fuel log deletion requested' : 'Fuel log edit requested',
        `${created.requestedBy} requested ${operation === 'delete' ? 'deletion of' : 'a change to'} ${label}.`,
        'edit_request',
        created.id
    )
```

In `approveEditRequest`, after the successful `prisma.editRequest.update(...)`:

```ts
    if (request.requestedById) {
        await notifyRequester(
            request.requestedById,
            'fuel_edit_approved',
            'Fuel log change approved',
            `Your ${request.operation === 'delete' ? 'deletion' : 'edit'} request was approved.`,
            'edit_request',
            request.id
        )
    }
```

In `rejectEditRequest`, after its `prisma.editRequest.update(...)`:

```ts
    if (request.requestedById) {
        await notifyRequester(
            request.requestedById,
            'fuel_edit_rejected',
            'Fuel log change rejected',
            `Your ${request.operation === 'delete' ? 'deletion' : 'edit'} request was rejected: ${reason.trim()}`,
            'edit_request',
            request.id
        )
    }
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no output. A `NOTIFICATION_CONFIG` error means a type was added to the union but not the config map — both are required.

- [ ] **Step 4: Commit**

```bash
git add src/lib/actions/notifications.ts src/lib/actions/edit-requests.ts
git commit -m "feat: notify approvers and requesters on fuel log edit decisions"
```

---

### Task 7: Unified approvals queue

**Files:**
- Modify: `src/lib/actions/approvals.ts`

**Interfaces:**
- Consumes: `prisma.editRequest`.
- Produces: `'fuel_log_edit'` added to `PendingApprovalKind`.

- [ ] **Step 1: Add the kind**

In `src/lib/actions/approvals.ts`, extend the exported union:

```ts
export type PendingApprovalKind =
    | 'inventory_item'
    | 'stock_transaction'
    | 'material_request'
    | 'maintenance_record'
    | 'maintenance_schedule'
    | 'fuel_request'
    | 'fuel_log_edit'
```

- [ ] **Step 2: Add the query**

Add a seventh element to the `Promise.all([...])` array, following the existing gated shape:

```ts
        can('approve_fuel_requests')
            ? prisma.editRequest.findMany({
                  where: { entityType: 'fuel_log', status: 'Pending' },
                  orderBy: { createdAt: 'desc' },
              })
            : [],
```

Destructure it as `fuelLogEdits`, and map it into `entries` alongside the existing sources:

```ts
    for (const edit of fuelLogEdits) {
        const previous = (edit.previousValues ?? {}) as { liters?: number }
        entries.push({
            id: edit.id,
            kind: 'fuel_log_edit',
            module: 'Fuel',
            title: edit.operation === 'delete' ? 'Fuel log deletion' : 'Fuel log edit',
            detail: `${previous.liters ?? '?'} L record — ${edit.operation === 'delete' ? 'deletion' : 'change'} awaiting approval`,
            requestedBy: edit.requestedBy,
            createdAt: edit.createdAt,
            href: '/fuel',
        })
    }
```

Match the surrounding code's existing style for building `entries` and `counts`; do not restructure it.

- [ ] **Step 3: Typecheck and commit**

```bash
npx tsc --noEmit -p tsconfig.json
git add src/lib/actions/approvals.ts
git commit -m "feat: surface pending fuel log edits in the unified approvals queue"
```

---

### Task 8: Edit modal and fuel log row actions

**Files:**
- Create: `src/components/fuel/EditFuelLogModal.tsx`
- Modify: `src/components/fuel/FuelClient.tsx`
- Modify: `src/app/(main)/fuel/page.tsx`

**Interfaces:**
- Consumes: `requestFuelLogEdit`, `requestFuelLogDelete`, `getFuelLogEditRequests` from `fuel.ts`.
- Produces: `EditFuelLogModal` default export; `FuelClient` props `canRequestFuelLogEdit: boolean` and `pendingEditLogIds: string[]`.

- [ ] **Step 1: Create the modal**

Create `src/components/fuel/EditFuelLogModal.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Loader2, X } from 'lucide-react'
import { requestFuelLogEdit, requestFuelLogDelete } from '@/lib/actions/fuel'

interface EditableLog {
    id: string
    date: Date | string
    liters: number
    cost: number
    mileage: number | null
    truck: { plateNumber: string } | null
    equipment: { name: string } | null
}

export default function EditFuelLogModal({
    log,
    mode,
    canApprove,
    onClose,
}: {
    log: EditableLog
    mode: 'edit' | 'delete'
    /** Drives the button copy only. The server re-checks the permission. */
    canApprove: boolean
    onClose: () => void
}) {
    const router = useRouter()
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [reason, setReason] = useState('')

    const target = log.truck?.plateNumber ?? log.equipment?.name ?? 'unassigned'
    const isTruck = Boolean(log.truck)

    const handleEdit = async (formData: FormData) => {
        setIsSubmitting(true)
        setError(null)
        const result = await requestFuelLogEdit(log.id, formData)
        setIsSubmitting(false)
        if ('error' in result) return setError(result.error)
        onClose()
        router.refresh()
    }

    const handleDelete = async () => {
        if (!reason.trim()) return setError('A reason is required')
        setIsSubmitting(true)
        setError(null)
        const result = await requestFuelLogDelete(log.id, reason.trim())
        setIsSubmitting(false)
        if ('error' in result) return setError(result.error)
        onClose()
        router.refresh()
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
                <div className="flex items-start justify-between p-6 pb-0">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">
                            {mode === 'delete' ? 'Delete fuel log' : 'Edit fuel log'}
                        </h2>
                        <p className="text-sm text-gray-600 mt-1">
                            {log.liters} L issued to {target}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6">
                    {!canApprove && (
                        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl text-sm mb-4 flex gap-2">
                            <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                            <span>
                                This will be submitted for approval. The record keeps its current values until
                                an approver signs off.
                            </span>
                        </div>
                    )}

                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm mb-4">
                            {error}
                        </div>
                    )}

                    {mode === 'edit' ? (
                        <form action={handleEdit} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">Date</label>
                                <input
                                    type="date"
                                    name="date"
                                    defaultValue={new Date(log.date).toISOString().split('T')[0]}
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-blue-500 outline-none transition-all"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700">Litres</label>
                                    <input
                                        type="number" step="0.01" name="liters" defaultValue={log.liters}
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-blue-500 outline-none transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700">Cost</label>
                                    <input
                                        type="number" step="0.01" name="cost" defaultValue={log.cost}
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-blue-500 outline-none transition-all"
                                    />
                                </div>
                            </div>
                            {isTruck && (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700">Odometer (km)</label>
                                    <input
                                        type="number" name="mileage" defaultValue={log.mileage ?? ''}
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-blue-500 outline-none transition-all"
                                    />
                                    <p className="text-xs text-gray-500">
                                        Corrects this log&apos;s km/L and the next fill&apos;s. It does not change the
                                        truck&apos;s recorded odometer.
                                    </p>
                                </div>
                            )}
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full px-5 py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isSubmitting && <Loader2 className="animate-spin" size={18} />}
                                {canApprove ? 'Save changes' : 'Submit for Approval'}
                            </button>
                        </form>
                    ) : (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">
                                    Reason <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    rows={3}
                                    placeholder="Why should this record be removed?"
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-blue-500 outline-none transition-all"
                                />
                            </div>
                            <p className="text-sm text-gray-600">
                                Deleting returns {log.liters} L to stock and removes its cost from reports.
                            </p>
                            <button
                                type="button"
                                onClick={handleDelete}
                                disabled={isSubmitting}
                                className="w-full px-5 py-2.5 bg-red-600 text-white font-medium rounded-xl hover:bg-red-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isSubmitting && <Loader2 className="animate-spin" size={18} />}
                                {canApprove ? 'Delete record' : 'Submit for Approval'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
```

- [ ] **Step 2: Wire the page**

In `src/app/(main)/fuel/page.tsx`, add `getFuelLogEditRequests` to the existing `fuel` import, add it to the `Promise.all`, compute the gate, and pass both new props:

```tsx
    const [logs, deposits, trucks, equipment, requests, editRequests, session] = await Promise.all([
        getFuelLogs(),
        getFuelDeposits(),
        getTrucks(),
        getEquipment(),
        getFuelRequests(),
        getFuelLogEditRequests(),
        auth()
    ]);

    const canRequestFuelLogEdit = session?.user?.role
        ? hasPermission(session.user.role, 'view_fuel_logs')
        : false;
```

```tsx
            canRequestFuelLogEdit={canRequestFuelLogEdit}
            pendingEditLogIds={editRequests.map((r) => r.entityId)}
            editRequests={JSON.parse(JSON.stringify(editRequests))}
```

- [ ] **Step 3: Add the row actions**

In `src/components/fuel/FuelClient.tsx`:

Add to `FuelClientProps`:

```ts
    canRequestFuelLogEdit: boolean
    pendingEditLogIds: string[]
    editRequests: EditRequestView[]
```

Destructure them in the component signature, import the modal, the shared view type and the `Pencil` / `Trash2` icons, and add state:

```tsx
import EditFuelLogModal from './EditFuelLogModal'
import type { EditRequestView } from '@/lib/edit-requests/types'
// add Pencil, Trash2 to the existing lucide-react import
const [editing, setEditing] = useState<{ log: FuelLog; mode: 'edit' | 'delete' } | null>(null)
const pendingEdits = new Set(pendingEditLogIds)
```

Add a sixth header cell to the log table's `<thead>` row:

```tsx
                                            <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
```

Change the empty-state `colSpan={5}` to `colSpan={6}`.

Add a final `<td>` to each log row, after the efficiency cell:

```tsx
                                                    <td className="px-6 py-4 whitespace-nowrap text-right">
                                                        {!canRequestFuelLogEdit ? null : pendingEdits.has(log.id) ? (
                                                            <span className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20">
                                                                Edit pending approval
                                                            </span>
                                                        ) : (
                                                            <div className="flex items-center justify-end gap-1">
                                                                <button
                                                                    onClick={() => setEditing({ log, mode: 'edit' })}
                                                                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                                    title="Edit this log"
                                                                >
                                                                    <Pencil size={16} />
                                                                </button>
                                                                <button
                                                                    onClick={() => setEditing({ log, mode: 'delete' })}
                                                                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                                    title="Delete this log"
                                                                >
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            </div>
                                                        )}
                                                    </td>
```

Render the modal just before the component's closing fragment:

```tsx
            {editing && (
                <EditFuelLogModal
                    log={editing.log}
                    mode={editing.mode}
                    canApprove={canApproveFuelRequests}
                    onClose={() => setEditing(null)}
                />
            )}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no output. `EditRequestView` comes from `@/lib/edit-requests/types`, created in Task 3 — nothing here depends on Task 9.

- [ ] **Step 5: Commit**

```bash
git add src/components/fuel/EditFuelLogModal.tsx src/components/fuel/FuelClient.tsx "src/app/(main)/fuel/page.tsx"
git commit -m "feat: add fuel log edit and delete actions to the issuance table"
```

---

### Task 9: Approver diff view

**Files:**
- Create: `src/components/fuel/FuelEditRequestsSection.tsx`
- Modify: `src/components/fuel/FuelRequestsTab.tsx`

**Interfaces:**
- Consumes: `approveEditRequest`, `rejectEditRequest` from `@/lib/actions/edit-requests`; `EditRequestView` from `@/lib/edit-requests/types` (Task 3).
- Produces: `FuelEditRequestsSection` default export.

- [ ] **Step 1: Create the section**

Create `src/components/fuel/FuelEditRequestsSection.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2, PencilLine, Trash2, X } from 'lucide-react'
import { approveEditRequest, rejectEditRequest } from '@/lib/actions/edit-requests'
import type { EditRequestView } from '@/lib/edit-requests/types'

const LABELS: Record<string, string> = {
    date: 'Date',
    liters: 'Litres',
    cost: 'Cost',
    mileage: 'Odometer',
}

function render(field: string, value: unknown): string {
    if (value === null || value === undefined) return '—'
    if (field === 'date') return new Date(value as string).toLocaleDateString()
    return String(value)
}

export default function FuelEditRequestsSection({
    requests,
    canApprove,
}: {
    requests: EditRequestView[]
    canApprove: boolean
}) {
    const router = useRouter()
    const [busyId, setBusyId] = useState<string | null>(null)
    const [rejecting, setRejecting] = useState<string | null>(null)
    const [reason, setReason] = useState('')
    const [error, setError] = useState<string | null>(null)

    const pending = requests.filter((r) => r.status === 'Pending')
    if (pending.length === 0) return null

    const act = async (id: string, run: () => Promise<{ success: true } | { error: string }>) => {
        setBusyId(id)
        setError(null)
        const result = await run()
        setBusyId(null)
        if ('error' in result) return setError(result.error)
        setRejecting(null)
        setReason('')
        router.refresh()
    }

    return (
        <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center gap-2">
                <PencilLine size={18} className="text-amber-600" />
                <h3 className="text-lg font-semibold text-gray-900">
                    Fuel Log Changes Awaiting Approval
                </h3>
                <span className="ml-1 text-sm text-gray-400 tabular-nums">{pending.length}</span>
            </div>

            {error && (
                <div className="mx-6 mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                    {error}
                </div>
            )}

            <div className="divide-y divide-gray-100">
                {pending.map((request) => {
                    const previous = request.previousValues ?? {}
                    const proposed = request.proposedChanges ?? {}
                    const isDelete = request.operation === 'delete'

                    return (
                        <div key={request.id} className="p-6 space-y-4">
                            <div className="flex items-center gap-2 text-sm">
                                {isDelete && <Trash2 size={16} className="text-red-600" />}
                                <span className="font-medium text-gray-900">
                                    {isDelete ? 'Deletion requested' : 'Change requested'}
                                </span>
                                <span className="text-gray-500">
                                    by {request.requestedBy} • {new Date(request.createdAt).toLocaleDateString()}
                                </span>
                            </div>

                            {isDelete ? (
                                <div className="bg-red-50/50 border border-red-100 rounded-xl p-4 space-y-2">
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                        {Object.keys(LABELS).map((field) => (
                                            <div key={field}>
                                                <span className="text-gray-500">{LABELS[field]}: </span>
                                                <span className="text-gray-900 font-medium">
                                                    {render(field, previous[field])}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                    {request.rejectionReason && (
                                        <p className="text-sm text-gray-700 pt-2 border-t border-red-100">
                                            <span className="text-gray-500">Reason: </span>
                                            {request.rejectionReason}
                                        </p>
                                    )}
                                </div>
                            ) : (
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-xs uppercase tracking-wider text-gray-500">
                                            <th className="text-left pb-2 font-semibold">Field</th>
                                            <th className="text-left pb-2 font-semibold">Current</th>
                                            <th className="text-left pb-2 font-semibold">Proposed</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {Object.keys(proposed).map((field) => (
                                            <tr key={field}>
                                                <td className="py-2 text-gray-500">{LABELS[field] ?? field}</td>
                                                <td className="py-2 text-gray-900">{render(field, previous[field])}</td>
                                                <td className="py-2 font-medium text-blue-700">
                                                    {render(field, proposed[field])}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}

                            {canApprove && (
                                rejecting === request.id ? (
                                    <div className="space-y-2">
                                        <textarea
                                            value={reason}
                                            onChange={(e) => setReason(e.target.value)}
                                            rows={2}
                                            placeholder="Reason for rejection (required)"
                                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-blue-500 outline-none text-sm"
                                        />
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => act(request.id, () => rejectEditRequest(request.id, reason))}
                                                disabled={busyId === request.id || !reason.trim()}
                                                className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-xl hover:bg-red-700 disabled:opacity-50"
                                            >
                                                Confirm rejection
                                            </button>
                                            <button
                                                onClick={() => { setRejecting(null); setReason('') }}
                                                className="px-4 py-2 border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => act(request.id, () => approveEditRequest(request.id))}
                                            disabled={busyId === request.id}
                                            className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2"
                                        >
                                            {busyId === request.id ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
                                            Approve
                                        </button>
                                        <button
                                            onClick={() => setRejecting(request.id)}
                                            disabled={busyId === request.id}
                                            className="px-4 py-2 border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2"
                                        >
                                            <X size={16} />
                                            Reject
                                        </button>
                                    </div>
                                )
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
```

**Staleness note for the implementer:** `approveEditRequest` returns an error string beginning "This record changed since the request was made" when the live row moved. That message surfaces in the `error` banner above. Re-calling with `{ acceptStale: true }` is the confirm path — add a "Approve anyway" button that appears only after that specific error, calling `approveEditRequest(request.id, { acceptStale: true })`.

- [ ] **Step 2: Render it in the Requests tab**

In `src/components/fuel/FuelRequestsTab.tsx`, add to the imports and the prop list:

```tsx
import FuelEditRequestsSection from './FuelEditRequestsSection'
import type { EditRequestView } from '@/lib/edit-requests/types'
```

```tsx
export default function FuelRequestsTab({
    requests,
    canApprove,
    currentUserId,
    editRequests,
}: {
    requests: FuelRequest[]
    canApprove: boolean
    /** Used to decide whose pending requests can be withdrawn. */
    currentUserId: string | null
    editRequests: EditRequestView[]
}) {
```

Render it as the first child of the outer `<div className="space-y-5">`, above the filter pills:

```tsx
            <FuelEditRequestsSection requests={editRequests} canApprove={canApprove} />
```

In `FuelClient.tsx`, pass it through and re-export the type used in Task 8:

```tsx
                <FuelRequestsTab
                    requests={requests}
                    canApprove={canApproveFuelRequests}
                    currentUserId={currentUserId}
                    editRequests={editRequests}
                />
```

`FuelClient` already imports `EditRequestView` from Task 8, so no further import is needed there.

- [ ] **Step 3: Typecheck and commit**

```bash
npx tsc --noEmit -p tsconfig.json
git add src/components/fuel/FuelEditRequestsSection.tsx src/components/fuel/FuelRequestsTab.tsx src/components/fuel/FuelClient.tsx
git commit -m "feat: add approver diff view for fuel log edit requests"
```

---

### Task 10: RBAC assertions and full verification

**Files:**
- Modify: `scripts/verify-rbac.ts`
- Modify: `scripts/verify-fuel-edits.ts`

**Interfaces:**
- Consumes: everything.
- Produces: a green verification run and a completed manual checklist.

- [ ] **Step 1: Add the RBAC assertions**

In `scripts/verify-rbac.ts`, inside `main()`, after the existing "Phase 3" block:

```ts
    console.log('\nFuel log edits - request is open to page holders, approval is not');
    for (const role of ROLES) {
        // All four built-in roles can reach the fuel page, so all four may request.
        check(`view_fuel_logs / ${role}`, hasPermission(role, 'view_fuel_logs'), true);
        // Approving is Super Admin only until delegated from Settings > Roles.
        check(`approve_fuel_requests / ${role}`, hasPermission(role, 'approve_fuel_requests'), role === 'Super Admin');
    }
    // The feature must not have invented a permission; the spec reuses two existing ones.
    check(
        'Super Admin permission count unchanged by this feature',
        ROLE_PERMISSIONS[Role.SUPER_ADMIN].some((p) => p.startsWith('edit_request') || p.includes('fuel_log')),
        false
    );
```

- [ ] **Step 2: Add the boundary regression guard**

Append to `scripts/verify-fuel-edits.ts`, before the final `await cleanup();`:

```ts
    console.log('\nTask 10 - odometer boundary');
    // No path in this feature may write Truck.mileage. The truck was created with 0 and
    // every preceding assertion has run against it; if anything moved it, this fails.
    check('Truck.mileage never written by this feature', (await prisma.truck.findUnique({ where: { id: truck.id } }))!.mileage, 0);

    const fs = await import('fs');
    const forbidden = ['src/lib/fuel-metrics.ts', 'src/lib/edit-requests/fuel-log.ts', 'src/lib/edit-requests/core.ts'];
    for (const file of forbidden) {
        const source = fs.readFileSync(file, 'utf8');
        check(`${file} does not write truck`, /prisma\.truck\.update/.test(source), false);
    }
```

- [ ] **Step 3: Run both verification scripts**

```bash
TS_NODE_BASEURL=. npx ts-node --compiler-options '{"module":"CommonJS"}' -r dotenv/config -r tsconfig-paths/register scripts/verify-fuel-edits.ts
TS_NODE_BASEURL=. npx ts-node --compiler-options '{"module":"CommonJS"}' -r dotenv/config -r tsconfig-paths/register scripts/verify-rbac.ts
```

Expected: `PASS - all assertions held` from both.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no output.

- [ ] **Step 5: Manual verification**

Server actions need a session, so these cannot be scripted. Run `npm run dev`, then confirm each:

1. As **Super Admin** on `/fuel` → a log row's Edit shows "Save changes"; saving applies immediately and the km/L cell updates.
2. As **Manager or Accountant** → the same row's Edit shows "Submit for Approval" and the amber warning; submitting leaves every visible value unchanged and the row shows "Edit pending approval" with actions disabled.
3. As **Super Admin** → Requests tab shows the pending change with a field/current/proposed table; Approve applies it; Reject requires a reason and leaves the log untouched.
4. Submitting a second edit on a row that already has one is refused, naming the holder.
5. A delete request requires a reason; after approval the log is gone and the stock figure at the top of the page has risen by its litres.
6. Bell notifications: approvers get one on submit; the requester gets one on approve and on reject.
7. **Boundary check:** open the truck detail page before and after approving a mileage edit — the truck's recorded odometer must be identical.

- [ ] **Step 6: Commit**

```bash
git add scripts/verify-rbac.ts scripts/verify-fuel-edits.ts
git commit -m "test: assert fuel edit permissions and the odometer boundary"
```

---

## Deployment note

Per project workflow, this reaches Vercel only after the PR is merged **and** the fork is synced. The migration must be applied to the production database (`npx prisma migrate deploy`) as part of that rollout — the app will throw on any `prisma.editRequest` call until the table exists.
