import { getDatabase } from "@/src/db/database";

export type AddStockInput = {
  productId: string;
  addedWeightKg: number;
  totalPurchaseCost: number;
  costPerKg: number;
  sellingPricePerKg: number;
};

export type AddStockResult = {
  batchId: string;
  newWeightKg: number;
  sellingPricePerKg: number;
  fullStockKg: number;
};

type StockBatchProductRow = {
  id: string;
  name: string;
  weight_kg: number;
  full_stock_kg: number;
  active: number;
};

function createLocalId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

export async function addStockTransaction({
  productId,
  addedWeightKg,
  totalPurchaseCost,
  costPerKg,
  sellingPricePerKg,
}: AddStockInput): Promise<AddStockResult> {
  if (
    !Number.isFinite(addedWeightKg) ||
    addedWeightKg <= 0
  ) {
    throw new Error("Invalid stock weight.");
  }

  if (
    !Number.isFinite(totalPurchaseCost) ||
    totalPurchaseCost <= 0
  ) {
    throw new Error("Invalid purchase cost.");
  }

  if (
    !Number.isFinite(costPerKg) ||
    costPerKg <= 0
  ) {
    throw new Error("Invalid cost per kg.");
  }

  if (
    !Number.isFinite(sellingPricePerKg) ||
    sellingPricePerKg <= 0
  ) {
    throw new Error("Invalid selling price.");
  }

  const db = await getDatabase();
  const now = new Date().toISOString();
  const stockBatchId = createLocalId("stock_batch");
  const movementId = createLocalId("movement");

  let result: AddStockResult | null = null;

  await db.withExclusiveTransactionAsync(async (txn) => {
      const product =
        await txn.getFirstAsync<StockBatchProductRow>(
          `
          SELECT
            id,
            name,
            weight_kg,
            full_stock_kg,
            active
          FROM products
          WHERE id = ?
          LIMIT 1;
          `,
          [productId],
        );

      if (!product) {
        throw new Error("Product not found.");
      }

      if (product.active !== 1) {
        throw new Error("Product is inactive.");
      }

      const currentWeightKg = Number.isFinite(
        product.weight_kg,
      )
        ? product.weight_kg
        : 0;

      const currentFullStockKg = Number.isFinite(
        product.full_stock_kg,
      )
        ? product.full_stock_kg
        : 0;

      const newWeightKg =
        Math.round(
          (currentWeightKg + addedWeightKg) * 1000,
        ) / 1000;

      const newFullStockKg = Math.max(
        currentFullStockKg,
        newWeightKg,
      );

      const roundedSellingPrice =
        Math.round(sellingPricePerKg * 100) / 100;

      await txn.runAsync(
        `
        UPDATE products
        SET
          weight_kg = ?,
          full_stock_kg = ?,
          selling_price_pesewas = ?,
          updated_at = ?,
          sync_status = 'PENDING'
        WHERE id = ?;
        `,
        [
          newWeightKg,
          newFullStockKg,
          Math.round(roundedSellingPrice * 100),
          now,
          productId,
        ],
      );

      await txn.runAsync(
        `
        INSERT INTO stock_batches (
          id,
          product_id,
          product_name,
          weight_received_kg,
          remaining_weight_kg,
          total_purchase_cost_pesewas,
          cost_per_kg_pesewas,
          selling_price_per_kg_pesewas,
          stock_before_kg,
          stock_after_kg,
          received_at,
          sync_status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING');
        `,
        [
          stockBatchId,
          productId,
          product.name,
          addedWeightKg,
          addedWeightKg,
          Math.round(totalPurchaseCost * 100),
          Math.round(costPerKg * 100),
          Math.round(roundedSellingPrice * 100),
          currentWeightKg,
          newWeightKg,
          now,
        ],
      );

      await txn.runAsync(
        `
        INSERT INTO inventory_movements (
          id,
          product_id,
          movement_type,
          weight_kg,
          reference_id,
          created_at,
          sync_status
        )
        VALUES (?, ?, 'STOCK_IN', ?, ?, ?, 'PENDING');
        `,
        [
          movementId,
          productId,
          addedWeightKg,
          stockBatchId,
          now,
        ],
      );

      result = {
        batchId: stockBatchId,
        newWeightKg,
        sellingPricePerKg: roundedSellingPrice,
        fullStockKg: newFullStockKg,
      };
    });

  if (!result) {
    throw new Error("Failed to add stock.");
  }

  return result;
}
