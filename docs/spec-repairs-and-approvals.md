# Implementation prompt: Custom categories, Inventory Repairs, Maintenance & Fuel approvals

Implement the four features below in the Wet & Dry ERP (Next.js App Router + Prisma/PostgreSQL +
NextAuth). Work through them in order — feature 1 is a small finish, features 2–4 build on each
other's approval conventions.

---

## Conventions you must follow

These are established patterns in this codebase. Match them; do not invent parallel mechanisms.

- **Server actions** live in `src/lib/actions/*.ts`, start with `'use server'`, and return
  `{ success: true } | { error: string }` (never throw for expected failures). They call
  `revalidatePath(...)` for every route they affect.
- **Authorisation** uses `hasPermission(role, permission)` / `checkPermission(role, permission)`
  from `src/lib/permissions.ts`. Every new server action must authorise before touching the DB.
- **Roles are database-backed** (`Role` model, `src/lib/roles.server.ts`) but `User.role` stores the
  role *name*, not an FK. Any new `Permission` union member must be added in three places:
  1. the `Permission` type in `src/lib/permissions.ts`,
  2. the relevant arrays in `ROLE_PERMISSIONS`,
  3. re-seeded into the `Role` table by running `scripts/seed-roles.ts` (document this in the PR
     description — existing rows will not pick up new permissions otherwise).
- **Notifications** go through `src/lib/actions/notifications.ts`. New notification kinds require a
  new member of the `NotificationType` union *and* a matching entry in `NOTIFICATION_CONFIG` with a
  `requiredPermissions` gate. Use `notifyApprovers()` to reach approvers and `notifyRequester()` to
  reach the person who submitted. Set `entityType` / `entityId` so the notification is clickable.
- **Status fields** are plain strings with an inline comment listing allowed values (e.g.
  `status String @default("Pending") // "Pending", "Approved", "Rejected"`), matching
  `InventoryItem`, `StockTransaction`, and `MaterialRequest`. Do not introduce Prisma enums.
- **Approval audit trail** on any approvable model uses the existing shape:
  `status`, `requestedBy`, `approvedBy`, `approvedAt`, `rejectionReason`.
- **Migrations**: one Prisma migration covering all schema changes, named
  `repairs_and_approval_workflows`. All new columns on existing tables must be nullable or have
  defaults so existing rows survive.
- **UI** is Tailwind, client components under `src/components/<module>/`, with server components in
  `src/app/(main)/<route>/page.tsx` fetching data and passing `can*` permission booleans down as
  props. Follow the tab pattern already used in `InventoryClient.tsx`
  (`activeTab` state + tab button row).

---

## Feature 1 — Custom inventory category (finish the existing implementation)

**Current state:** mostly built already. `CustomInventoryCategory` model exists;
`getCustomCategories()` / `createCustomCategory(name)` exist at
`src/lib/actions/inventory.ts:2671`; `AddItemModal` in `src/components/inventory/InventoryClient.tsx:1528`
already renders a `__custom__` option that reveals an inline "create category" input.

**What to add:**

1. **Permission check.** `createCustomCategory()` currently has no authorisation. Gate it on
   `create_inventory_item` (the same permission that lets a user add an item at all).
2. **Expose it in the Stock In flow.** The custom-category picker currently only appears in
   `AddItemModal`. Users stocking an item through the stock-transaction modal must be able to create
   a category the same way. Extract the picker + inline-create UI from `AddItemModal` into a shared
   `CategorySelect` component in `src/components/inventory/` and use it in both places, so the
   `__custom__` behaviour, duplicate validation, and error display stay identical.
3. **Management.** Add a small "Categories" management surface (a section in the existing
   `locations` tab of `InventoryClient` is fine) that lists custom categories with their creator and
   creation date, and allows rename and delete. Deleting or renaming must be blocked — with a clear
   error naming the count — when any `InventoryItem.category` still references that name, since the
   relationship is by string, not FK. Gate both on `manage_inventory`.

**Do not** convert the six built-ins (`Raw Material`, `Consumable`, `Equipment`, `Asset`, `Scraps`,
`Lubricants`) into DB rows — keep them in the `BUILT_IN_CATEGORIES` constant and keep rejecting
custom categories that collide with them.

---

## Feature 2 — Inventory Repairs

Inventory items that break get sent out for repair. Track them, and flag the ones that don't come
back on time.

### Data model

New `InventoryRepair` model in `prisma/schema.prisma`:

- `id`, `createdAt`, `updatedAt`
- `itemId` → relation to `InventoryItem` (add the back-relation `repairs InventoryRepair[]` to
  `InventoryItem`)
- `quantity Float` — how many units went out
- `sentDate DateTime`
- `expectedReturnDate DateTime` — **required**; drives the overdue flag
- `actualReturnDate DateTime?`
- `vendor String?` — repairer name / workshop
- `contactPhone String?`
- `issueDescription String` — what's wrong with it
- `estimatedCost Float?`
- `actualCost Float?`
- `status String @default("Out for Repair")` — `"Out for Repair"`, `"Returned"`,
  `"Returned - Unrepairable"`, `"Cancelled"`
- `sentBy String?`, `receivedBy String?` (who logged it out, who received it back)
- `notes String?`
- Indexes on `itemId` and `status`.

### Stock behaviour (decided)

Repairs move real stock. Sending an item out and receiving it back must both write
`StockTransaction` rows so the ledger, valuation, and audit log stay consistent:

- **Send out:** validate `quantity <= item.quantity`. In a single `prisma.$transaction`, create the
  `InventoryRepair`, decrement `InventoryItem.quantity`, recompute `totalValue`, and create a
  `StockTransaction` with `type: "OUT"`, `status: "Approved"`, `reason: "Sent for repair"`, and the
  repair id referenced in `notes`.
- **Return (repaired):** in one transaction, set `actualReturnDate` and `status: "Returned"`,
  increment `InventoryItem.quantity` by the returned quantity, recompute `totalValue`, and create a
  `StockTransaction` with `type: "IN"`, `reason: "Returned from repair"`. Allow a partial return
  quantity — if fewer units come back than went out, the shortfall is written off (record it in
  `notes` and do not restore it to stock).
- **Return unrepairable:** stock is *not* restored; status becomes `"Returned - Unrepairable"` and
  no `IN` transaction is written.
- **Cancel:** only allowed while status is `"Out for Repair"`; restores the full quantity with an
  `IN` transaction reasoned `"Repair cancelled"`.

Repairs do **not** need approval — any user with `manage_inventory` can send and receive them.

### Overdue timer

- A repair is **overdue** when `status === "Out for Repair"` and `expectedReturnDate < now`.
- Derive this at read time; do not persist an `isOverdue` column.
- Show elapsed/remaining time in every repair row: for active repairs, days out and days remaining
  (or days overdue, in red). Use a colour scale — green when more than 3 days remain, amber within
  3 days, red once overdue.
- Add `checkOverdueRepairs()` to `src/lib/actions/trucks.ts`-style alert conventions — actually
  place it in `src/lib/actions/inventory.ts` — that finds overdue repairs and fires a
  `repair_overdue` notification. Register it in `runScheduledAlertChecks()` in
  `src/lib/actions/notifications.ts` alongside the existing checks. It must be idempotent: do not
  re-notify for a repair that already produced an unread `repair_overdue` notification for that
  recipient.

### Server actions (`src/lib/actions/inventory.ts`)

`getRepairs(status?)`, `getRepairStats()`, `sendItemForRepair(formData)`,
`returnRepairedItem(repairId, formData)`, `cancelRepair(repairId, reason)`,
`updateRepair(repairId, formData)`. All gated on `manage_inventory` except `getRepairs` /
`getRepairStats`, which take `view_inventory`.

### UI

Add a **Repairs** tab to `src/components/inventory/InventoryClient.tsx` (extend the `activeTab`
union and the tab row; put the heavy markup in a new `src/components/inventory/RepairsTab.tsx` so
`InventoryClient.tsx` doesn't grow further — it is already ~2800 lines).

The tab contains:

- Four stat cards: Currently Out, **Overdue** (red, prominent), Returned This Month, Total Repair
  Cost This Month.
- A filterable table (All / Out for Repair / Overdue / Returned), sorted overdue-first then by
  `expectedReturnDate`: item name, quantity + unit, vendor, sent date, expected return, a
  days-out/overdue badge, cost, status, and a row action.
- "Send Item for Repair" modal — item picker (searchable, showing available quantity), quantity,
  vendor, contact, issue description, sent date (defaults today), expected return date
  (**required**), estimated cost, notes.
- "Mark Returned" modal — actual return date, quantity returned (defaults to quantity sent), actual
  cost, repaired vs unrepairable toggle, received by, notes.
- Overdue repairs also surface on the inventory **Overview** tab as an alert banner when the count is
  non-zero, matching the existing expiring-items alert treatment.

Fetch repairs in `src/app/(main)/inventory/page.tsx` alongside the existing parallel fetches.

---

## Feature 3 — Maintenance records & schedules require Super Admin approval

Today `createMaintenanceRecord()` and `createMaintenanceSchedule()`
(`src/lib/actions/trucks.ts:143` and `:205`) write straight to the DB for anyone holding
`manage_maintenance` — which includes Manager. Both must now route through approval.

### Permission

Add `approve_maintenance` to the `Permission` union under the Fleet group. Grant it to
**Super Admin only** in `ROLE_PERMISSIONS`. Add it to the behaviour/permission list surfaced in the
role editor so it can be delegated later from Settings → Roles without a code change. `Manager`
keeps `manage_maintenance` (it can still *create*, it just can't self-approve).

### Schema

Add to both `MaintenanceRecord` and `MaintenanceSchedule`:

```
approvalStatus  String    @default("Pending")  // "Pending", "Approved", "Rejected"
requestedBy     String?
approvedBy      String?
approvedAt      DateTime?
rejectionReason String?
```

Backfill: the migration must set `approvalStatus = 'Approved'` for all pre-existing rows so historic
records don't suddenly appear as pending.

`MaintenanceRecord.status` (Completed / Scheduled / Overdue) is a *different* axis and stays as-is —
do not overload it.

### Behaviour

- On create, if the caller has `approve_maintenance`, write `approvalStatus: "Approved"` with
  `approvedBy` = the caller and `approvedAt` = now (self-approval, no extra click).
- Otherwise write `approvalStatus: "Pending"`, set `requestedBy`, and fire a
  `maintenance_approval_pending` notification to holders of `approve_maintenance` via
  `notifyApprovers()`.
- **Side effects must be deferred until approval.** `createMaintenanceRecord()` currently updates
  `Truck.lastServiceDate` and `Truck.mileage` inline — move that into the approve path so a pending
  record doesn't alter the truck. Same for anything `createMaintenanceSchedule()` implies about
  `nextServiceDate`.
- Pending schedules are inert: `checkMaintenanceDueByDate()` and `checkMaintenanceDueByMileage()`
  must filter to `approvalStatus: "Approved"`, as must `getFleetAlerts()` and `getFleetStats()`.
- `completeScheduledMaintenance()` may only run against an approved schedule.
- New actions: `approveMaintenanceRecord(id)`, `rejectMaintenanceRecord(id, reason)`,
  `approveMaintenanceSchedule(id)`, `rejectMaintenanceSchedule(id, reason)`, each gated on
  `approve_maintenance` and each notifying the requester via `notifyRequester()`.
- Rejected records stay in the table for audit; they are excluded from cost totals and alerts.

### UI

- `AddMaintenanceModal.tsx` and `ScheduleMaintenanceModal.tsx`: when the current user lacks
  `approve_maintenance`, change the submit button to "Submit for Approval" and show an inline note
  that the record goes to the Super Admin. On success, toast "Submitted for approval".
- `TruckDetailsClient.tsx`: badge pending rows amber with a "Pending Approval" pill and rejected rows
  red with the rejection reason on hover. Pending rows are visible to their creator and to
  approvers.
- Approvers get Approve / Reject buttons inline on pending rows; Reject opens a required-reason
  prompt.

---

## Feature 4 — Fuel requests require Super Admin approval

Today `logFuel()` (`src/lib/actions/fuel.ts:21`) writes a `FuelLog` immediately for anyone with
`log_fuel`. It becomes a request/approval flow for everyone.

### Permission

Add `approve_fuel_requests` to the `Permission` union under the Fuel group, granted to
**Super Admin only**, and expose it in the role editor. `log_fuel` now means "may *request* fuel"
and should be granted to every role that can reach the fuel page.

### Schema

New `FuelRequest` model:

- `id`, `createdAt`, `updatedAt`
- `truckId String?` → `Truck?`, `equipmentId String?` → `Equipment?` (exactly one must be set —
  validate in the action, mirroring how `FuelLog` is shaped)
- `liters Float`, `estimatedCost Float?`, `mileage Int?` (trucks only)
- `purpose String?`, `notes String?`
- `status String @default("Pending")` — `"Pending"`, `"Approved"`, `"Rejected"`, `"Cancelled"`
- `requestedBy String`, `requestedById String?`
- `approvedBy String?`, `approvedAt DateTime?`, `rejectionReason String?`
- `fuelLogId String? @unique` → optional relation to the `FuelLog` created on approval
- Indexes on `status` and `requestedById`.

Add `fuelRequests FuelRequest[]` back-relations to `Truck` and `Equipment`, and the inverse relation
field on `FuelLog`.

### Behaviour (decided)

**The `FuelLog` is created only on approval.** Pending requests do not appear in fuel history,
consumption totals, efficiency calculations, or the reconciliation tab.

- `createFuelRequest(formData)` replaces the direct-write path in `logFuel()`. Gated on `log_fuel`.
  Validates liters > 0 and exactly one target.
  - If the caller holds `approve_fuel_requests`: create the request already `"Approved"` **and**
    create the `FuelLog` in the same `prisma.$transaction`, linking `fuelLogId`. No approval round
    trip for the Super Admin.
  - Otherwise: create `"Pending"` and fire `fuel_request_pending` to holders of
    `approve_fuel_requests`.
- `approveFuelRequest(id, formData)` — gated on `approve_fuel_requests`. In one transaction, set
  status/approvedBy/approvedAt and create the linked `FuelLog`, computing `efficiency` with the same
  logic `logFuel()` uses today (do not duplicate that calculation — extract it into a shared helper
  and call it from both paths). Allow the approver to adjust the litres before approving (partial
  approval); record the original in `notes` if changed. Notify the requester.
- `rejectFuelRequest(id, reason)` — required reason, notify the requester.
- `cancelFuelRequest(id)` — the requester may cancel their own request while it is still `"Pending"`.
- `getFuelRequests(status?)`, `getMyFuelRequests()`, `getPendingFuelRequestCount()`.
- Keep `logFuel()` exported as a thin wrapper delegating to `createFuelRequest` if anything else
  calls it; otherwise delete it and update all call sites.

### UI (`src/components/fuel/FuelClient.tsx`)

- Add a **Requests** tab to the existing `activeTab` union
  (`'issuance' | 'deposits' | 'reconciliation'`), showing a badge with the pending count for
  approvers.
- The existing "Log Fuel"/issuance form becomes "Request Fuel"; its button reads "Submit Request"
  for non-approvers and "Issue Fuel" for approvers (who are effectively auto-approved).
- Requests table: target (truck plate or equipment name), litres, estimated cost, requester, date,
  status pill (amber Pending / green Approved / red Rejected / grey Cancelled), and — for
  approvers — Approve / Reject actions. Approve opens a small modal allowing the litres and actual
  cost to be confirmed or adjusted before it commits.
- Non-approvers see only their own requests plus the approved fuel history; approvers see all.
- Pass `canApproveFuelRequests` down from `src/app/(main)/fuel/page.tsx` the same way
  `canLogFuel` / `canManageFuel` are passed today.

---

## Cross-cutting work

1. **Notification types** — add to the `NotificationType` union and `NOTIFICATION_CONFIG` in
   `src/lib/actions/notifications.ts`:
   - `repair_overdue` — priority `high`, `requiredPermissions: ['view_inventory']`
   - `maintenance_approval_pending` — priority `high`, `requiredPermissions: ['approve_maintenance']`
   - `maintenance_approved` / `maintenance_rejected` — priority `medium`, sent to the requester
   - `fuel_request_pending` — priority `high`, `requiredPermissions: ['approve_fuel_requests']`
   - `fuel_request_approved` / `fuel_request_rejected` — priority `medium`, sent to the requester

   Also extend the `entityType` values used for click-through navigation with
   `"inventory_repair"`, `"maintenance_record"`, `"maintenance_schedule"`, `"fuel_request"`.

2. **Unified approvals queue** — `getPendingApprovals()` in `src/lib/actions/inventory.ts:1776`
   currently merges pending stock transactions, inventory items, and material requests. Extend it —
   or add a sibling `getAllPendingApprovals()` if you prefer to keep the inventory one
   inventory-scoped — so pending maintenance records, maintenance schedules, and fuel requests
   appear in the same queue, each filtered by whether the *current user* holds the matching approve
   permission. A Super Admin should be able to clear every pending approval from one place.

3. **Seeding** — after the migration, `scripts/seed-roles.ts` must be run so the two new permissions
   land on the built-in `Role` rows. Note this in the PR description. Also extend
   `scripts/verify-rbac.ts` to assert the new permissions are present on Super Admin and absent
   elsewhere.

4. **Permission list UI** — the role editor (`src/components/settings/RoleEditorModal.tsx`) reads the
   permission catalogue; make sure `approve_maintenance` and `approve_fuel_requests` render under
   Fleet and Fuel groups respectively with readable labels.

---

## Acceptance criteria

- [ ] A Storekeeper can create a custom category from **both** the Add Item and Stock In modals; a
      user without `create_inventory_item` cannot, and gets a clear error.
- [ ] A custom category in use by any item cannot be deleted or renamed.
- [ ] Sending 3 units of a 10-unit item for repair leaves 7 available, writes an `OUT` transaction,
      and shows in the Repairs tab as "Out for Repair".
- [ ] A repair past its expected return date shows red with a day count in both the Repairs tab and
      the Overview alert banner, and produces exactly one `repair_overdue` notification per recipient
      until it is read.
- [ ] Returning a repair restores stock, writes an `IN` transaction, and clears the overdue flag.
- [ ] A Manager creating a maintenance record sees "Submit for Approval"; the record appears as
      Pending, does **not** change the truck's `lastServiceDate` or `mileage`, and does not trigger
      maintenance-due alerts until a Super Admin approves it.
- [ ] A Super Admin creating the same record has it auto-approved with no extra step.
- [ ] A rejected maintenance record retains its rejection reason and is excluded from cost totals.
- [ ] Any user with `log_fuel` can submit a fuel request; no `FuelLog` exists until approval, so fuel
      history and efficiency figures are unaffected by pending requests.
- [ ] A Super Admin approving a fuel request (optionally adjusting litres) creates the `FuelLog` with
      correctly computed efficiency for trucks.
- [ ] A requester can cancel their own pending fuel request but not someone else's, and cannot
      approve their own.
- [ ] `npx tsc --noEmit` and `npm run build` pass; `npx prisma migrate dev` applies cleanly against a
      database containing existing maintenance, fuel, and inventory rows.

## Out of scope

- Email/SMS delivery of approvals (in-app + existing web-push only).
- Multi-step or multi-approver chains — one approval level is enough.
- Repair approval workflows (repairs are logged directly, not approved).
- Any change to the existing stock-transaction, material-request, or expense approval flows beyond
  surfacing them in the shared queue.
