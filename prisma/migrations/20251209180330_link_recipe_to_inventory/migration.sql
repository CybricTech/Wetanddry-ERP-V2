/*
  Warnings:

  - Added the required column `inventoryItemId` to the `RecipeIngredient` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_RecipeIngredient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recipeId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "materialName" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "unit" TEXT NOT NULL,
    CONSTRAINT "RecipeIngredient_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RecipeIngredient_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_RecipeIngredient" ("id", "materialName", "quantity", "recipeId", "unit") SELECT "id", "materialName", "quantity", "recipeId", "unit" FROM "RecipeIngredient";
DROP TABLE "RecipeIngredient";
ALTER TABLE "new_RecipeIngredient" RENAME TO "RecipeIngredient";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
