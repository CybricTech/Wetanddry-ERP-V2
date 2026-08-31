# Fuel log edit & delete approvals

**Date:** 2026-08-31
**Status:** Approved, ready for implementation planning

## Problem

Fuel logs cannot be corrected. `src/lib/actions/fuel.ts` has no `updateFuelLog` and no
`deleteFuelLog` — a `FuelLog` is only ever born inside `issueFuel` (`fuel.ts:52`), and once
written it is permanent. A mistyped odometer, a wrong litre figure, or a fill recorded against
the wrong truck stays wrong forever.

That permanence is not cosmetic. Fuel logs feed three separate derived figures:

- `FuelLog.efficiency`, frozen at write time as `(mileage - truck.mileage) / liters` (`fuel.ts:68`)
- `Truck.mileage`, moved forward on every fill (`fuel.ts:75`)
- current fuel stock and blended cost per litre, summed across every log by
  `getFuelStockPosition` (`fuel.ts:29`), plus cost aggregates in `finance.ts:39` and `finance.ts:224`

A single bad litre figure therefore misstates stock, cost, and reconciliation simultaneously.

## Goal

Anyone who can reach Diesel & Fuel Intelligence may propose an edit or a deletion of a fuel log.
The proposal changes nothing until an approver signs it off. On approval the record is updated —
or removed — and the figures this spec owns are brought back into agreement.

## Relationship to the maintenance spec

`2026-08-31-maintenance-edit-approvals-design.md` designed a generic `EditRequest` mechanism and
listed fuel explicitly as out of scope: *"Editing or deleting a fuel log does not trigger
recompute — fuel edit approval is out of scope here, and no such path exists today."*

That spec is approved but **not implemented**: there is no `EditRequest` model, no
`edit-requests.ts`, and no migration for it. This spec therefore builds the generic core to that
design, registering only a `fuel_log` applier. The two maintenance appliers slot in later with no
rework.

## Boundary: the truck odometer is not in this spec

Concurrent work owns `Truck.mileage` and odometer provenance. This spec **does not touch**:

- `Truck.mileage`, or any recompute of it
- `Truck.manualMileage` / `manualMileageAt` (proposed by the maintenance spec; not added here)
- `updateTruck` (`trucks.ts:111`)
- `applyMaintenanceRecordToTruck` (`trucks.ts:224`)
- `updateTruckMileage` (`trucks.ts:134`)
- the truck detail page

An earlier draft of this design pulled the odometer recompute forward. It has been carved out
whole. See [The odometer seam](#the-odometer-seam) for what that costs and where the two pieces
meet.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Sequencing | Build the generic core now, fuel applier only | Delivers the feature without a duplicate mechanism to reconcile later |
| Who may request | `view_fuel_logs` holders | The user's requirement: anyone with access to the page. Identical to the `log_fuel` set today |
| Who may approve | `approve_fuel_requests` holders | Super Admin only today; delegable from Settings → Roles with no code change |
| Scope | Edit **and** delete | Delete is also the only correct fix for a log recorded against the wrong truck |
| Efficiency recompute | Edited log **and its immediate chronological successor** | Exactly the rows whose inputs changed, never more |
| Truck odometer | **Deferred — owned by concurrent odometer work** | Avoids two changes writing the same column from different designs |
| New permission | None | Reuses `view_fuel_logs` (request) and `approve_fuel_requests` (approve) |

## Data model

`EditRequest` is taken verbatim from the maintenance spec so the two features share one table.
No foreign keys — `entityType`/`entityId` is polymorphic, matching the codebase's existing
string-reference convention.

```prisma
model EditRequest {
  id              String    @id @default(cuid())
  entityType      String    // "fuel_log" (later: "maintenance_record", "maintenance_schedule")
  entityId        String
  operation       String    @default("update")  // "update" | "delete"
  proposedChanges Json?     // null for a delete
  previousValues  Json?     // snapshot of the whitelisted fields at request time
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

`previousValues` earns its place twice: it renders the approver's diff, and it detects staleness.
If the live log changed between request and approval, the approver is warned rather than silently
clobbering the newer values.

Because there is no FK, an `EditRequest` outlives its target after an approved delete. This is
intentional — the audit trail survives the record. Every read path must tolerate a missing entity
and render it as "record deleted".

This is the only schema change in this spec. No `Truck` column is added or altered.

## Field whitelist — security critical

A generic JSON blob merged into `prisma.update()` is a mass-assignment vulnerability: a crafted
`proposedChanges` could reassign `truckId`, forge `efficiency`, or overwrite timestamps. The
generic core **never merges blindly**. Each entity type registers an applier with an explicit
whitelist, and anything outside it is stripped **at request time**, not at approval time.

**`fuel_log`** — editable: `date`, `liters`, `cost`, `mileage`

Never writable through this path: `id`, `truckId`, `equipmentId`, `efficiency`, `createdAt`,
`updatedAt`, and the `fuelRequest` relation.

`efficiency` is excluded because it is derived, not entered — it is recomputed on approval and
must never be settable by a requester. `truckId` and `equipmentId` are excluded because
reassigning a log across trucks would require recompute on two trucks and a second round of
approval reasoning; the correct fix for a wrong-truck log is to delete it and re-issue, which the
delete scope in this spec makes possible for the first time.

Coercion note: `proposedChanges` round-trips through JSON, so `date` arrives back as an ISO
string. The fuel applier coerces its own field types before writing.

## Code layout

### New: `src/lib/actions/edit-requests.ts`

The generic core, per the maintenance spec's interface:

```ts
interface EntityApplier {
  requestPermission: Permission      // 'view_fuel_logs'
  approvePermission: Permission      // 'approve_fuel_requests'
  editableFields: readonly string[]
  load(id: string): Promise<Record<string, unknown> | null>
  validate?(changes: Record<string, unknown>, current: Record<string, unknown>): Promise<string | null>
  applyUpdate(id: string, changes: Record<string, unknown>): Promise<void>
  applyDelete(id: string): Promise<void>
  describe(entity: Record<string, unknown>): string   // for notification text
  onApplied?(entityBefore: Record<string, unknown>): Promise<void>  // recompute hook
}

const APPLIERS: Record<string, EntityApplier>
```

`validate` is an addition to the maintenance interface. It is where the fuel stock guard lives
(see [Approval-time guards](#approval-time-guards)); maintenance appliers simply omit it.

`onApplied` receives the entity as it was **before** the change, because the recompute needs the
old `date` and `truckId` to locate the affected successor after a delete. It is also the seam the
odometer work plugs into later — see below.

Actions, all returning `{ success: true } | { error: string }`:

- `createEditRequest(entityType, entityId, operation, rawChanges)`
- `approveEditRequest(id)`
- `rejectEditRequest(id, reason)` — reason required
- `getEditRequestsFor(entityType, entityId)`
- `getPendingEditRequests()`

### New: `src/lib/fuel-metrics.ts`

`recomputeFuelLogEfficiency(logId)`. A plain server-side module rather than a `'use server'`
action file — nothing here is called from the client.

It writes `FuelLog.efficiency` and nothing else. It reads `FuelLog` and `MaintenanceRecord` rows
but **never reads or writes `Truck.mileage`**, which is what keeps it clear of the concurrent
odometer work.

Deliberately named `fuel-metrics`, not `truck-metrics`: the maintenance spec's
`recomputeTruckDerivedValues` is a different function with a different owner, and the two must not
be conflated in one file.

### Changed: `src/lib/actions/fuel.ts`

| Action | Status |
|---|---|
| `requestFuelLogEdit(id, formData)` | new — delegates to `createEditRequest` |
| `requestFuelLogDelete(id, reason)` | new — delegates to `createEditRequest` |
| `issueFuel` | unchanged — still the only creator of a `FuelLog` |

Approvers do not route through a request. Following the shape `createFuelRequest` already uses:
caller holds `approve_fuel_requests` → apply immediately; otherwise → create an `EditRequest` and
`notifyApprovers()`.

### Changed: `src/lib/actions/trucks.ts`

**Nothing.** This file is untouched by this spec.

## Behaviour rules

**Which logs are editable.** All of them. Unlike `MaintenanceRecord`, `FuelLog` has no
`approvalStatus` — a log only exists because an issuance was already approved, so there is no
inert state to exclude.

**Concurrent edits are blocked.** A second request against a log that already has a `Pending` one
returns a clear error naming who holds the open request. No silent supersede.

**Visibility.** Approvers see every edit request. A requester sees their own, on the rows they
affect, so they can tell a submitted change from a landed one. Nobody else sees them.

**Self-approval.** An approver editing directly needs no request. A `view_fuel_logs` holder who
later gains `approve_fuel_requests` is treated as an approver — the check is on the permission,
never on the role name. This is what makes "only Super Admin approves" true today and delegable
tomorrow without a code change.

**Rejected requests** stay in the table for audit with their reason. The live log is untouched.

**A request changes nothing.** Until approval, `liters`, `cost`, `mileage`, and `date` on the live
row are byte-identical, and every derived figure — stock, efficiency, odometer, finance aggregates
— is unmoved.

### Approval-time guards

Checked at approval, not at request time, because stock moves in between:

- **Stock.** An edit raising `liters` beyond current stock is refused, reusing
  `getFuelStockPosition` — the same guard `approveFuelRequest` already applies (`fuel.ts:283`).
  Lowering `liters` returns fuel to stock and is always allowed.
- **Staleness.** If the live row's whitelisted fields no longer match `previousValues`, the
  approver is shown the current value and must confirm. Approval never silently clobbers.

**Cost is not auto-recomputed from litres.** At issuance, cost defaults to
`costOf(liters, blendedCostPerLiter)`. On an edit the blended rate has since moved, so
recomputing would book a correction at today's rate rather than the rate on the day of the fill.
Both fields are edited explicitly.

## Recompute

### Efficiency

Triggered only when `mileage`, `liters`, or `date` changed. A cost-only correction leaves
`efficiency` alone — recomputing it would risk nulling a legitimate figure for no reason.

```
recomputeFuelLogEfficiency(logId):
  log = fuelLog(logId)
  if log.truckId is null or log.mileage is null:      // equipment fills carry no odometer
      efficiency = null; return
  baseline = max(
      max(mileage)          over that truck's other fuel logs with date < log.date,
      max(mileageAtService) over that truck's Approved maintenance records with date < log.date
  )
  efficiency = (baseline is not null and log.mileage > baseline)
                 ? (log.mileage - baseline) / log.liters
                 : null
```

This is a faithful reconstruction of the write-time formula. `issueFuel` compares against
`truck.mileage`, which is the running maximum across fuel and maintenance readings — that is what
`baseline` reconstructs at the log's own point in time, without reading `Truck` at all.

**First-fill caveat.** A log with no prior reading on its truck has `baseline = null` and
recomputes to `efficiency = null`, where `issueFuel` would have compared against whatever
`Truck.mileage` held at creation. That starting odometer is not recoverable after the fact.
Restricting recompute to edits that touch `mileage`, `liters`, or `date` keeps this from firing on
unrelated corrections, and a first fill has no meaningful km/L in any case.

### Which logs get recomputed — approach B

The edited log, **and its immediate chronological successor** on the same truck, ordered by
`(date asc, createdAt asc)`. Nothing else.

The successor's stored efficiency was computed as a delta from the edited log's mileage. When that
mileage moves — or when the log is deleted outright — the successor's inputs have changed, so it
is recomputed from its own baseline. A log two fills later has unchanged inputs and is left
frozen.

Approach A (edited log only) was rejected: it knowingly leaves the successor computed against a
number that exists nowhere. Approach C (full chain backfill) was rejected as contradicting the
maintenance spec's "Do not add a backfill pass" and rewriting historical reported figures.

### Historical efficiency is not rewritten

Beyond the edited log and its immediate successor, `FuelLog.efficiency` stays frozen. Those values
were correct against what was known when they were written. Retroactively rewriting reported
figures across a truck's history is worse than the inconsistency.

## The odometer seam

`Truck.mileage` is **not** recomputed when a fuel log edit is approved. This is a deliberate,
known limitation for as long as the concurrent odometer work is in flight.

**What still works.** The edited log's own efficiency is corrected, and its successor's. Stock,
blended cost, and finance aggregates all follow the corrected values. For an edit to `liters`,
`cost`, or `date`, nothing is left inconsistent.

**What does not.** Correcting a fuel log's `mileage` downward does not pull `Truck.mileage` back
with it. `issueFuel` only ever moves that column forward (`fuel.ts:75`), so a typo'd `500000`
already latched into `Truck.mileage` stays latched, and every *subsequent* fill continues to
compute `efficiency` as `null` because `mileage > truck.mileage` stays false. Correcting the log
fixes the log; it does not yet fix the truck.

**Where the two meet.** The `onApplied` hook on the fuel applier is the single call site. When the
odometer work lands a recompute — whether that is the maintenance spec's
`recomputeTruckDerivedValues` or something else — wiring it in is one line inside
`fuelLogApplier.onApplied`, with no change to the generic core, the whitelist, or the UI.

Until then, the fuel edit UI must not claim it corrects the truck's odometer, and the approver's
diff view shows only the log's own fields.

## Delete semantics

Deleting a fuel log is a retraction of an issuance, and every derived figure this spec owns
follows from that:

- **Stock rises.** `getFuelStockPosition` sums `fuelLog.liters` as issued volume, so removing the
  row returns its litres to stock. Correct: the fuel was never issued.
- **Finance aggregates drop.** `finance.ts:39` and `finance.ts:224` stop counting its cost.
- **Successor efficiency** is recomputed as above.
- **`Truck.mileage` is left alone**, per the seam above.
- **The `FuelRequest` link nulls itself.** `FuelRequest.fuelLog` is an optional relation with no
  explicit referential action (`schema.prisma:422`), so Prisma's default `SetNull` applies. The
  request stays `Approved` with `fuelLogId: null`, and `FuelRequestsTab` renders that state as
  "issuance record deleted". The request is not reopened or re-rejected — it *was* approved, and
  rewriting that history would be a lie. The `EditRequest` row carries the audit trail.

A delete request requires a reason, stored in `EditRequest.previousValues` alongside the full
field snapshot so the record can be described after it is gone.

## Notifications

Three new `NotificationType` members in `src/lib/actions/notifications.ts`, with matching
`NOTIFICATION_CONFIG` entries:

```ts
fuel_edit_pending:  { defaultPriority: 'high',   requiredPermissions: ['approve_fuel_requests'] }
fuel_edit_approved: { defaultPriority: 'medium' }
fuel_edit_rejected: { defaultPriority: 'medium' }
```

`notifyApprovers` currently accepts a narrow union of five type literals (`notifications.ts:487`);
add `fuel_edit_pending` to it. Decisions go back to the requester via `notifyRequester`.

New `entityType` value `"edit_request"` for click-through navigation — shared with the maintenance
spec, which introduces the same value.

## Approvals queue

`getAllPendingApprovals` (`src/lib/actions/approvals.ts:35`) gains a `fuelEditRequests` array so an
approver clears every pending item from one place. It already guards on permissions per section;
keep that shape.

## UI

**Fuel log rows.** In `FuelClient.tsx`'s issuance tab, each log row gains Edit and Delete actions,
visible to `view_fuel_logs` holders. A row with an open edit request shows an amber "Edit pending
approval" pill and its actions are disabled.

**Edit modal.** A new `EditFuelLogModal` carrying the `canApprove` / `needsApproval` pattern the
fuel modals already use: the submit label reads "Save changes" for approvers and "Submit for
Approval" for everyone else, so the user knows before clicking whether the change will land.

**Diff view.** `FuelRequestsTab` gains an Edit Requests section. Approvers see a field / current /
proposed table built from `previousValues` and `proposedChanges`, with Approve and Reject buttons.
Reject requires a reason. Where the live row has moved since the request, that field is flagged
stale with the current value shown.

Delete requests render as a full-log summary marked for deletion, plus the stated reason, rather
than a field diff.

**No truck detail page changes.** Odometer provenance belongs to the concurrent odometer work.

## Verification

This repo has no test framework — verification is script-based, following `scripts/verify-rbac.ts`.
Add `scripts/verify-fuel-edits.ts` asserting:

1. A `view_fuel_logs` holder's edit leaves the live log byte-identical and creates a `Pending`
   `EditRequest`.
2. Stock, efficiency, and finance aggregates are all unmoved while a request is pending.
3. An approver's edit applies immediately with no `EditRequest` row.
4. Approving an update writes exactly the whitelisted fields.
5. `proposedChanges` containing `truckId`, `equipmentId`, `efficiency`, or `id` has them stripped
   at request time.
6. Approving an edit that changes `mileage` recomputes both that log's efficiency and its
   immediate successor's — and leaves the log two fills later frozen.
7. A cost-only edit leaves `efficiency` untouched.
8. Approving a delete removes the log, returns its litres to stock, and nulls
   `FuelRequest.fuelLogId` while leaving the request `Approved`.
9. An edit raising `liters` above current stock is refused at approval.
10. A second concurrent request against the same log is refused.
11. Rejecting leaves the live log untouched and preserves the reason.
12. **No path in this feature writes `Truck.mileage`** — a regression guard on the boundary above.

Extend `scripts/verify-rbac.ts` to assert `view_fuel_logs` and `approve_fuel_requests` resolve as
expected for all four built-in roles.

## Migration

One migration, `fuel_log_edit_approvals`:

- create table `EditRequest` with both indexes

No column is added, altered, or dropped on any existing table. No backfill — the new table starts
empty.

**No role re-seed is needed.** This spec introduces no new permission, so `ROLE_PERMISSIONS` is
unchanged and `scripts/sync-role-permissions.ts` does not need to run.

## Debts to the maintenance spec

Tracked so the maintenance implementation knows what it inherits and what it still owes:

| Item | State after this spec |
|---|---|
| `EditRequest` table | Built. Maintenance registers two more appliers, no schema change |
| `edit-requests.ts` generic core | Built, plus a `validate` hook maintenance may ignore |
| `entityType: "edit_request"` for notifications | Built |
| `recomputeTruckDerivedValues` | **Still owed** — belongs to the odometer work, not here |
| `Truck.manualMileage` / `manualMileageAt` | **Still owed** — not added by this spec |
| `applyMaintenanceRecordToTruck` removal | **Still owed** |
| `updateTruckMileage` removal | **Still owed** — ungated, callerless, survives this spec |
| Maintenance record/schedule appliers | **Still owed** |

## Out of scope

- **The truck odometer in every form** — see the boundary section above.
- Edit approval for any module other than fuel logs.
- Editing `FuelRequest`, `FuelDeposit`, or `Equipment` records.
- Reassigning a log between trucks or to equipment — delete and re-issue instead.
- Multi-step or multi-approver chains — one approval level.
- Backfilling efficiency beyond the edited log's immediate successor.
- Email/SMS delivery — in-app plus existing web-push only.
