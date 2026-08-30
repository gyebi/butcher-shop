
import { getDatabase } from "@/src/db/database";

export type LocalSaleInputItem = {
  productId: string;
  weightKg: number;
};

export type LocalCompletedSaleItem = {
  productId: string;
  productName: string;
  weightKg: number;
  pricePerKg: number;
  lineTotal: number;
  stockBeforeKg: number;
  remainingWeightKg: number;
};

export type LocalSaleResult = {
  saleId: string;
  totalAmount: number;
  items: LocalCompletedSaleItem[];
};

export type AddLocalStockInput = {
  productId: string;
  addedWeightKg: number;
  totalPurchaseCost: number;
  costPerKg: number;
  sellingPricePerKg: number;
};

export type AddLocalStockResult = {
  batchId: string;
  newWeightKg: number;
  sellingPricePerKg: number;
  fullStockKg: number;
};

type LocalProductRow = {
  id: string;
  name: string;
  selling_price_pesewas: number;
  weight_kg: number;
  full_stock_kg: number;
};




function createLocalId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function completeLocalSaleTransaction({
  items,
}: {
  items: LocalSaleInputItem[];
}): Promise<LocalSaleResult> {
  if (!items.length) {
    throw new Error("Sale must contain at least one item.");
  }

  const db = await getDatabase();

  const combinedItems = new Map<string, number>();

  for (const item of items) {
    if (!item.productId || item.weightKg <= 0) {
      throw new Error("Invalid sale item.");
    }

    combinedItems.set(
      item.productId,
      (combinedItems.get(item.productId) ?? 0) + item.weightKg,
    );
  }

  const saleId = createLocalId("sale");
  const now = new Date().toISOString();

  const completedItems: LocalCompletedSaleItem[] = [];
  let totalAmountPesewas = 0;

  await db.withExclusiveTransactionAsync(async (txn) => {
    for (const [productId, weightKg] of combinedItems) {
      const product = await txn.getFirstAsync<LocalProductRow>(
        `
        SELECT
          id,
          name,
          selling_price_pesewas,
          weight_kg
        FROM products
        WHERE id = ?
          AND active = 1
        LIMIT 1;
        `,
        [productId],
      );

      if (!product) {
        throw new Error(`Product not found: ${productId}`);
      }

      if (weightKg > product.weight_kg) {
        throw new Error(
          `Not enough stock for ${product.name}. Available: ${product.weight_kg} kg`,
        );
      }

      const remainingWeightKg =
        Math.round((product.weight_kg - weightKg) * 1000) / 1000;

      const lineTotalPesewas = Math.round(
        weightKg * product.selling_price_pesewas,
      );

      totalAmountPesewas += lineTotalPesewas;

      completedItems.push({
        productId: product.id,
        productName: product.name,
        weightKg,
        pricePerKg: product.selling_price_pesewas / 100,
        lineTotal: lineTotalPesewas / 100,
        stockBeforeKg: product.weight_kg,
        remainingWeightKg,
      });
    }

    await txn.runAsync(
      `
      INSERT INTO sales (
        id,
        total_amount_pesewas,
        item_count,
        sold_at,
        sync_status
      )
      VALUES (?, ?, ?, ?, 'PENDING');
      `,
      [
        saleId,
        totalAmountPesewas,
        completedItems.length,
        now,
      ],
    );

    for (const item of completedItems) {
      const saleItemId = createLocalId("sale_item");
      const movementId = createLocalId("movement");

      await txn.runAsync(
        `
        UPDATE products
        SET
          weight_kg = ?,
          updated_at = ?,
          sync_status = 'PENDING'
        WHERE id = ?;
        `,
        [
          item.remainingWeightKg,
          now,
          item.productId,
        ],
      );

      await txn.runAsync(
        `
        INSERT INTO sale_items (
          id,
          sale_id,
          product_id,
          product_name,
          weight_kg,
          price_per_kg_pesewas,
          line_total_pesewas,
          stock_before_kg,
          stock_after_kg
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
        `,
        [
          saleItemId,
          saleId,
          item.productId,
          item.productName,
          item.weightKg,
          Math.round(item.pricePerKg * 100),
          Math.round(item.lineTotal * 100),
          item.stockBeforeKg,
          item.remainingWeightKg,
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
        VALUES (?, ?, 'SALE', ?, ?, ?, 'PENDING');
        `,
        [
          movementId,
          item.productId,
          -item.weightKg,
          saleId,
          now,
        ],
      );
    }

    await txn.runAsync(
      `
      INSERT INTO sync_queue (
        id,
        entity_type,
        entity_id,
        operation,
        payload,
        status,
        attempt_count,
        created_at,
        updated_at
      )
      VALUES (?, 'SALE', ?, 'CREATE', ?, 'PENDING', 0, ?, ?);
      `,
      [
        createLocalId("sync"),
        saleId,
        JSON.stringify({
          saleId,
          totalAmount: totalAmountPesewas / 100,
          soldAt: now,
          items: completedItems,
        }),
        now,
        now,
      ],
    );
  });

  return {
    saleId,
    totalAmount: totalAmountPesewas / 100,
    items: completedItems,
  };
}

export async function addLocalStockTransaction({
  productId,
  addedWeightKg,
  totalPurchaseCost,
  costPerKg,
  sellingPricePerKg,
}: AddLocalStockInput): Promise<AddLocalStockResult> {
  if (!productId) {
    throw new Error("Product is required.");
  }

  if (!Number.isFinite(addedWeightKg) || addedWeightKg <= 0) {
    throw new Error("Invalid stock weight.");
  }

  if (!Number.isFinite(totalPurchaseCost) || totalPurchaseCost <= 0) {
    throw new Error("Invalid purchase cost.");
  }

  if (!Number.isFinite(costPerKg) || costPerKg <= 0) {
    throw new Error("Invalid cost per kg.");
  }

  if (!Number.isFinite(sellingPricePerKg) || sellingPricePerKg <= 0) {
    throw new Error("Invalid selling price.");
  }

  const db = await getDatabase();

  const batchId = createLocalId("batch");
  const movementId = createLocalId("movement");
  const syncId = createLocalId("sync");
  const now = new Date().toISOString();

  let result: AddLocalStockResult | null = null;

  await db.withExclusiveTransactionAsync(async (txn) => {
    const product = await txn.getFirstAsync<LocalProductRow>(
      `
      SELECT
        id,
        name,
        weight_kg,
        full_stock_kg
      FROM products
      WHERE id = ?
        AND active = 1
      LIMIT 1;
      `,
      [productId],
    );

    if (!product) {
      throw new Error("Product not found.");
    }

    const newWeightKg =
      Math.round((product.weight_kg + addedWeightKg) * 1000) / 1000;

    const newFullStockKg = Math.max(
      product.full_stock_kg,
      newWeightKg,
    );

    const sellingPricePesewas = Math.round(
      sellingPricePerKg * 100,
    );

    const totalPurchaseCostPesewas = Math.round(
      totalPurchaseCost * 100,
    );

    const costPerKgPesewas = Math.round(
      costPerKg * 100,
    );

    await txn.runAsync(
      `
      UPDATE products
      SET
        weight_kg = ?,
        full_stock_kg = ?,
        selling_price_pesewas = ?,
        cost_price_pesewas = ?,
        updated_at = ?,
        sync_status = 'PENDING'
      WHERE id = ?;
      `,
      [
        newWeightKg,
        newFullStockKg,
        sellingPricePesewas,
        costPerKgPesewas,
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
        batchId,
        productId,
        product.name,
        addedWeightKg,
        addedWeightKg,
        totalPurchaseCostPesewas,
        costPerKgPesewas,
        sellingPricePesewas,
        product.weight_kg,
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
        batchId,
        now,
      ],
    );

    await txn.runAsync(
      `
      INSERT INTO sync_queue (
        id,
        entity_type,
        entity_id,
        operation,
        payload,
        status,
        attempt_count,
        created_at,
        updated_at
      )
      VALUES (?, 'STOCK_BATCH', ?, 'CREATE', ?, 'PENDING', 0, ?, ?);
      `,
      [
        syncId,
        batchId,
        JSON.stringify({
          batchId,
          productId,
          productName: product.name,
          addedWeightKg,
          totalPurchaseCost,
          costPerKg,
          sellingPricePerKg,
          stockBeforeKg: product.weight_kg,
          stockAfterKg: newWeightKg,
          fullStockKg: newFullStockKg,
          receivedAt: now,
        }),
        now,
        now,
      ],
    );

    result = {
      batchId,
      newWeightKg,
      sellingPricePerKg,
      fullStockKg: newFullStockKg,
    };
  });

  if (!result) {
    throw new Error("Stock transaction failed.");
  }

  return result;
}
