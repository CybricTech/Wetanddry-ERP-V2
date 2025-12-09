/*
  Warnings:

  - You are about to drop the column `lifespan` on the `Part` table. All the data in the column will be lost.
  - Added the required column `lifespanMonths` to the `Part` table without a default value. This is not possible if the table is not empty.
  - Added the required column `productCode` to the `Recipe` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "MaintenanceRecord" ADD COLUMN "mileageAtService" INTEGER;
ALTER TABLE "MaintenanceRecord" ADD COLUMN "performedBy" TEXT;

-- AlterTable
ALTER TABLE "StockTransaction" ADD COLUMN "approvedAt" DATETIME;
ALTER TABLE "StockTransaction" ADD COLUMN "approvedBy" TEXT;
ALTER TABLE "StockTransaction" ADD COLUMN "notes" TEXT;

-- AlterTable
ALTER TABLE "Truck" ADD COLUMN "lastServiceDate" DATETIME;
ALTER TABLE "Truck" ADD COLUMN "nextServiceDate" DATETIME;
ALTER TABLE "Truck" ADD COLUMN "nextServiceMileage" INTEGER;

-- CreateTable
CREATE TABLE "MaintenanceSchedule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "truckId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "intervalType" TEXT NOT NULL,
    "intervalDays" INTEGER,
    "intervalMileage" INTEGER,
    "nextDueDate" DATETIME,
    "nextDueMileage" INTEGER,
    "lastCompletedDate" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" TEXT NOT NULL DEFAULT 'Normal',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MaintenanceSchedule_truckId_fkey" FOREIGN KEY ("truckId") REFERENCES "Truck" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SparePartInventory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "partNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "minQuantity" INTEGER NOT NULL DEFAULT 1,
    "purchasePrice" REAL NOT NULL,
    "supplier" TEXT,
    "location" TEXT,
    "lastRestocked" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MaterialRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestType" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "fromLocationId" TEXT,
    "toLocationId" TEXT,
    "reason" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'Normal',
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "requestedBy" TEXT NOT NULL,
    "approvedBy" TEXT,
    "approvedAt" DATETIME,
    "completedAt" DATETIME,
    "rejectionReason" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MaterialRequest_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_InventoryItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "category" TEXT NOT NULL,
    "itemType" TEXT NOT NULL DEFAULT 'General',
    "quantity" REAL NOT NULL DEFAULT 0,
    "maxCapacity" REAL,
    "unit" TEXT NOT NULL,
    "minThreshold" REAL NOT NULL DEFAULT 0,
    "unitCost" REAL NOT NULL DEFAULT 0,
    "totalValue" REAL NOT NULL DEFAULT 0,
    "expiryDate" DATETIME,
    "batchNumber" TEXT,
    "supplier" TEXT,
    "locationId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InventoryItem_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "StorageLocation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_InventoryItem" ("category", "createdAt", "expiryDate", "id", "locationId", "minThreshold", "name", "quantity", "sku", "unit", "updatedAt") SELECT "category", "createdAt", "expiryDate", "id", "locationId", "minThreshold", "name", "quantity", "sku", "unit", "updatedAt" FROM "InventoryItem";
DROP TABLE "InventoryItem";
ALTER TABLE "new_InventoryItem" RENAME TO "InventoryItem";
CREATE TABLE "new_Part" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "truckId" TEXT NOT NULL,
    "partNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "position" TEXT,
    "installedDate" DATETIME NOT NULL,
    "lifespanMonths" INTEGER NOT NULL,
    "lifespanMileage" INTEGER,
    "mileageAtInstall" INTEGER,
    "expectedReplacementDate" DATETIME,
    "purchasePrice" REAL,
    "supplier" TEXT,
    "warrantyExpiry" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Part_truckId_fkey" FOREIGN KEY ("truckId") REFERENCES "Truck" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Part" ("category", "createdAt", "id", "installedDate", "name", "partNumber", "status", "truckId", "updatedAt") SELECT "category", "createdAt", "id", "installedDate", "name", "partNumber", "status", "truckId", "updatedAt" FROM "Part";
DROP TABLE "Part";
ALTER TABLE "new_Part" RENAME TO "Part";
CREATE TABLE "new_ProductionRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recipeId" TEXT NOT NULL,
    "siloId" TEXT,
    "quantity" REAL NOT NULL,
    "cementUsed" REAL,
    "status" TEXT NOT NULL DEFAULT 'Completed',
    "notes" TEXT,
    "operatorName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductionRun_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ProductionRun_siloId_fkey" FOREIGN KEY ("siloId") REFERENCES "StorageLocation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ProductionRun" ("createdAt", "id", "quantity", "recipeId", "status") SELECT "createdAt", "id", "quantity", "recipeId", "status" FROM "ProductionRun";
DROP TABLE "ProductionRun";
ALTER TABLE "new_ProductionRun" RENAME TO "ProductionRun";
CREATE TABLE "new_Recipe" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "totalWeight" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Recipe" ("createdAt", "description", "id", "name", "updatedAt") SELECT "createdAt", "description", "id", "name", "updatedAt" FROM "Recipe";
DROP TABLE "Recipe";
ALTER TABLE "new_Recipe" RENAME TO "Recipe";
CREATE UNIQUE INDEX "Recipe_productCode_key" ON "Recipe"("productCode");
CREATE TABLE "new_StorageLocation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "capacity" REAL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_StorageLocation" ("createdAt", "description", "id", "name", "type", "updatedAt") SELECT "createdAt", "description", "id", "name", "type", "updatedAt" FROM "StorageLocation";
DROP TABLE "StorageLocation";
ALTER TABLE "new_StorageLocation" RENAME TO "StorageLocation";
CREATE UNIQUE INDEX "StorageLocation_name_key" ON "StorageLocation"("name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "SparePartInventory_partNumber_key" ON "SparePartInventory"("partNumber");
