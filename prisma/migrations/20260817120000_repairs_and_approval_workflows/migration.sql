-- Repairs & approval workflows
--   1. InventoryRepair  - items sent out for repair, stock-affecting
--   2. FuelRequest      - fuel issuance now goes through approval
--   3. Approval columns on MaintenanceRecord / MaintenanceSchedule
--
-- Existing maintenance rows are backfilled to 'Approved' so historic records do not
-- suddenly appear in the pending queue or lose their fleet alerts.

-- CreateTable
CREATE TABLE "InventoryRepair" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "sentDate" TIMESTAMP(3) NOT NULL,
    "expectedReturnDate" TIMESTAMP(3) NOT NULL,
    "actualReturnDate" TIMESTAMP(3),
    "quantityReturned" DOUBLE PRECISION,
    "vendor" TEXT,
    "contactPhone" TEXT,
    "issueDescription" TEXT NOT NULL,
    "estimatedCost" DOUBLE PRECISION,
    "actualCost" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'Out for Repair',
    "sentBy" TEXT,
    "receivedBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryRepair_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InventoryRepair_itemId_idx" ON "InventoryRepair"("itemId");

-- CreateIndex
CREATE INDEX "InventoryRepair_status_idx" ON "InventoryRepair"("status");

-- AddForeignKey
ALTER TABLE "InventoryRepair" ADD CONSTRAINT "InventoryRepair_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "FuelRequest" (
    "id" TEXT NOT NULL,
    "truckId" TEXT,
    "equipmentId" TEXT,
    "liters" DOUBLE PRECISION NOT NULL,
    "estimatedCost" DOUBLE PRECISION,
    "mileage" INTEGER,
    "purpose" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "requestedBy" TEXT NOT NULL,
    "requestedById" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "fuelLogId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FuelRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FuelRequest_fuelLogId_key" ON "FuelRequest"("fuelLogId");

-- CreateIndex
CREATE INDEX "FuelRequest_status_idx" ON "FuelRequest"("status");

-- CreateIndex
CREATE INDEX "FuelRequest_requestedById_idx" ON "FuelRequest"("requestedById");

-- AddForeignKey
ALTER TABLE "FuelRequest" ADD CONSTRAINT "FuelRequest_truckId_fkey" FOREIGN KEY ("truckId") REFERENCES "Truck"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelRequest" ADD CONSTRAINT "FuelRequest_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelRequest" ADD CONSTRAINT "FuelRequest_fuelLogId_fkey" FOREIGN KEY ("fuelLogId") REFERENCES "FuelLog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "MaintenanceRecord"
    ADD COLUMN "scheduleId" TEXT,
    ADD COLUMN "approvalStatus" TEXT NOT NULL DEFAULT 'Pending',
    ADD COLUMN "requestedBy" TEXT,
    ADD COLUMN "approvedBy" TEXT,
    ADD COLUMN "approvedAt" TIMESTAMP(3),
    ADD COLUMN "rejectionReason" TEXT;

-- AlterTable
ALTER TABLE "MaintenanceSchedule"
    ADD COLUMN "approvalStatus" TEXT NOT NULL DEFAULT 'Pending',
    ADD COLUMN "requestedBy" TEXT,
    ADD COLUMN "approvedBy" TEXT,
    ADD COLUMN "approvedAt" TIMESTAMP(3),
    ADD COLUMN "rejectionReason" TEXT;

-- Backfill: everything that existed before approvals were introduced is grandfathered in.
UPDATE "MaintenanceRecord" SET "approvalStatus" = 'Approved', "approvedAt" = "createdAt", "approvedBy" = 'System (pre-approval)';
UPDATE "MaintenanceSchedule" SET "approvalStatus" = 'Approved', "approvedAt" = "createdAt", "approvedBy" = 'System (pre-approval)';

-- CreateIndex
CREATE INDEX "MaintenanceRecord_approvalStatus_idx" ON "MaintenanceRecord"("approvalStatus");

-- CreateIndex
CREATE INDEX "MaintenanceSchedule_approvalStatus_idx" ON "MaintenanceSchedule"("approvalStatus");
