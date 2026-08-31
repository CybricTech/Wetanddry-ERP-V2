-- AlterTable
ALTER TABLE "Truck" ADD COLUMN     "manualMileage" INTEGER,
ADD COLUMN     "manualMileageAt" TIMESTAMP(3);
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
