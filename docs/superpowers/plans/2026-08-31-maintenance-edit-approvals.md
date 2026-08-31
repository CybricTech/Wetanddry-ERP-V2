# Maintenance Edit & Delete Approvals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Super Admins edit and delete maintenance records and schedules directly; everyone else with `manage_maintenance` submits an edit/delete request that a Super Admin approves or rejects.

**Architecture:** A generic `EditRequest` table parks proposed values as JSON while the live record keeps serving its current ones. A per-entity applier registry holds explicit field whitelists so a JSON payload can never mass-assign `approvalStatus` or `truckId`. Approving an edit or delete recomputes the truck's derived odometer and service date from all sources.

**Tech Stack:** Next.js 16 App Router, Prisma 6 + PostgreSQL (Neon), NextAuth v5, Tailwind, TypeScript.

**Spec:** `docs/superpowers/specs/2026-08-31-maintenance-edit-approvals-design.md`

## Global Constraints

- Server actions live in `src/lib/actions/*.ts`, start with `'use server'`, return `{ success: true } | { error: string }` — never throw for expected failures — and call `revalidatePath(...)` for every affected route.
- Authorisation uses `hasPermission(role, permission)` / `checkPermission(role, permission)` from `src/lib/permissions.ts`. Every server action authorises before touching the DB.
- Status fields are plain strings with an inline comment listing allowed values. **Do not introduce Prisma enums.**
- Approval audit shape on any approvable model: `status`, `requestedBy`, `approvedBy`, `approvedAt`, `rejectionReason`.
- The Prisma client is generated to `src/generated/prisma` — import it from there in scripts, and from `@/lib/prisma` in app code.
- **No new `Permission` union member is introduced.** Requesting reuses `manage_maintenance`, approving reuses `approve_maintenance`. No role re-seed is required.
- This repo has **no test framework**. Verification is script-based, following `scripts/verify-rbac.ts`, run with:
  `npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/<name>.ts`
- Files importing `@/lib/prisma` are server-only. Client components must import types from them with `import type`.
- Migration name: `maintenance_edit_approvals`. All new columns nullable or defaulted so existing rows survive.

---

## What the verification script can and cannot reach

The script calls the **pure core** (`src/lib/edit-requests.ts`, `src/lib/truck-mileage.ts`)
directly, passing an explicit `Actor`. That is the whole reason the core is split from the
`'use server'` wrappers: a ts-node script has no request context, so anything that calls
`auth()` cannot be exercised from it.

Script-verifiable: whitelist stripping, concurrency refusal, approve/reject logic,
permission gating, truck recompute.

**Not** script-verifiable, covered by Manual QA below instead: the entry points in
`trucks.ts` and `src/lib/actions/edit-requests.ts`, because each begins with `await auth()`.
Do not attempt to mock the session — verify those in the running app.

## Do not add a backfill

`FuelLog.efficiency` is frozen at write time. Recomputing the odometer fixes *future*
efficiency figures and must never rewrite past rows: those values were correct against what
was known when written, and retroactively rewriting reported figures on an odometer
correction is worse than the inconsistency. No task in this plan writes `FuelLog`. Do not
add one.

---

## File Structure

**Create:**
- `src/lib/truck-mileage.ts` — `recomputeTruckDerivedValues()`. No `auth()`, so it is directly callable from a verification script.
- `src/lib/edit-requests.ts` — pure core: applier registry, field whitelists, and create/approve/reject taking an explicit actor. No `auth()`, no `'use server'`.
- `src/lib/actions/edit-requests.ts` — `'use server'` wrappers that resolve the session and delegate to the core.
- `src/components/trucks/EditRequestCell.tsx` — pending-edit badge and approver diff view.
- `scripts/verify-maintenance-edits.ts` — verification, built up across tasks.

**Modify:**
- `prisma/schema.prisma`
- `src/lib/actions/trucks.ts`
- `src/lib/actions/notifications.ts`
- `src/components/trucks/AddMaintenanceModal.tsx`
- `src/components/trucks/ScheduleMaintenanceModal.tsx`
- `src/components/trucks/TruckDetailsClient.tsx`

The split between `src/lib/edit-requests.ts` (pure) and `src/lib/actions/edit-requests.ts` (`'use server'`) mirrors the existing `src/lib/permissions.ts` / `src/lib/roles.server.ts` split. It exists because a `'use server'` file may only export async functions, and because the core must be callable from a verification script that has no request context.

---

### Task 1: Schema and migration

**Files:**
- Modify: `prisma/schema.prisma`
- Migration: `prisma/migrations/<timestamp>_maintenance_edit_approvals/`

**Interfaces:**
- Consumes: nothing.
- Produces: Prisma models `EditRequest` (fields: `id`, `entityType`, `entityId`, `operation`, `proposedChanges`, `previousValues`, `status`, `requestedBy`, `requestedById`, `approvedBy`, `approvedAt`, `rejectionReason`, `createdAt`, `updatedAt`) and two new `Truck` fields `manualMileage: Int?`, `manualMileageAt: DateTime?`.

- [ ] **Step 1: Add the `EditRequest` model**

Append to `prisma/schema.prisma`:

```prisma
// A proposed change to a record that already exists and is live. Distinct from the
// creation-approval flow on MaintenanceRecord/MaintenanceSchedule, where the row itself
// carries approvalStatus and stays inert until signed off. Here the target record keeps
// serving its current values while the proposal waits.
//
// Polymorphic by design: entityType/entityId is a string reference, not an FK, matching
// User.role and MaintenanceRecord.scheduleId. A request therefore outlives an approved
// delete, which is intentional - the audit trail survives. Every read path must tolerate
// a missing target.
model EditRequest {
  id              String    @id @default(cuid())
  entityType      String    // "maintenance_record", "maintenance_schedule"
  entityId        String
  operation       String    @default("update") // "update", "delete"
  proposedChanges Json?     // null for a delete
  previousValues  Json?     // whitelisted fields as they were at request time
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

- [ ] **Step 2: Add the odometer provenance columns to `Truck`**

In `prisma/schema.prisma`, inside `model Truck`, immediately after the `mileage` line:

```prisma
  mileage         Int       @default(0)
  // The odometer typed into the Add/Edit Truck form. Maintenance records and fuel logs
  // keep their own history in their own tables; this manual entry had none, so a
  // recompute would silently discard it. Surfaced as provenance on the truck page.
  manualMileage   Int?
  manualMileageAt DateTime?
```

- [ ] **Step 3: Create and apply the migration**

Run: `npx prisma migrate dev --name maintenance_edit_approvals`
Expected: migration created and applied, `src/generated/prisma` regenerated with no error.

- [ ] **Step 4: Verify the client picks up the new model**

Run:
```bash
npx ts-node --compiler-options '{"module":"CommonJS"}' -e "import { PrismaClient } from './src/generated/prisma'; const p = new PrismaClient(); p.editRequest.count().then(n => console.log('EditRequest rows:', n)).finally(() => p.\$disconnect());"
```
Expected: `EditRequest rows: 0`

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add EditRequest model and truck odometer provenance columns"
```

---

### Task 2: Truck derived-value recompute

Replaces `applyMaintenanceRecordToTruck` so exactly one function derives truck values, and removes the dead ungated `updateTruckMileage`.

**Files:**
- Create: `src/lib/truck-mileage.ts`
- Create: `scripts/verify-maintenance-edits.ts`
- Modify: `src/lib/actions/trucks.ts` (delete `updateTruckMileage` at :134; delete `applyMaintenanceRecordToTruck` at :214; update its two call sites; `updateTruck` at :91 writes manual mileage)

**Interfaces:**
- Consumes: `EditRequest`/`Truck` schema from Task 1.
- Produces: `recomputeTruckDerivedValues(truckId: string): Promise<void>` exported from `src/lib/truck-mileage.ts`.

- [ ] **Step 1: Write the failing verification script**

Create `scripts/verify-maintenance-edits.ts`:

```ts
/**
 * Verification for maintenance edit/delete approvals.
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/verify-maintenance-edits.ts
 */
import { PrismaClient } from '../src/generated/prisma';
import { recomputeTruckDerivedValues } from '../src/lib/truck-mileage';

const prisma = new PrismaClient();
const PLATE = '__verify_edit_approvals';

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    if (!ok) {
        failures++;
        console.log(`  FAIL  ${label} (expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`);
    } else {
        console.log(`  ok    ${label}`);
    }
}

async function cleanup() {
    const trucks = await prisma.truck.findMany({ where: { plateNumber: PLATE }, select: { id: true } });
    for (const t of trucks) {
        await prisma.editRequest.deleteMany({ where: { entityId: { in: (await prisma.maintenanceRecord.findMany({ where: { truckId: t.id }, select: { id: true } })).map(r => r.id) } } });
        await prisma.fuelLog.deleteMany({ where: { truckId: t.id } });
        await prisma.maintenanceRecord.deleteMany({ where: { truckId: t.id } });
        await prisma.maintenanceSchedule.deleteMany({ where: { truckId: t.id } });
    }
    await prisma.truck.deleteMany({ where: { plateNumber: PLATE } });
}

async function makeTruck(mileage = 0) {
    return prisma.truck.create({
        data: { plateNumber: PLATE, model: 'Verify', purchaseDate: new Date('2020-01-01'), mileage },
    });
}

async function main() {
    await cleanup();

    console.log('Recompute - derives from approved maintenance records');
    {
        const truck = await makeTruck(0);
        await prisma.maintenanceRecord.create({
            data: { truckId: truck.id, date: new Date('2026-03-01'), type: 'Oil Change', cost: 100, mileageAtService: 50_000, approvalStatus: 'Approved' },
        });
        await recomputeTruckDerivedValues(truck.id);
        const after = await prisma.truck.findUniqueOrThrow({ where: { id: truck.id } });
        check('mileage from approved record', after.mileage, 50_000);
        check('lastServiceDate from approved record', after.lastServiceDate?.toISOString(), new Date('2026-03-01').toISOString());
        await cleanup();
    }

    console.log('\nRecompute - a pending record contributes nothing');
    {
        const truck = await makeTruck(0);
        await prisma.maintenanceRecord.create({
            data: { truckId: truck.id, date: new Date('2026-03-01'), type: 'Oil Change', cost: 100, mileageAtService: 90_000, approvalStatus: 'Pending' },
        });
        await recomputeTruckDerivedValues(truck.id);
        const after = await prisma.truck.findUniqueOrThrow({ where: { id: truck.id } });
        check('pending record ignored', after.mileage, 0);
        check('pending record leaves lastServiceDate null', after.lastServiceDate, null);
        await cleanup();
    }

    console.log('\nRecompute - never drops below a fuel reading (spec: verification 8)');
    {
        const truck = await makeTruck(0);
        await prisma.maintenanceRecord.create({
            data: { truckId: truck.id, date: new Date('2026-03-01'), type: 'Oil Change', cost: 100, mileageAtService: 50_000, approvalStatus: 'Approved' },
        });
        await prisma.fuelLog.create({ data: { truckId: truck.id, liters: 100, cost: 50_000, mileage: 60_000 } });
        await recomputeTruckDerivedValues(truck.id);
        const after = await prisma.truck.findUniqueOrThrow({ where: { id: truck.id } });
        check('fuel reading wins when higher', after.mileage, 60_000);
        await cleanup();
    }

    console.log('\nRecompute - a manual reading survives (spec: verification 10)');
    {
        const truck = await prisma.truck.create({
            data: { plateNumber: PLATE, model: 'Verify', purchaseDate: new Date('2020-01-01'), mileage: 80_000, manualMileage: 80_000, manualMileageAt: new Date() },
        });
        await prisma.maintenanceRecord.create({
            data: { truckId: truck.id, date: new Date('2026-03-01'), type: 'Oil Change', cost: 100, mileageAtService: 50_000, approvalStatus: 'Approved' },
        });
        await recomputeTruckDerivedValues(truck.id);
        const after = await prisma.truck.findUniqueOrThrow({ where: { id: truck.id } });
        check('manual reading preserved', after.mileage, 80_000);
        await cleanup();
    }

    console.log('\nRecompute - corrects downward when the source drops (spec: verification 11)');
    {
        const truck = await makeTruck(0);
        const rec = await prisma.maintenanceRecord.create({
            data: { truckId: truck.id, date: new Date('2026-03-01'), type: 'Oil Change', cost: 100, mileageAtService: 500_000, approvalStatus: 'Approved' },
        });
        await recomputeTruckDerivedValues(truck.id);
        check('typo applied', (await prisma.truck.findUniqueOrThrow({ where: { id: truck.id } })).mileage, 500_000);

        await prisma.maintenanceRecord.update({ where: { id: rec.id }, data: { mileageAtService: 50_000 } });
        await recomputeTruckDerivedValues(truck.id);
        check('typo corrected downward', (await prisma.truck.findUniqueOrThrow({ where: { id: truck.id } })).mileage, 50_000);
        await cleanup();
    }

    console.log(failures === 0 ? '\nPASS - all assertions held' : `\nFAIL - ${failures} assertion(s) failed`);
    process.exit(failures === 0 ? 0 : 1);
}

main()
    .catch(async (e) => { console.error(e); await cleanup().catch(() => {}); process.exit(1); })
    .finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/verify-maintenance-edits.ts`
Expected: FAIL — cannot find module `../src/lib/truck-mileage`.

- [ ] **Step 3: Implement the recompute**

Create `src/lib/truck-mileage.ts`:

```ts
// Server-only: imports prisma. Kept out of src/lib/actions/ so it carries no
// 'use server' directive and stays callable from verification scripts, which have
// no request context and therefore cannot reach auth().
import prisma from '@/lib/prisma';

/**
 * Recomputes the values on Truck that are derived from other records.
 *
 * `lastServiceDate` is derived outright - approved maintenance records are its only
 * source. `mileage` is the max across all three odometer sources, because fuel logs
 * write it on every fill and feed efficiency, so deriving it from maintenance alone
 * would drop it below a reading already used in those figures.
 *
 * This is the single place truck values are derived. It replaces the former
 * forward-only applyMaintenanceRecordToTruck, so a correction can now move a value
 * down - which is the repair, not the risk: efficiency is a delta against
 * truck.mileage at fill time, so an inflated odometer silently records null
 * efficiency on every later fill until it is corrected.
 */
export async function recomputeTruckDerivedValues(truckId: string): Promise<void> {
    const [maintenance, fuel, truck] = await Promise.all([
        prisma.maintenanceRecord.aggregate({
            where: { truckId, approvalStatus: 'Approved' },
            _max: { date: true, mileageAtService: true },
        }),
        prisma.fuelLog.aggregate({
            where: { truckId },
            _max: { mileage: true },
        }),
        prisma.truck.findUnique({
            where: { id: truckId },
            select: { manualMileage: true },
        }),
    ]);

    if (!truck) return;

    const mileage = Math.max(
        maintenance._max.mileageAtService ?? 0,
        fuel._max.mileage ?? 0,
        truck.manualMileage ?? 0,
    );

    await prisma.truck.update({
        where: { id: truckId },
        data: {
            lastServiceDate: maintenance._max.date,
            mileage,
        },
    });
}
```

- [ ] **Step 4: Run the script to verify it passes**

Run: `npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/verify-maintenance-edits.ts`
Expected: `PASS - all assertions held`

- [ ] **Step 5: Replace `applyMaintenanceRecordToTruck`**

In `src/lib/actions/trucks.ts`, delete the whole `applyMaintenanceRecordToTruck` function (currently at :214) and add to the imports at the top:

```ts
import { recomputeTruckDerivedValues } from '@/lib/truck-mileage'
```

Then replace both call sites — in `createMaintenanceRecord` and in `approveMaintenanceRecord` — changing:

```ts
await applyMaintenanceRecordToTruck(record.id)
```

to:

```ts
await recomputeTruckDerivedValues(record.truckId)
```

In `approveMaintenanceRecord` the variable holding the record may be named differently; use whichever variable is in scope and pass its `truckId`.

- [ ] **Step 6: Delete the dead `updateTruckMileage`**

In `src/lib/actions/trucks.ts`, delete the entire `updateTruckMileage` function (currently at :134). It has zero callers anywhere in `src/` and no permission check, making it an ungated write path to a value that feeds every efficiency figure.

Confirm nothing referenced it:

Run: `grep -rn "updateTruckMileage" src/ --include=*.ts --include=*.tsx`
Expected: no output.

- [ ] **Step 7: Record manual odometer entries in `updateTruck`**

In `src/lib/actions/trucks.ts`, inside `updateTruck` (:91), the `data` object currently sets `mileage: parseInt(mileage) || 0`. Change that to also stamp provenance:

```ts
            // The form odometer is the one mileage source with no history of its own,
            // so it is stamped here to survive recomputeTruckDerivedValues().
            mileage: parseInt(mileage) || 0,
            manualMileage: parseInt(mileage) || 0,
            manualMileageAt: new Date(),
```

- [ ] **Step 8: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors mentioning `trucks.ts` or `truck-mileage.ts`.

- [ ] **Step 9: Re-run verification and commit**

Run: `npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/verify-maintenance-edits.ts`
Expected: `PASS`

```bash
git add src/lib/truck-mileage.ts scripts/verify-maintenance-edits.ts src/lib/actions/trucks.ts
git commit -m "feat: derive truck odometer and service date from all sources

Replaces the forward-only applyMaintenanceRecordToTruck with a single
recompute across approved maintenance records, fuel logs, and the manual
form entry, so a corrected record can move a value down. Removes the dead,
ungated updateTruckMileage."
```

---

### Task 3: Edit-request core — whitelists and creation

**Files:**
- Create: `src/lib/edit-requests.ts`
- Modify: `scripts/verify-maintenance-edits.ts`

**Interfaces:**
- Consumes: `recomputeTruckDerivedValues` from Task 2.
- Produces:
  - `type EntityType = 'maintenance_record' | 'maintenance_schedule'`
  - `interface Actor { name: string; role: string }`
  - `sanitizeChanges(entityType: EntityType, raw: Record<string, unknown>): Record<string, unknown>`
  - `createRequest(actor: Actor, entityType: EntityType, entityId: string, operation: 'update' | 'delete', raw: Record<string, unknown>): Promise<{ success: true; requestId: string } | { error: string }>`
  - `EDITABLE_FIELDS: Record<EntityType, readonly string[]>`

- [ ] **Step 1: Add failing assertions for the whitelist**

Append to `scripts/verify-maintenance-edits.ts`, inside `main()` just before the final `console.log(failures === 0 ...)` line:

```ts
    console.log('\nWhitelist - strips fields that are not editable (spec: verification 7)');
    {
        const dirty = {
            cost: 500,
            notes: 'legit',
            approvalStatus: 'Approved',
            truckId: 'someone-elses-truck',
            approvedBy: 'forged',
            id: 'reassigned',
        };
        const clean = sanitizeChanges('maintenance_record', dirty);
        check('keeps cost', clean.cost, 500);
        check('keeps notes', clean.notes, 'legit');
        check('strips approvalStatus', 'approvalStatus' in clean, false);
        check('strips truckId', 'truckId' in clean, false);
        check('strips approvedBy', 'approvedBy' in clean, false);
        check('strips id', 'id' in clean, false);
    }

    console.log('\nCreate - a second pending request is refused (spec: verification 6)');
    {
        const truck = await makeTruck(0);
        const rec = await prisma.maintenanceRecord.create({
            data: { truckId: truck.id, date: new Date('2026-03-01'), type: 'Oil Change', cost: 100, approvalStatus: 'Approved' },
        });
        const actor = { name: 'Verify Manager', role: 'Manager' };

        const first = await createRequest(actor, 'maintenance_record', rec.id, 'update', { cost: 200 });
        check('first request accepted', 'success' in first, true);

        const second = await createRequest(actor, 'maintenance_record', rec.id, 'update', { cost: 300 });
        check('second request refused', 'error' in second, true);

        check('live record untouched (spec: verification 1)',
            (await prisma.maintenanceRecord.findUniqueOrThrow({ where: { id: rec.id } })).cost, 100);
        await cleanup();
    }

    console.log('\nCreate - a record that is itself Pending is not routed through EditRequest');
    {
        const truck = await makeTruck(0);
        const rec = await prisma.maintenanceRecord.create({
            data: { truckId: truck.id, date: new Date('2026-03-01'), type: 'Oil Change', cost: 100, approvalStatus: 'Pending' },
        });
        const result = await createRequest({ name: 'Verify Manager', role: 'Manager' }, 'maintenance_record', rec.id, 'update', { cost: 200 });
        check('pending record refused', 'error' in result, true);
        await cleanup();
    }
```

And extend the import at the top of the file:

```ts
import { recomputeTruckDerivedValues } from '../src/lib/truck-mileage';
import { sanitizeChanges, createRequest } from '../src/lib/edit-requests';
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/verify-maintenance-edits.ts`
Expected: FAIL — cannot find module `../src/lib/edit-requests`.

- [ ] **Step 3: Implement the core, whitelists, and creation**

Create `src/lib/edit-requests.ts`:

```ts
// Server-only: imports prisma. Deliberately NOT a 'use server' module - that
// directive restricts a file to async exports, and this one exports types and a
// pure function. The thin server actions live in src/lib/actions/edit-requests.ts.
import prisma from '@/lib/prisma';
import { hasPermission, type Permission } from '@/lib/permissions';
import { recomputeTruckDerivedValues } from '@/lib/truck-mileage';

export type EntityType = 'maintenance_record' | 'maintenance_schedule';
export type Operation = 'update' | 'delete';

/** Resolved caller. Server actions build this from the session; scripts pass one directly. */
export interface Actor {
    name: string;
    role: string;
    id?: string | null;
}

interface LoadedEntity {
    /** The whitelisted fields as they currently stand, for previousValues and the diff. */
    values: Record<string, unknown>;
    /** Captured before a delete so the truck can still be recomputed afterwards. */
    truckId: string;
    /** Human label for notification text. */
    label: string;
    /** The target's own creation-approval state. Only 'Approved' routes through EditRequest. */
    approvalStatus: string;
}

interface EntityApplier {
    requestPermission: Permission;
    approvePermission: Permission;
    editableFields: readonly string[];
    load(id: string): Promise<LoadedEntity | null>;
    applyUpdate(id: string, changes: Record<string, unknown>): Promise<void>;
    applyDelete(id: string): Promise<void>;
}

/**
 * JSON round-trips lose types: Date becomes an ISO string, and a numeric input may
 * arrive as a string. Each applier coerces its own fields before writing.
 */
function coerceMaintenanceRecord(changes: Record<string, unknown>): Record<string, unknown> {
    const out = { ...changes };
    if ('date' in out && out.date != null) out.date = new Date(out.date as string);
    if ('cost' in out && out.cost != null) out.cost = Number(out.cost);
    if ('mileageAtService' in out) {
        out.mileageAtService = out.mileageAtService == null ? null : Number(out.mileageAtService);
    }
    return out;
}

function coerceMaintenanceSchedule(changes: Record<string, unknown>): Record<string, unknown> {
    const out = { ...changes };
    for (const field of ['nextDueDate'] as const) {
        if (field in out) out[field] = out[field] == null ? null : new Date(out[field] as string);
    }
    for (const field of ['intervalDays', 'intervalMileage', 'nextDueMileage'] as const) {
        if (field in out) out[field] = out[field] == null ? null : Number(out[field]);
    }
    if ('isActive' in out) out.isActive = Boolean(out.isActive);
    return out;
}

function pick(source: Record<string, unknown>, fields: readonly string[]): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const field of fields) if (field in source) out[field] = source[field];
    return out;
}

const MAINTENANCE_RECORD_FIELDS = [
    'type', 'date', 'cost', 'mileageAtService', 'status', 'notes', 'performedBy',
] as const;

const MAINTENANCE_SCHEDULE_FIELDS = [
    'type', 'intervalType', 'intervalDays', 'intervalMileage',
    'nextDueDate', 'nextDueMileage', 'priority', 'isActive', 'notes',
] as const;

export const APPLIERS: Record<EntityType, EntityApplier> = {
    maintenance_record: {
        requestPermission: 'manage_maintenance',
        approvePermission: 'approve_maintenance',
        editableFields: MAINTENANCE_RECORD_FIELDS,
        async load(id) {
            const record = await prisma.maintenanceRecord.findUnique({
                where: { id },
                include: { truck: true },
            });
            if (!record) return null;
            return {
                values: pick(record as unknown as Record<string, unknown>, MAINTENANCE_RECORD_FIELDS),
                truckId: record.truckId,
                label: `${record.type} on ${record.truck.plateNumber}`,
                approvalStatus: record.approvalStatus,
            };
        },
        async applyUpdate(id, changes) {
            await prisma.maintenanceRecord.update({
                where: { id },
                data: coerceMaintenanceRecord(changes),
            });
        },
        async applyDelete(id) {
            await prisma.maintenanceRecord.delete({ where: { id } });
        },
    },
    maintenance_schedule: {
        requestPermission: 'manage_maintenance',
        approvePermission: 'approve_maintenance',
        editableFields: MAINTENANCE_SCHEDULE_FIELDS,
        async load(id) {
            const schedule = await prisma.maintenanceSchedule.findUnique({
                where: { id },
                include: { truck: true },
            });
            if (!schedule) return null;
            return {
                values: pick(schedule as unknown as Record<string, unknown>, MAINTENANCE_SCHEDULE_FIELDS),
                truckId: schedule.truckId,
                label: `${schedule.type} schedule on ${schedule.truck.plateNumber}`,
                approvalStatus: schedule.approvalStatus,
            };
        },
        async applyUpdate(id, changes) {
            await prisma.maintenanceSchedule.update({
                where: { id },
                data: coerceMaintenanceSchedule(changes),
            });
        },
        async applyDelete(id) {
            // Records keep a bare scheduleId string, not an FK - the schema states the
            // schedule may be deleted while its service history stays. Do not cascade.
            await prisma.maintenanceSchedule.delete({ where: { id } });
        },
    },
};

export const EDITABLE_FIELDS: Record<EntityType, readonly string[]> = {
    maintenance_record: MAINTENANCE_RECORD_FIELDS,
    maintenance_schedule: MAINTENANCE_SCHEDULE_FIELDS,
};

/**
 * Drops every key that is not explicitly editable for this entity type.
 *
 * This is the mass-assignment guard. A proposedChanges blob is attacker-influenced,
 * and merging it straight into prisma.update() would let it set approvalStatus,
 * reassign truckId, or forge approvedBy. Stripping happens here, at request time,
 * so nothing unsafe is ever persisted - not merely ignored later.
 */
export function sanitizeChanges(
    entityType: EntityType,
    raw: Record<string, unknown>,
): Record<string, unknown> {
    const applier = APPLIERS[entityType];
    if (!applier) throw new Error(`Unknown entity type: ${entityType}`);
    return pick(raw, applier.editableFields);
}

export async function createRequest(
    actor: Actor,
    entityType: EntityType,
    entityId: string,
    operation: Operation,
    raw: Record<string, unknown>,
): Promise<{ success: true; requestId: string } | { error: string }> {
    const applier = APPLIERS[entityType];
    if (!applier) return { error: 'Unknown record type' };

    if (!hasPermission(actor.role, applier.requestPermission)) {
        return { error: 'Unauthorized' };
    }

    const target = await applier.load(entityId);
    if (!target) return { error: 'Record not found' };

    // A record that has not been approved yet has taken no effect and already awaits
    // sign-off, so its requester edits it in place rather than stacking a second
    // approval on top. A rejected one is not editable at all.
    if (target.approvalStatus !== 'Approved') {
        return {
            error: target.approvalStatus === 'Pending'
                ? 'This record is still awaiting approval - edit it directly instead.'
                : 'A rejected record cannot be edited. Create a new one instead.',
        };
    }

    const open = await prisma.editRequest.findFirst({
        where: { entityType, entityId, status: 'Pending' },
        select: { requestedBy: true },
    });
    if (open) {
        return { error: `This record already has a pending edit request from ${open.requestedBy}.` };
    }

    const changes = operation === 'delete' ? null : sanitizeChanges(entityType, raw);
    if (changes && Object.keys(changes).length === 0) {
        return { error: 'No editable fields were changed' };
    }

    const request = await prisma.editRequest.create({
        data: {
            entityType,
            entityId,
            operation,
            proposedChanges: changes ?? undefined,
            previousValues: target.values as never,
            status: 'Pending',
            requestedBy: actor.name,
            requestedById: actor.id ?? null,
        },
    });

    return { success: true, requestId: request.id };
}
```

- [ ] **Step 4: Run the script to verify it passes**

Run: `npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/verify-maintenance-edits.ts`
Expected: `PASS - all assertions held`

- [ ] **Step 5: Commit**

```bash
git add src/lib/edit-requests.ts scripts/verify-maintenance-edits.ts
git commit -m "feat: edit-request core with per-entity field whitelists

Stripping non-editable keys happens at request time so a proposedChanges
blob can never mass-assign approvalStatus, truckId, or approvedBy."
```

---

### Task 4: Edit-request core — approve and reject

**Files:**
- Modify: `src/lib/edit-requests.ts`
- Modify: `scripts/verify-maintenance-edits.ts`

**Interfaces:**
- Consumes: `APPLIERS`, `Actor`, `createRequest` from Task 3; `recomputeTruckDerivedValues` from Task 2.
- Produces:
  - `approveRequest(actor: Actor, requestId: string): Promise<{ success: true } | { error: string }>`
  - `rejectRequest(actor: Actor, requestId: string, reason: string): Promise<{ success: true } | { error: string }>`
  - `isStale(request: { previousValues: unknown }, current: Record<string, unknown>): boolean`

- [ ] **Step 1: Add failing assertions**

Append inside `main()` in `scripts/verify-maintenance-edits.ts`, before the final summary line:

```ts
    console.log('\nApprove - applies whitelisted fields and recomputes (spec: verification 3)');
    {
        const truck = await makeTruck(0);
        const rec = await prisma.maintenanceRecord.create({
            data: { truckId: truck.id, date: new Date('2026-03-01'), type: 'Oil Change', cost: 100, mileageAtService: 500_000, approvalStatus: 'Approved' },
        });
        await recomputeTruckDerivedValues(truck.id);

        const manager = { name: 'Verify Manager', role: 'Manager' };
        const admin = { name: 'Verify Admin', role: 'Super Admin' };

        const created = await createRequest(manager, 'maintenance_record', rec.id, 'update', { cost: 250, mileageAtService: 50_000 });
        if (!('success' in created)) throw new Error('setup failed');

        const approved = await approveRequest(admin, created.requestId);
        check('approve succeeds', 'success' in approved, true);

        const after = await prisma.maintenanceRecord.findUniqueOrThrow({ where: { id: rec.id } });
        check('cost applied', after.cost, 250);
        check('mileage applied', after.mileageAtService, 50_000);
        check('approvalStatus untouched', after.approvalStatus, 'Approved');
        check('truck recomputed downward', (await prisma.truck.findUniqueOrThrow({ where: { id: truck.id } })).mileage, 50_000);
        await cleanup();
    }

    console.log('\nApprove - a non-approver is refused');
    {
        const truck = await makeTruck(0);
        const rec = await prisma.maintenanceRecord.create({
            data: { truckId: truck.id, date: new Date('2026-03-01'), type: 'Oil Change', cost: 100, approvalStatus: 'Approved' },
        });
        const manager = { name: 'Verify Manager', role: 'Manager' };
        const created = await createRequest(manager, 'maintenance_record', rec.id, 'update', { cost: 250 });
        if (!('success' in created)) throw new Error('setup failed');

        const selfApprove = await approveRequest(manager, created.requestId);
        check('manager cannot approve own request', 'error' in selfApprove, true);
        check('record unchanged', (await prisma.maintenanceRecord.findUniqueOrThrow({ where: { id: rec.id } })).cost, 100);
        await cleanup();
    }

    console.log('\nApprove a delete - removes and recomputes (spec: verification 4)');
    {
        const truck = await makeTruck(0);
        const keep = await prisma.maintenanceRecord.create({
            data: { truckId: truck.id, date: new Date('2026-01-01'), type: 'Service', cost: 50, mileageAtService: 40_000, approvalStatus: 'Approved' },
        });
        const drop = await prisma.maintenanceRecord.create({
            data: { truckId: truck.id, date: new Date('2026-03-01'), type: 'Oil Change', cost: 100, mileageAtService: 500_000, approvalStatus: 'Approved' },
        });
        await recomputeTruckDerivedValues(truck.id);

        const created = await createRequest({ name: 'Verify Manager', role: 'Manager' }, 'maintenance_record', drop.id, 'delete', {});
        if (!('success' in created)) throw new Error('setup failed');
        await approveRequest({ name: 'Verify Admin', role: 'Super Admin' }, created.requestId);

        check('record deleted', await prisma.maintenanceRecord.findUnique({ where: { id: drop.id } }), null);
        check('surviving record kept', (await prisma.maintenanceRecord.findUnique({ where: { id: keep.id } }))?.cost, 50);
        const after = await prisma.truck.findUniqueOrThrow({ where: { id: truck.id } });
        check('truck recomputed after delete', after.mileage, 40_000);
        check('lastServiceDate recomputed after delete', after.lastServiceDate?.toISOString(), new Date('2026-01-01').toISOString());
        await cleanup();
    }

    console.log('\nReject - leaves the live record alone (spec: verification 5)');
    {
        const truck = await makeTruck(0);
        const rec = await prisma.maintenanceRecord.create({
            data: { truckId: truck.id, date: new Date('2026-03-01'), type: 'Oil Change', cost: 100, approvalStatus: 'Approved' },
        });
        const created = await createRequest({ name: 'Verify Manager', role: 'Manager' }, 'maintenance_record', rec.id, 'update', { cost: 999 });
        if (!('success' in created)) throw new Error('setup failed');

        const rejected = await rejectRequest({ name: 'Verify Admin', role: 'Super Admin' }, created.requestId, 'Wrong truck');
        check('reject succeeds', 'success' in rejected, true);
        check('record untouched', (await prisma.maintenanceRecord.findUniqueOrThrow({ where: { id: rec.id } })).cost, 100);

        const req = await prisma.editRequest.findUniqueOrThrow({ where: { id: created.requestId } });
        check('status recorded', req.status, 'Rejected');
        check('reason preserved', req.rejectionReason, 'Wrong truck');

        const retry = await createRequest({ name: 'Verify Manager', role: 'Manager' }, 'maintenance_record', rec.id, 'update', { cost: 150 });
        check('a rejected request unblocks the next one', 'success' in retry, true);
        await cleanup();
    }

    console.log('\nReject - requires a reason');
    {
        const truck = await makeTruck(0);
        const rec = await prisma.maintenanceRecord.create({
            data: { truckId: truck.id, date: new Date('2026-03-01'), type: 'Oil Change', cost: 100, approvalStatus: 'Approved' },
        });
        const created = await createRequest({ name: 'Verify Manager', role: 'Manager' }, 'maintenance_record', rec.id, 'update', { cost: 999 });
        if (!('success' in created)) throw new Error('setup failed');
        const blank = await rejectRequest({ name: 'Verify Admin', role: 'Super Admin' }, created.requestId, '   ');
        check('blank reason refused', 'error' in blank, true);
        await cleanup();
    }
```

Extend the import:

```ts
import { sanitizeChanges, createRequest, approveRequest, rejectRequest } from '../src/lib/edit-requests';
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/verify-maintenance-edits.ts`
Expected: FAIL — `approveRequest is not a function` (or a TS "has no exported member" error).

- [ ] **Step 3: Implement approve, reject, and staleness**

Append to `src/lib/edit-requests.ts`:

```ts
/**
 * True when the live record moved between the request being raised and now, so the
 * approver is about to overwrite values they never saw. Compared over the whitelisted
 * fields only, and serialised because previousValues came back through JSON.
 */
export function isStale(
    request: { previousValues: unknown },
    current: Record<string, unknown>,
): boolean {
    if (!request.previousValues) return false;
    return JSON.stringify(request.previousValues) !== JSON.stringify(JSON.parse(JSON.stringify(current)));
}

export async function approveRequest(
    actor: Actor,
    requestId: string,
): Promise<{ success: true } | { error: string }> {
    const request = await prisma.editRequest.findUnique({ where: { id: requestId } });
    if (!request) return { error: 'Edit request not found' };
    if (request.status !== 'Pending') return { error: `This request was already ${request.status.toLowerCase()}` };

    const applier = APPLIERS[request.entityType as EntityType];
    if (!applier) return { error: 'Unknown record type' };

    if (!hasPermission(actor.role, applier.approvePermission)) {
        return { error: 'Unauthorized' };
    }

    // Loaded before the change so a delete can still name its truck afterwards.
    const target = await applier.load(request.entityId);
    if (!target) return { error: 'The record this request refers to no longer exists' };

    if (request.operation === 'delete') {
        await applier.applyDelete(request.entityId);
    } else {
        // Sanitised again on the way out. The row could have been written before a
        // field left the whitelist, and this is the last gate before prisma.update().
        const changes = sanitizeChanges(
            request.entityType as EntityType,
            (request.proposedChanges ?? {}) as Record<string, unknown>,
        );
        await applier.applyUpdate(request.entityId, changes);
    }

    await prisma.editRequest.update({
        where: { id: requestId },
        data: { status: 'Approved', approvedBy: actor.name, approvedAt: new Date() },
    });

    await recomputeTruckDerivedValues(target.truckId);

    return { success: true };
}

export async function rejectRequest(
    actor: Actor,
    requestId: string,
    reason: string,
): Promise<{ success: true } | { error: string }> {
    if (!reason?.trim()) return { error: 'A reason is required to reject a request' };

    const request = await prisma.editRequest.findUnique({ where: { id: requestId } });
    if (!request) return { error: 'Edit request not found' };
    if (request.status !== 'Pending') return { error: `This request was already ${request.status.toLowerCase()}` };

    const applier = APPLIERS[request.entityType as EntityType];
    if (!applier) return { error: 'Unknown record type' };

    if (!hasPermission(actor.role, applier.approvePermission)) {
        return { error: 'Unauthorized' };
    }

    await prisma.editRequest.update({
        where: { id: requestId },
        data: { status: 'Rejected', approvedBy: actor.name, approvedAt: new Date(), rejectionReason: reason.trim() },
    });

    return { success: true };
}
```

- [ ] **Step 4: Run the script to verify it passes**

Run: `npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/verify-maintenance-edits.ts`
Expected: `PASS - all assertions held`

- [ ] **Step 5: Commit**

```bash
git add src/lib/edit-requests.ts scripts/verify-maintenance-edits.ts
git commit -m "feat: approve and reject edit requests

Approval re-sanitises before writing, captures the truck before a delete so
it can still be recomputed, and refuses self-approval by anyone without
approve_maintenance."
```

---

### Task 5: Notification types and server-action wrappers

**Files:**
- Modify: `src/lib/actions/notifications.ts`
- Create: `src/lib/actions/edit-requests.ts`

**Interfaces:**
- Consumes: `createRequest`, `approveRequest`, `rejectRequest`, `EntityType` from Tasks 3–4.
- Produces: server actions `submitEditRequest(entityType, entityId, operation, changes)`, `approveEditRequest(requestId)`, `rejectEditRequest(requestId, reason)`, each returning `{ success: true } | { error: string }`.

- [ ] **Step 1: Add the notification types**

In `src/lib/actions/notifications.ts`, in the `NotificationType` union (:10), after `| 'maintenance_rejected'`:

```ts
    | 'maintenance_edit_pending'
    | 'maintenance_edit_approved'
    | 'maintenance_edit_rejected'
```

- [ ] **Step 2: Add the matching config entries**

In the same file, in `NOTIFICATION_CONFIG`, after the `maintenance_rejected` line:

```ts
    maintenance_edit_pending: { defaultPriority: 'high', requiredPermissions: ['approve_maintenance'] },
    maintenance_edit_approved: { defaultPriority: 'medium' },
    maintenance_edit_rejected: { defaultPriority: 'medium' },
```

- [ ] **Step 3: Widen the `notifyApprovers` type union**

In `src/lib/actions/notifications.ts` at :488, add to the union of accepted literals:

```ts
        | 'maintenance_approval_pending'
        | 'maintenance_edit_pending'
        | 'fuel_request_pending',
```

- [ ] **Step 4: Write the server-action wrappers**

Create `src/lib/actions/edit-requests.ts`:

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import {
    createRequest,
    approveRequest,
    rejectRequest,
    APPLIERS,
    type EntityType,
    type Operation,
} from '@/lib/edit-requests'
import { notifyApprovers, notifyRequester } from '@/lib/actions/notifications'

/** Resolves the caller into the Actor the pure core expects. */
async function currentActor() {
    const session = await auth()
    if (!session?.user?.role) return null
    return {
        name: session.user.name || session.user.email || 'System',
        role: session.user.role,
        id: session.user.id ?? null,
    }
}

/** Resolves the user id behind a requestedBy label so a decision can be sent back. */
async function findRequesterId(requestedBy: string | null): Promise<string | null> {
    if (!requestedBy) return null
    const user = await prisma.user.findFirst({
        where: { OR: [{ name: requestedBy }, { email: requestedBy }] },
        select: { id: true },
    })
    return user?.id ?? null
}

function revalidateFor(truckId?: string | null) {
    revalidatePath('/trucks')
    if (truckId) revalidatePath(`/trucks/${truckId}`)
}

export async function submitEditRequest(
    entityType: EntityType,
    entityId: string,
    operation: Operation,
    changes: Record<string, unknown>,
): Promise<{ success: true } | { error: string }> {
    const actor = await currentActor()
    if (!actor) return { error: 'Unauthorized' }

    const target = await APPLIERS[entityType]?.load(entityId)
    const result = await createRequest(actor, entityType, entityId, operation, changes)
    if ('error' in result) return result

    notifyApprovers(
        'maintenance_edit_pending',
        `${operation === 'delete' ? 'Deletion' : 'Edit'} approval needed`,
        `${actor.name} proposed ${operation === 'delete' ? 'deleting' : 'an edit to'} ${target?.label ?? 'a maintenance record'}.`,
        'edit_request',
        result.requestId,
    ).catch(console.error)

    revalidateFor(target?.truckId)
    return { success: true }
}

export async function approveEditRequest(requestId: string): Promise<{ success: true } | { error: string }> {
    const actor = await currentActor()
    if (!actor) return { error: 'Unauthorized' }

    const request = await prisma.editRequest.findUnique({ where: { id: requestId } })
    const target = request ? await APPLIERS[request.entityType as EntityType]?.load(request.entityId) : null

    const result = await approveRequest(actor, requestId)
    if ('error' in result) return result

    const requesterId = await findRequesterId(request?.requestedBy ?? null)
    if (requesterId) {
        notifyRequester(
            requesterId,
            'maintenance_edit_approved',
            'Your change was approved',
            `${actor.name} approved your ${request?.operation === 'delete' ? 'deletion' : 'edit'} of ${target?.label ?? 'a maintenance record'}.`,
            'edit_request',
            requestId,
        ).catch(console.error)
    }

    revalidateFor(target?.truckId)
    return { success: true }
}

export async function rejectEditRequest(
    requestId: string,
    reason: string,
): Promise<{ success: true } | { error: string }> {
    const actor = await currentActor()
    if (!actor) return { error: 'Unauthorized' }

    const request = await prisma.editRequest.findUnique({ where: { id: requestId } })
    const target = request ? await APPLIERS[request.entityType as EntityType]?.load(request.entityId) : null

    const result = await rejectRequest(actor, requestId, reason)
    if ('error' in result) return result

    const requesterId = await findRequesterId(request?.requestedBy ?? null)
    if (requesterId) {
        notifyRequester(
            requesterId,
            'maintenance_edit_rejected',
            'Your change was rejected',
            `${actor.name} rejected your change to ${target?.label ?? 'a maintenance record'}: ${reason}`,
            'edit_request',
            requestId,
        ).catch(console.error)
    }

    revalidateFor(target?.truckId)
    return { success: true }
}
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors in `notifications.ts` or `actions/edit-requests.ts`. A missing `NOTIFICATION_CONFIG` key surfaces here as a `Record` completeness error — add it if so.

- [ ] **Step 6: Commit**

```bash
git add src/lib/actions/notifications.ts src/lib/actions/edit-requests.ts
git commit -m "feat: notifications and server actions for edit requests"
```

---

### Task 6: Maintenance entry points

**Files:**
- Modify: `src/lib/actions/trucks.ts`
- Modify: `scripts/verify-maintenance-edits.ts`

**Interfaces:**
- Consumes: `submitEditRequest` from Task 5; `recomputeTruckDerivedValues` from Task 2.
- Produces: `updateMaintenanceRecord(id, formData)`, `deleteMaintenanceRecord(id)`, `deleteMaintenanceSchedule(id)`; and `updateMaintenanceSchedule(id, formData)` retrofitted to the approval split.

- [ ] **Step 1: Add the record update and delete actions**

In `src/lib/actions/trucks.ts`, after `getMaintenanceRecords`, add:

```ts
/**
 * Editing a live maintenance record. An approver writes straight through; everyone
 * else's change is parked as an EditRequest until a Super Admin signs it off.
 * Mirrors the split createMaintenanceRecord already uses on the create path.
 */
export async function updateMaintenanceRecord(
    id: string,
    formData: FormData
): Promise<{ success: true; queued?: boolean } | { error: string }> {
    try {
        const session = await auth()
        if (!session?.user?.role) return { error: 'Unauthorized' }
        checkPermission(session.user.role, 'manage_maintenance')

        const type = formData.get('type') as string
        const date = formData.get('date') as string
        const cost = formData.get('cost') as string
        const mileageAtService = formData.get('mileageAtService') as string
        const status = formData.get('status') as string
        const notes = formData.get('notes') as string
        const performedBy = formData.get('performedBy') as string

        if (!type || !date || !cost) return { error: 'Missing required fields' }

        const changes = {
            type,
            date: new Date(date).toISOString(),
            cost: parseFloat(cost),
            mileageAtService: mileageAtService ? parseInt(mileageAtService) : null,
            status: status || 'Completed',
            notes: notes || null,
            performedBy: performedBy || null,
        }

        const existing = await prisma.maintenanceRecord.findUnique({ where: { id } })
        if (!existing) return { error: 'Record not found' }

        // A record still awaiting its own approval has taken no effect, so its edit
        // lands directly rather than stacking a second approval on top.
        const isApprover = hasPermission(session.user.role, 'approve_maintenance')
        if (isApprover || existing.approvalStatus === 'Pending') {
            await prisma.maintenanceRecord.update({
                where: { id },
                data: {
                    type: changes.type,
                    date: new Date(changes.date),
                    cost: changes.cost,
                    mileageAtService: changes.mileageAtService,
                    status: changes.status,
                    notes: changes.notes,
                    performedBy: changes.performedBy,
                },
            })
            await recomputeTruckDerivedValues(existing.truckId)
            revalidatePath(`/trucks/${existing.truckId}`)
            revalidatePath('/trucks')
            return { success: true }
        }

        const result = await submitEditRequest('maintenance_record', id, 'update', changes)
        if ('error' in result) return result
        return { success: true, queued: true }
    } catch (error) {
        console.error('Failed to update maintenance record:', error)
        return { error: error instanceof Error ? error.message : 'Failed to update maintenance record' }
    }
}

export async function deleteMaintenanceRecord(
    id: string
): Promise<{ success: true; queued?: boolean } | { error: string }> {
    try {
        const session = await auth()
        if (!session?.user?.role) return { error: 'Unauthorized' }
        checkPermission(session.user.role, 'manage_maintenance')

        const existing = await prisma.maintenanceRecord.findUnique({ where: { id } })
        if (!existing) return { error: 'Record not found' }

        const isApprover = hasPermission(session.user.role, 'approve_maintenance')
        if (isApprover || existing.approvalStatus === 'Pending') {
            await prisma.maintenanceRecord.delete({ where: { id } })
            await recomputeTruckDerivedValues(existing.truckId)
            revalidatePath(`/trucks/${existing.truckId}`)
            revalidatePath('/trucks')
            return { success: true }
        }

        const result = await submitEditRequest('maintenance_record', id, 'delete', {})
        if ('error' in result) return result
        return { success: true, queued: true }
    } catch (error) {
        console.error('Failed to delete maintenance record:', error)
        return { error: error instanceof Error ? error.message : 'Failed to delete maintenance record' }
    }
}
```

Add to the imports at the top of `trucks.ts`:

```ts
import { submitEditRequest } from '@/lib/actions/edit-requests'
```

- [ ] **Step 2: Retrofit `updateMaintenanceSchedule` and add the schedule delete**

Replace the whole existing `updateMaintenanceSchedule` function (:563) with:

```ts
/**
 * Was gated only on manage_maintenance, which let a Manager change an approved
 * schedule's due date with no sign-off - an approve-by-the-back-door around the
 * creation-approval flow. Now takes the same split as every other maintenance write.
 */
export async function updateMaintenanceSchedule(
    id: string,
    formData: FormData
): Promise<{ success: true; queued?: boolean } | { error: string }> {
    try {
        const session = await auth()
        if (!session?.user?.role) return { error: 'Unauthorized' }
        checkPermission(session.user.role, 'manage_maintenance')

        const nextDueDate = formData.get('nextDueDate') as string
        const nextDueMileage = formData.get('nextDueMileage') as string
        const isActive = formData.get('isActive') === 'true'

        const existing = await prisma.maintenanceSchedule.findUnique({ where: { id } })
        if (!existing) return { error: 'Schedule not found' }

        const changes = {
            nextDueDate: nextDueDate ? new Date(nextDueDate).toISOString() : null,
            nextDueMileage: nextDueMileage ? parseInt(nextDueMileage) : null,
            isActive,
        }

        const isApprover = hasPermission(session.user.role, 'approve_maintenance')
        if (isApprover || existing.approvalStatus === 'Pending') {
            await prisma.maintenanceSchedule.update({
                where: { id },
                data: {
                    nextDueDate: changes.nextDueDate ? new Date(changes.nextDueDate) : null,
                    nextDueMileage: changes.nextDueMileage,
                    isActive: changes.isActive,
                },
            })
            revalidatePath(`/trucks/${existing.truckId}`)
            revalidatePath('/trucks')
            return { success: true }
        }

        const result = await submitEditRequest('maintenance_schedule', id, 'update', changes)
        if ('error' in result) return result
        return { success: true, queued: true }
    } catch (error) {
        console.error('Failed to update maintenance schedule:', error)
        return { error: error instanceof Error ? error.message : 'Failed to update maintenance schedule' }
    }
}

export async function deleteMaintenanceSchedule(
    id: string
): Promise<{ success: true; queued?: boolean } | { error: string }> {
    try {
        const session = await auth()
        if (!session?.user?.role) return { error: 'Unauthorized' }
        checkPermission(session.user.role, 'manage_maintenance')

        const existing = await prisma.maintenanceSchedule.findUnique({ where: { id } })
        if (!existing) return { error: 'Schedule not found' }

        const isApprover = hasPermission(session.user.role, 'approve_maintenance')
        if (isApprover || existing.approvalStatus === 'Pending') {
            // Records keep a bare scheduleId string, not an FK - service history
            // deliberately outlives the schedule that produced it. Do not cascade.
            await prisma.maintenanceSchedule.delete({ where: { id } })
            revalidatePath(`/trucks/${existing.truckId}`)
            revalidatePath('/trucks')
            return { success: true }
        }

        const result = await submitEditRequest('maintenance_schedule', id, 'delete', {})
        if ('error' in result) return result
        return { success: true, queued: true }
    } catch (error) {
        console.error('Failed to delete maintenance schedule:', error)
        return { error: error instanceof Error ? error.message : 'Failed to delete maintenance schedule' }
    }
}
```

> Note: `updateMaintenanceSchedule` previously returned `void` and threw. Any existing caller expecting a throw must be updated to read the returned object. Check with:
> `grep -rn "updateMaintenanceSchedule" src/ --include=*.tsx`

- [ ] **Step 3: Add a regression assertion for the closed gap**

Append inside `main()` in `scripts/verify-maintenance-edits.ts`, before the final summary:

```ts
    console.log('\nSchedule delete leaves service history intact (spec: behaviour rules)');
    {
        const truck = await makeTruck(0);
        const schedule = await prisma.maintenanceSchedule.create({
            data: { truckId: truck.id, type: 'Oil Change', intervalType: 'date', intervalDays: 90, approvalStatus: 'Approved' },
        });
        const record = await prisma.maintenanceRecord.create({
            data: { truckId: truck.id, date: new Date('2026-02-01'), type: 'Oil Change', cost: 75, approvalStatus: 'Approved', scheduleId: schedule.id },
        });

        const created = await createRequest({ name: 'Verify Manager', role: 'Manager' }, 'maintenance_schedule', schedule.id, 'delete', {});
        if (!('success' in created)) throw new Error('setup failed');
        await approveRequest({ name: 'Verify Admin', role: 'Super Admin' }, created.requestId);

        check('schedule deleted', await prisma.maintenanceSchedule.findUnique({ where: { id: schedule.id } }), null);
        const survivor = await prisma.maintenanceRecord.findUnique({ where: { id: record.id } });
        check('service history survives', survivor?.cost, 75);
        check('dangling scheduleId left as-is', survivor?.scheduleId, schedule.id);
        await cleanup();
    }
```

- [ ] **Step 4: Run verification and typecheck**

Run: `npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/verify-maintenance-edits.ts`
Expected: `PASS`

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors in `trucks.ts`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/trucks.ts scripts/verify-maintenance-edits.ts
git commit -m "feat: maintenance record and schedule edit/delete entry points

Also closes the gap where updateMaintenanceSchedule was gated only on
manage_maintenance, letting a Manager change an approved schedule with no
sign-off."
```

---

### Task 7: Data fetching for the UI

**Files:**
- Modify: `src/lib/actions/trucks.ts` (`getTruck` :65, `getPendingMaintenanceApprovals` :325)

**Interfaces:**
- Consumes: the `EditRequest` model from Task 1.
- Produces: `getTruck` returns `truck.editRequests: EditRequest[]` (pending only, both entity types, filtered by viewer). `getPendingMaintenanceApprovals` returns `{ records, schedules, editRequests }`.

- [ ] **Step 1: Include pending edit requests in `getTruck`**

Replace the body of `getTruck` in `src/lib/actions/trucks.ts` with:

```ts
export async function getTruck(id: string) {
    const truck = await prisma.truck.findUnique({
        where: { id },
        include: {
            maintenanceRecords: { orderBy: { date: 'desc' } },
            maintenanceSchedules: { orderBy: { nextDueDate: 'asc' } },
            parts: { orderBy: { installedDate: 'desc' } },
            fuelLogs: { orderBy: { date: 'desc' }, take: 10 },
            documents: { orderBy: { createdAt: 'desc' } },
        },
    })

    if (!truck) return null

    // EditRequest has no FK to the truck - it is polymorphic - so pending requests are
    // fetched by the ids on this page and attached for the client to badge rows with.
    //
    // Visibility: approvers see every request; everyone else sees only their own, so a
    // requester can tell a submitted change from a landed one without exposing other
    // people's pending edits to the whole Fleet page.
    const session = await auth()
    const viewer = session?.user?.name || session?.user?.email || null
    const canApprove = session?.user?.role
        ? hasPermission(session.user.role, 'approve_maintenance')
        : false

    const editRequests = await prisma.editRequest.findMany({
        where: {
            status: 'Pending',
            ...(canApprove ? {} : { requestedBy: viewer ?? '__none__' }),
            OR: [
                { entityType: 'maintenance_record', entityId: { in: truck.maintenanceRecords.map((r) => r.id) } },
                { entityType: 'maintenance_schedule', entityId: { in: truck.maintenanceSchedules.map((s) => s.id) } },
            ],
        },
        orderBy: { createdAt: 'desc' },
    })

    return { ...truck, editRequests }
}
```

> `getTruck` did not previously call `auth()`. Confirm `auth` and `hasPermission` are
> imported at the top of `trucks.ts` - both already are, used by other actions in the file.

- [ ] **Step 2: Add edit requests to the approvals queue**

In `getPendingMaintenanceApprovals` (:325), change the `Promise.all` to fetch a third list and widen the return:

```ts
    const [records, schedules, editRequests] = await Promise.all([
        prisma.maintenanceRecord.findMany({
            where: { approvalStatus: 'Pending' },
            include: { truck: true },
            orderBy: { createdAt: 'desc' },
        }),
        prisma.maintenanceSchedule.findMany({
            where: { approvalStatus: 'Pending' },
            include: { truck: true },
            orderBy: { createdAt: 'desc' },
        }),
        prisma.editRequest.findMany({
            where: {
                status: 'Pending',
                entityType: { in: ['maintenance_record', 'maintenance_schedule'] },
            },
            orderBy: { createdAt: 'desc' },
        }),
    ])

    return { records, schedules, editRequests }
```

Also update the early return for non-approvers at the top of the same function:

```ts
        return { records: [], schedules: [], editRequests: [] }
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: errors only where a consumer destructures the old two-key shape — fix each to include `editRequests`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/actions/trucks.ts
git commit -m "feat: surface pending edit requests on the truck page and approvals queue"
```

---

### Task 8: Modals in edit mode

**Files:**
- Modify: `src/components/trucks/AddMaintenanceModal.tsx`
- Modify: `src/components/trucks/ScheduleMaintenanceModal.tsx`

**Interfaces:**
- Consumes: `updateMaintenanceRecord`, `updateMaintenanceSchedule` from Task 6.
- Produces: both modals accept an optional `record` / `schedule` prop; when present they edit rather than create.

- [ ] **Step 1: Add the edit prop to `AddMaintenanceModal`**

In `src/components/trucks/AddMaintenanceModal.tsx`:

Change the import line to add the update action:

```ts
import { createMaintenanceRecord, updateMaintenanceRecord } from '@/lib/actions/trucks'
```

Replace the `SubmitButton` and props interface with:

```tsx
function SubmitButton({ needsApproval, isEditing }: { needsApproval: boolean; isEditing: boolean }) {
    const { pending } = useFormStatus()
    const label = needsApproval
        ? 'Submit for Approval'
        : isEditing
            ? 'Save changes'
            : 'Add Maintenance Record'
    return (
        <button
            type="submit"
            disabled={pending}
            className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all font-semibold shadow-lg shadow-blue-500/25 disabled:opacity-50"
        >
            {pending ? 'Saving...' : label}
        </button>
    )
}

interface MaintenanceRecordData {
    id: string
    type: string
    date: Date | string
    cost: number
    mileageAtService: number | null
    status: string
    notes: string | null
    performedBy: string | null
}

interface AddMaintenanceModalProps {
    truckId: string
    truckMileage: number
    /** False when this user's records queue for someone else to sign off. */
    canApprove?: boolean
    /** Present to edit an existing record instead of creating one. */
    record?: MaintenanceRecordData
    onClose: () => void
}
```

- [ ] **Step 2: Branch the submit handler**

Replace the component signature and `handleSubmit`:

```tsx
export default function AddMaintenanceModal({ truckId, truckMileage, canApprove = false, record, onClose }: AddMaintenanceModalProps) {
    const isEditing = Boolean(record)
    const [mileage, setMileage] = useState((record?.mileageAtService ?? truckMileage).toString())
    const [error, setError] = useState<string | null>(null)
    const needsApproval = !canApprove

    const handleSubmit = async (formData: FormData) => {
        setError(null)
        const result = record
            ? await updateMaintenanceRecord(record.id, formData)
            : await createMaintenanceRecord(formData)
        if ('error' in result) {
            setError(result.error)
            return
        }
        onClose()
    }
```

- [ ] **Step 3: Prefill the fields**

In the same file, add `defaultValue` to each input so an edit opens populated. The heading should also reflect the mode — change the `<h2>` text to:

```tsx
{isEditing ? 'Edit Maintenance Record' : 'Add Maintenance Record'}
```

Add to each control (matching the existing `name` attributes):

- `name="type"` → `defaultValue={record?.type ?? ''}`
- `name="date"` → `defaultValue={record ? new Date(record.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]}`
- `name="cost"` → `defaultValue={record?.cost ?? ''}`
- `name="status"` → `defaultValue={record?.status ?? 'Completed'}`
- `name="notes"` → `defaultValue={record?.notes ?? ''}`
- `name="performedBy"` → `defaultValue={record?.performedBy ?? ''}`

The mileage input is already controlled by the `mileage` state initialised in Step 2, so it needs no `defaultValue`.

Update the `<SubmitButton />` usage to `<SubmitButton needsApproval={needsApproval} isEditing={isEditing} />`.

- [ ] **Step 4: Apply the same treatment to `ScheduleMaintenanceModal`**

In `src/components/trucks/ScheduleMaintenanceModal.tsx`, repeat Steps 1–3 with:
- import `updateMaintenanceSchedule` alongside `createMaintenanceSchedule`
- prop `schedule?: { id: string; nextDueDate: Date | string | null; nextDueMileage: number | null; isActive: boolean }`
- `const isEditing = Boolean(schedule)`
- submit branches to `updateMaintenanceSchedule(schedule.id, formData)` when `schedule` is present
- button label `'Save changes'` when editing and not needing approval, `'Submit for Approval'` when it does, `'Schedule Maintenance'` otherwise
- heading `{isEditing ? 'Edit Schedule' : 'Schedule Maintenance'}`
- `defaultValue` on `nextDueDate`, `nextDueMileage`, and `isActive`

> `updateMaintenanceSchedule` now returns an object rather than throwing (Task 6), so the handler reads `'error' in result` exactly as the record modal does.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors in either modal.

- [ ] **Step 6: Commit**

```bash
git add src/components/trucks/AddMaintenanceModal.tsx src/components/trucks/ScheduleMaintenanceModal.tsx
git commit -m "feat: edit mode for maintenance record and schedule modals"
```

---

### Task 9: Row actions, diff view, and odometer provenance

**Files:**
- Create: `src/components/trucks/EditRequestCell.tsx`
- Modify: `src/components/trucks/TruckDetailsClient.tsx`

**Interfaces:**
- Consumes: `approveEditRequest`, `rejectEditRequest` from Task 5; `deleteMaintenanceRecord`, `deleteMaintenanceSchedule` from Task 6; `truck.editRequests` from Task 7.
- Produces: `EditRequestCell` rendering the pending-edit badge and, for approvers, a field/current/proposed diff with approve and reject controls.

- [ ] **Step 1: Build the diff cell**

Create `src/components/trucks/EditRequestCell.tsx`:

```tsx
'use client'

import { useState, useTransition } from 'react'
import { Check, X, Clock, Loader2, Pencil, Trash2 } from 'lucide-react'
import { approveEditRequest, rejectEditRequest } from '@/lib/actions/edit-requests'

export interface PendingEditRequest {
    id: string
    operation: string
    requestedBy: string
    proposedChanges: unknown
    previousValues: unknown
}

/**
 * True when the live row moved between the request being raised and now, so the
 * approver is about to overwrite values they never saw. Mirrors isStale() in
 * src/lib/edit-requests.ts, over the fields the request actually carries.
 */
function isStale(previous: Record<string, unknown>, current: Record<string, unknown>): boolean {
    return Object.keys(previous).some(
        (field) => JSON.stringify(previous[field]) !== JSON.stringify(current[field]),
    )
}

const FIELD_LABELS: Record<string, string> = {
    type: 'Type',
    date: 'Date',
    cost: 'Cost',
    mileageAtService: 'Mileage',
    status: 'Status',
    notes: 'Notes',
    performedBy: 'Performed by',
    intervalType: 'Interval type',
    intervalDays: 'Interval (days)',
    intervalMileage: 'Interval (km)',
    nextDueDate: 'Next due',
    nextDueMileage: 'Next due (km)',
    priority: 'Priority',
    isActive: 'Active',
}

function display(value: unknown): string {
    if (value === null || value === undefined || value === '') return '—'
    if (typeof value === 'boolean') return value ? 'Yes' : 'No'
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
        return new Date(value).toLocaleDateString()
    }
    return String(value)
}

/**
 * The pending-edit state on a maintenance row. Everyone with the row in view sees that
 * a change is waiting; only approvers get the diff and the controls.
 */
export default function EditRequestCell({
    request,
    canApprove,
    current,
}: {
    request: PendingEditRequest
    canApprove: boolean
    /** The live row's whitelisted values right now, for the staleness check. */
    current: Record<string, unknown>
}) {
    const [isPending, startTransition] = useTransition()
    const [rejecting, setRejecting] = useState(false)
    const [reason, setReason] = useState('')
    const [error, setError] = useState<string | null>(null)

    const isDelete = request.operation === 'delete'
    const proposed = (request.proposedChanges ?? {}) as Record<string, unknown>
    const previous = (request.previousValues ?? {}) as Record<string, unknown>
    const changedFields = Object.keys(proposed).filter(
        (field) => JSON.stringify(proposed[field]) !== JSON.stringify(previous[field]),
    )
    const stale = canApprove && !isDelete && isStale(previous, current)

    const run = (action: () => Promise<{ success: true } | { error: string }>) => {
        setError(null)
        startTransition(async () => {
            const result = await action()
            if ('error' in result) {
                setError(result.error)
                return
            }
            setRejecting(false)
            setReason('')
        })
    }

    return (
        <div className="max-w-[20rem]">
            <span
                className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full ${
                    isDelete ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                }`}
            >
                {isDelete ? <Trash2 size={12} /> : <Pencil size={12} />}
                {isDelete ? 'Deletion pending approval' : 'Edit pending approval'}
            </span>
            <p className="text-xs text-gray-500 mt-1 truncate">by {request.requestedBy}</p>

            {stale && (
                <p className="text-xs text-orange-600 mt-1">
                    This record changed after the request was raised - approving overwrites the newer values.
                </p>
            )}

            {canApprove && !isDelete && changedFields.length > 0 && (
                <table className="mt-2 w-full text-xs border border-gray-200 rounded-lg overflow-hidden">
                    <thead className="bg-gray-50 text-gray-500">
                        <tr>
                            <th className="px-2 py-1 text-left font-medium">Field</th>
                            <th className="px-2 py-1 text-left font-medium">Current</th>
                            <th className="px-2 py-1 text-left font-medium">Proposed</th>
                        </tr>
                    </thead>
                    <tbody>
                        {changedFields.map((field) => (
                            <tr key={field} className="border-t border-gray-100">
                                <td className="px-2 py-1 text-gray-600">{FIELD_LABELS[field] ?? field}</td>
                                <td className="px-2 py-1 text-gray-500 line-through">{display(previous[field])}</td>
                                <td className="px-2 py-1 text-gray-900 font-medium">{display(proposed[field])}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}

            {canApprove && !rejecting && (
                <div className="flex items-center gap-1.5 mt-2">
                    <button
                        type="button"
                        onClick={() => run(() => approveEditRequest(request.id))}
                        disabled={isPending}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                    >
                        {isPending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                        Approve
                    </button>
                    <button
                        type="button"
                        onClick={() => { setRejecting(true); setError(null) }}
                        disabled={isPending}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white border border-gray-200 text-gray-600 text-xs font-medium rounded-lg hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors disabled:opacity-50"
                    >
                        Reject
                    </button>
                </div>
            )}

            {canApprove && rejecting && (
                <div className="mt-2 space-y-1.5">
                    <input
                        type="text"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        autoFocus
                        placeholder="Reason for rejection"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && reason.trim()) run(() => rejectEditRequest(request.id, reason))
                            if (e.key === 'Escape') setRejecting(false)
                        }}
                        className="w-full px-2.5 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:border-red-400 focus:ring-2 focus:ring-red-500/10 outline-none transition-all"
                    />
                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            onClick={() => run(() => rejectEditRequest(request.id, reason))}
                            disabled={isPending || !reason.trim()}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                        >
                            {isPending ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
                            Confirm
                        </button>
                        <button
                            type="button"
                            onClick={() => setRejecting(false)}
                            className="px-2.5 py-1.5 text-xs text-gray-500 hover:text-gray-700"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
            {!canApprove && (
                <p className="text-xs text-gray-400 mt-1 inline-flex items-center gap-1">
                    <Clock size={11} /> Waiting on a Super Admin
                </p>
            )}
        </div>
    )
}
```

- [ ] **Step 2: Wire it into the record rows**

In `src/components/trucks/TruckDetailsClient.tsx`:

Add to the imports:

```tsx
import EditRequestCell, { type PendingEditRequest } from './EditRequestCell'
import { deleteMaintenanceRecord, deleteMaintenanceSchedule } from '@/lib/actions/trucks'
```

`Trash2` and `Edit` are already imported in this file; `updateMaintenanceRecord` is not
needed here because the modal calls it.

Add `editRequests` to the `TruckData` interface:

```ts
    editRequests: {
        id: string
        entityType: string
        entityId: string
        operation: string
        requestedBy: string
        proposedChanges: unknown
        previousValues: unknown
    }[]
```

Inside the component body, before the return, build a lookup:

```tsx
    const pendingEditFor = new Map<string, PendingEditRequest>(
        (truck.editRequests ?? []).map((r) => [r.entityId, r as PendingEditRequest]),
    )
    const [editingRecord, setEditingRecord] = useState<TruckData['maintenanceRecords'][number] | null>(null)
    const [editingSchedule, setEditingSchedule] = useState<TruckData['maintenanceSchedules'][number] | null>(null)
    // The component body has no transition of its own - ApprovalCell owns a separate one.
    const [isRowActionPending, startRowAction] = useTransition()
```

`useTransition` is already imported at the top of the file.

- [ ] **Step 3: Add the edit and delete row actions**

In the maintenance records table (the `truck.maintenanceRecords.map(...)` block at :458), replace the final `<td>` holding notes with two cells — notes, then actions:

```tsx
                                            <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                                                {record.notes || '-'}
                                            </td>
                                            <td className="px-6 py-4">
                                                {pendingEditFor.has(record.id) ? (
                                                    <EditRequestCell
                                                        request={pendingEditFor.get(record.id)!}
                                                        canApprove={can('approve_maintenance')}
                                                        current={{
                                                            type: record.type,
                                                            date: new Date(record.date).toISOString(),
                                                            cost: record.cost,
                                                            mileageAtService: record.mileageAtService,
                                                            status: record.status,
                                                            notes: record.notes,
                                                            performedBy: record.performedBy,
                                                        }}
                                                    />
                                                ) : can('manage_maintenance') && record.approvalStatus !== 'Rejected' ? (
                                                    <div className="flex items-center gap-1.5">
                                                        <button
                                                            type="button"
                                                            onClick={() => setEditingRecord(record)}
                                                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                            title="Edit record"
                                                        >
                                                            <Edit size={15} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            disabled={isRowActionPending}
                                                            onClick={() => {
                                                                startRowAction(async () => {
                                                                    await deleteMaintenanceRecord(record.id)
                                                                })
                                                            }}
                                                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                            title="Delete record"
                                                        >
                                                            <Trash2 size={15} />
                                                        </button>
                                                    </div>
                                                ) : null}
                                            </td>
```

Increase the header row's column count by one and add a matching `<th>` labelled `Actions`, and change the empty-state `colSpan={7}` to `colSpan={8}`.

- [ ] **Step 4: Render the edit modal**

Near the other modals at the end of the component (around :793), add:

```tsx
            {editingRecord && (
                <AddMaintenanceModal
                    truckId={truck.id}
                    truckMileage={truck.mileage}
                    canApprove={can('approve_maintenance')}
                    record={editingRecord}
                    onClose={() => setEditingRecord(null)}
                />
            )}
```

- [ ] **Step 5: Apply the same to schedule rows**

Repeat Steps 3–4 for the `maintenanceSchedules` table (around :621), using `deleteMaintenanceSchedule` and `ScheduleMaintenanceModal` with a `schedule` prop, and the same `pendingEditFor` lookup.

- [ ] **Step 6: Show odometer provenance**

The spec requires `manualMileageAt` to be surfaced, not merely stored. Add `manualMileage: number | null` and `manualMileageAt: Date | null` to the `TruckData` interface, then in the stat block that renders `truck.mileage` (near the `Gauge` icon), add beneath the figure:

```tsx
{truck.manualMileageAt && truck.manualMileage === truck.mileage && (
    <p className="text-xs text-gray-400 mt-0.5">
        manual entry, {new Date(truck.manualMileageAt).toLocaleDateString()}
    </p>
)}
```

- [ ] **Step 7: Typecheck and build**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 8: Full verification**

Run: `npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/verify-maintenance-edits.ts`
Expected: `PASS - all assertions held`

Run: `npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/verify-rbac.ts`
Expected: `PASS - all assertions held` (regression check — this change adds no permission)

- [ ] **Step 9: Commit**

```bash
git add src/components/trucks/EditRequestCell.tsx src/components/trucks/TruckDetailsClient.tsx
git commit -m "feat: maintenance row edit/delete actions with approver diff view"
```

---

## Manual QA

After Task 9, verify in the running app (`npm run dev`):

1. Sign in as a **Manager**. Open a truck with an approved maintenance record. Edit the cost → the button reads "Submit for Approval", the row shows "Edit pending approval", and the displayed cost is unchanged.
2. Attempt a second edit on the same row → refused, naming the open request.
3. Sign in as **Super Admin**. The same row shows a Field / Current / Proposed table. Approve → the value updates and the badge clears.
4. As Super Admin, edit a record directly → it saves immediately with no request.
5. As Manager, delete a record → "Deletion pending approval". As Super Admin, reject with a reason → the record survives and the requester is notified.
6. Correct a record's mileage from an inflated value downward, approve, then log a fuel fill above the corrected reading → the fuel log records a non-null efficiency.
