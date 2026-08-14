-- AlterTable
ALTER TABLE "Staff" ADD COLUMN     "accountName" TEXT,
ADD COLUMN     "accountNumber" TEXT,
ADD COLUMN     "bankName" TEXT,
ADD COLUMN     "exitDate" TIMESTAMP(3),
ADD COLUMN     "exitReason" TEXT,
ADD COLUMN     "exitRecordedAt" TIMESTAMP(3),
ADD COLUMN     "exitRecordedBy" TEXT,
ADD COLUMN     "exitType" TEXT,
ADD COLUMN     "nokAddress" TEXT,
ADD COLUMN     "nokName" TEXT,
ADD COLUMN     "nokPhone" TEXT,
ADD COLUMN     "nokRelationship" TEXT;

-- CreateIndex
CREATE INDEX "Staff_exitType_idx" ON "Staff"("exitType");
