# Maintenance edit & delete approvals

**Date:** 2026-08-31
**Status:** Approved, ready for implementation planning

## Problem

Maintenance records cannot be edited by anyone today — there is no `updateMaintenanceRecord`
action in `src/lib/actions/trucks.ts`, and no delete action either. A typo in a cost or an
odometer reading is permanent.

Separately, `updateMaintenanceSchedule` (`src/lib/actions/trucks.ts:563`) is gated only on
`manage_maintenance`. A Manager can therefore change an approved schedule's `nextDueDate`,
`nextDueMileage`, and `isActive` with no sign-off — an approve-by-the-back-door that undercuts
the creation-approval flow built in `spec-repairs-and-approvals.md` Feature 3.

## Goal

Super Admins edit and delete maintenance records and schedules directly. Everyone else who can
create maintenance (`manage_maintenance`, today: Manager) submits an edit or delete **request**
that a Super Admin approves or rejects.

## Why this needs a new mechanism

Every existing approval flow in this codebase approves a **creation**: the new row itself carries
`approvalStatus: "Pending"` and stays inert until signed off. An **edit** is structurally
different — the live record already exists and must keep serving its current values while a
proposed change waits. There is nowhere in the schema today to park proposed-but-unapproved
values.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Where pending edits live | Generic `EditRequest` table, JSON payload | Reusable beyond maintenance; preserves full history of every proposal |
| Scope | Records + schedules + deletion | Also closes the ungated `updateMaintenanceSchedule` gap |
| Truck side effects | Recompute both `lastServiceDate` and `mileage` | Corrections must be able to move values downward |
| Who may request | `manage_maintenance` holders | You cannot request a change to something you could not have created |
| New permission | None | Reuses `manage_maintenance` (request) and `approve_maintenance` (approve) |

## Data model

New table. No foreign keys — `entityType`/`entityId` is polymorphic, matching the codebase's
existing string-reference convention (`User.role` stores a name, `InventoryItem.category` is a
string, `MaintenanceRecord.scheduleId` is a bare id).

```prisma
model EditRequest {
  id              String    @id @default(cuid())
  entityType      String    // "maintenance_record" | "maintenance_schedule"
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
If the live record changed between request and approval, the approver is warned rather than
silently clobbering the newer values.

Because there is no FK, an `EditRequest` can outlive its target (for example after an approved
delete). This is intentional — the audit trail survives. Every read path must tolerate a missing
entity and render it as "record deleted".

### Truck columns

Two nullable additions to `Truck`, so a manually entered odometer reading survives recompute:

```prisma
manualMileage   Int?
manualMileageAt DateTime?
```

`Truck.mileage` has three writers. Two of them already keep a queryable history in their own
tables — `MaintenanceRecord.mileageAtService` and `FuelLog.mileage`. The third, the mileage field
on the Add/Edit Truck forms (via `updateTruck`, `trucks.ts:111`), keeps none: it clobbers the
column and leaves no trace of where the number came from.

That is the only gap these columns close. `updateTruck` writes `manualMileage` and
`manualMileageAt` alongside `mileage`, so a dash reading typed into the Edit Truck form survives
the next recompute. Without them a legitimate manual `80000` is pulled back to the highest
maintenance or fuel reading, and the next fill computes a 21,000 km tank.

`manualMileageAt` must be *surfaced*, not merely stored — the truck detail page shows odometer
provenance ("80,000 km — manual entry, 31 Aug"). If that display is cut, cut the column with it.

A `MileageReading` event log was considered and rejected: it would duplicate two-thirds of its own
contents from `FuelLog` and `MaintenanceRecord` to give provenance to the one low-volume source
that lacks it.

## Field whitelists — security critical

A generic JSON blob merged into `prisma.update()` is a mass-assignment vulnerability: a crafted
`proposedChanges` could set `approvalStatus: "Approved"`, reassign `truckId`, or forge
`approvedBy`. The generic core therefore **never merges blindly**. Each entity type registers an
applier with an explicit whitelist, and anything outside it is stripped **at request time**, not
at approval time.

**`maintenance_record`** — editable: `type`, `date`, `cost`, `mileageAtService`, `status`,
`notes`, `performedBy`

**`maintenance_schedule`** — editable: `type`, `intervalType`, `intervalDays`, `intervalMileage`,
`nextDueDate`, `nextDueMileage`, `priority`, `isActive`, `notes`

Never writable through this path, for either entity: `id`, `truckId`, `approvalStatus`,
`requestedBy`, `approvedBy`, `approvedAt`, `rejectionReason`, `scheduleId`, `createdAt`,
`updatedAt`.

## Code layout

`src/lib/actions/trucks.ts` is already ~1,130 lines. The generic core goes in a new file; the
maintenance-specific entry points stay in `trucks.ts` and delegate to it.

### New: `src/lib/actions/edit-requests.ts`

```ts
interface EntityApplier {
  requestPermission: Permission      // 'manage_maintenance'
  approvePermission: Permission      // 'approve_maintenance'
  editableFields: readonly string[]
  load(id: string): Promise<Record<string, unknown> | null>
  applyUpdate(id: string, changes: Record<string, unknown>): Promise<void>
  applyDelete(id: string): Promise<void>
  describe(entity: Record<string, unknown>): string   // for notification text
  onApplied?(entity: Record<string, unknown>): Promise<void>  // truck recompute
}

const APPLIERS: Record<string, EntityApplier>
```

Actions, all returning `{ success: true } | { error: string }`:

- `createEditRequest(entityType, entityId, operation, rawChanges)`
- `approveEditRequest(id)`
- `rejectEditRequest(id, reason)` — reason required
- `getEditRequestsFor(entityType, entityId)`
- `getPendingEditRequests()`

Coercion note: `proposedChanges` round-trips through JSON, so `Date` fields arrive back as ISO
strings. Each applier is responsible for coercing its own field types before writing.

### Changed: `src/lib/actions/trucks.ts`

| Action | Status |
|---|---|
| `updateMaintenanceRecord(id, formData)` | new |
| `deleteMaintenanceRecord(id, reason)` | new |
| `updateMaintenanceSchedule(id, formData)` | retrofit — add the approval split, closing the gap |
| `deleteMaintenanceSchedule(id)` | new |
| `updateTruckMileage(id, mileage)` | **delete** — see below |

`updateTruckMileage` (`trucks.ts:134`) has zero callers anywhere in `src/`, and no permission check
at all. It is an ungated write path to a value that feeds every fuel efficiency figure. Remove it
rather than carry it through this change.

Each follows the shape `createMaintenanceRecord` already uses: caller holds `approve_maintenance`
→ apply immediately; otherwise → create an `EditRequest` and `notifyApprovers()`.

## Behaviour rules

**Which records route through EditRequest.** Only records whose own `approvalStatus` is
`"Approved"`. A record still `"Pending"` has taken no effect and already awaits approval, so its
requester edits or deletes it in place — this applies to deletion as well as edits. A
`"Rejected"` record is not editable; create a new one.

**Visibility.** Approvers see every edit request. A requester sees their own, on the rows they
affect, so they can tell a submitted change from a landed one. Nobody else sees them.

**Deleting a schedule** leaves any `MaintenanceRecord.scheduleId` pointing at it dangling. That is
already the intended behaviour — the schema comment at `prisma/schema.prisma:67` states the
schedule may be deleted while its service history stays — so the delete applier must not cascade
into records.

**Concurrent edits are blocked.** A second request against an entity that already has a `Pending`
one returns a clear error naming who holds the open request. No silent supersede.

**Self-approval.** A Super Admin editing directly needs no request. A `manage_maintenance` holder
who also gains `approve_maintenance` later is treated as an approver — the check is on the
permission, never on the role name.

**Rejected requests** stay in the table for audit with their reason. The live record is untouched.

## Truck value recompute

Replaces `applyMaintenanceRecordToTruck` entirely, so exactly one function derives truck values
instead of two paths that can disagree.

```
recomputeTruckDerivedValues(truckId):
  lastServiceDate = max(date) over Approved maintenance records for the truck   // null if none
  mileage         = max(
                      max(mileageAtService) over Approved maintenance records,
                      max(mileage) over that truck's fuel logs,
                      truck.manualMileage
                    )
```

`lastServiceDate` is safe to derive outright — `applyMaintenanceRecordToTruck` is currently its
only writer (`trucks.ts:233`).

`mileage` is **not** derived from maintenance alone. Fuel logs write `Truck.mileage` on every fill
(`src/lib/actions/fuel.ts:75`) and feed efficiency calculations. Recomputing from maintenance
records only would let a corrected record drop the odometer below a fuel reading already used in
those figures. Taking the max across all three sources still corrects downward when a typo'd
`500000` is fixed or a bad record is deleted, without corrupting fuel data.

Called after: approving a record creation, approving an update, approving a delete, and any direct
Super Admin edit or delete.

### Why downward correction matters

Today `Truck.mileage` only ever moves forward: fuel writes it only when the new reading is higher
(`fuel.ts:75`), and `applyMaintenanceRecordToTruck` is forward-only by construction
(`trucks.ts:224`). This recompute introduces the first downward path in the system, and it repairs
a live failure rather than risking one.

Fuel efficiency is a delta against the odometer at the moment of the fill:

```ts
// fuel.ts:68
const efficiency = mileage > truck.mileage ? (mileage - truck.mileage) / liters : null
```

So a typo'd `500000` does not merely display wrongly — it makes that comparison false on every
subsequent fill, and efficiency silently records as `null` from then on, visible only as a gap in
the fuel report. Correcting the odometer downward is what restores it.

### Historical efficiency is not rewritten

`FuelLog.efficiency` is frozen at write time. Recomputing the odometer fixes *future* efficiency
figures and never past rows. This is deliberate: those values were correct against what was known
when they were written, and retroactively rewriting reported figures on an odometer correction is
worse than the inconsistency. Do not add a backfill pass.

Editing or deleting a **fuel log** does not trigger recompute — fuel edit approval is out of scope
here, and no such path exists today.

## Notifications

Three new `NotificationType` members in `src/lib/actions/notifications.ts`, with matching
`NOTIFICATION_CONFIG` entries:

```ts
maintenance_edit_pending:  { defaultPriority: 'high', requiredPermissions: ['approve_maintenance'] }
maintenance_edit_approved: { defaultPriority: 'medium' }
maintenance_edit_rejected: { defaultPriority: 'medium' }
```

`notifyApprovers` currently accepts a narrow union of five type literals (`notifications.ts:487`);
add `maintenance_edit_pending` to it. Decisions go back via `notifyRequester`, resolving the user
id with the existing `findRequesterId` helper (`trucks.ts:348`).

New `entityType` value `"edit_request"` for click-through navigation.

## Approvals queue

Extend `getPendingMaintenanceApprovals()` (`trucks.ts:325`) to return a third array, `editRequests`,
alongside `records` and `schedules`, so a Super Admin clears every pending maintenance item from one
place. It already returns empty for non-approvers; keep that guard.

## UI

**Modal.** Extend `AddMaintenanceModal` with an optional `record` prop rather than adding a
near-duplicate component. It already carries the `canApprove` / `needsApproval` pattern driving
its button label; in edit mode the label becomes "Save changes" for approvers and "Submit for
Approval" for everyone else. Same treatment for `ScheduleMaintenanceModal`.

**Rows.** In `TruckDetailsClient.tsx`, maintenance record and schedule rows gain Edit and Delete
actions, visible to `manage_maintenance` holders. A row with an open edit request shows an amber
"Edit pending approval" pill and its actions are disabled.

**Diff view.** Approvers see a field / current / proposed table built from `previousValues` and
`proposedChanges`, with Approve and Reject buttons. Reject requires a reason. When the live record
has moved since the request, the row is flagged as stale with the current value shown.

Delete requests render as a full-record summary marked for deletion rather than a field diff.

## Verification

This repo has no test framework — verification is script-based, following
`scripts/verify-rbac.ts`. Add `scripts/verify-maintenance-edits.ts` asserting:

1. A Manager's edit leaves the live record byte-identical and creates a `Pending` EditRequest.
2. A Super Admin's edit applies immediately with no EditRequest row.
3. Approving an update applies exactly the whitelisted fields and recomputes truck values.
4. Approving a delete removes the record and recomputes truck values.
5. Rejecting leaves the live record untouched and preserves the reason.
6. A second concurrent request against the same entity is refused.
7. `proposedChanges` containing `approvalStatus`, `truckId`, or `approvedBy` has them stripped.
8. Recompute never lowers `Truck.mileage` below the highest fuel-log reading.
9. A schedule edit by a Manager no longer writes directly (regression on the closed gap).
10. A manual odometer reading entered via `updateTruck` survives a subsequent recompute.
11. Correcting a typo'd `mileageAtService` downward restores a non-null `efficiency` on the next
    fuel fill for that truck.

Extend `scripts/verify-rbac.ts` to assert `manage_maintenance` and `approve_maintenance` resolve as
expected for all four built-in roles.

## Migration

One migration, `maintenance_edit_approvals`:

- create table `EditRequest` with both indexes
- add nullable `Truck.manualMileage`, `Truck.manualMileageAt`

No column is dropped. Removing `updateTruckMileage` is a code change only — it writes no column
that anything else stops using.

No backfill. Existing rows are unaffected — every new column is nullable and the new table starts
empty. No re-seed of `Role` rows is needed because no new permission is introduced.

## Out of scope

- Multi-step or multi-approver chains — one approval level.
- Edit approval for any module other than maintenance. The `EditRequest` table is built to
  generalise, but only the two maintenance appliers are registered here.
- Editing `Part`, `SparePart`, or truck documents.
- Email/SMS delivery — in-app plus existing web-push only.
