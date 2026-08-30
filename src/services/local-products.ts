
import { getDatabase } from "@/src/db/database";

export type CreateLocalProductInput = {
  name: string;
  fullStockKg: number;
  pricePerKg: number;
};

export type CreatedLocalProduct = {
  id: string;
  name: string;
  weightKg: number;
  fullStockKg: number;
  pricePerKg: number;
};

function createLocalId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

export async function createLocalProduct(
  input: CreateLocalProductInput
): Promise<CreatedLocalProduct> {
  const name = input.name.trim();

  if (!name) {
    throw new Error("Product name is required.");
  }

  if (
    !Number.isFinite(input.fullStockKg) ||
    input.fullStockKg <= 0
  ) {
    throw new Error(
      "Full stock weight must be greater than zero."
    );
  }

  if (
    !Number.isFinite(input.pricePerKg) ||
    input.pricePerKg < 0
  ) {
    throw new Error(
      "Selling price cannot be negative."
    );
  }

  const db = await getDatabase();

  const productId = createLocalId("product");
  const syncId = createLocalId("sync");
  const now = new Date().toISOString();

  const pricePesewas = Math.round(
    input.pricePerKg * 100
  );

  await db.withExclusiveTransactionAsync(
    async (txn) => {
      /*
       * Create the product locally.
       *
       * weight_kg starts at zero because the
       * physical stock is received separately
       * through ADD STOCK.
       */
      await txn.runAsync(
        `
        INSERT INTO products (
          id,
          name,
          category_id,
          sku,
          selling_price_pesewas,
          cost_price_pesewas,
          weight_kg,
          full_stock_kg,
          unit,
          image_path,
          local_image_uri,
          active,
          updated_at,
          sync_status
        )
        VALUES (
          ?, ?, NULL, NULL, ?, NULL,
          0, ?, 'kg',
          NULL, NULL,
          1, ?, 'PENDING'
        );
        `,
        [
          productId,
          name,
          pricePesewas,
          input.fullStockKg,
          now,
        ]
      );

      /*
       * Queue Firebase creation for later.
       */
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
        VALUES (
          ?,
          'PRODUCT',
          ?,
          'CREATE',
          ?,
          'PENDING',
          0,
          ?,
          ?
        );
        `,
        [
          syncId,
          productId,
          JSON.stringify({
            productId,
            name,
            weightKg: 0,
            fullStockKg: input.fullStockKg,
            pricePerKg:
              Math.round(
                input.pricePerKg * 100
              ) / 100,
            createdAt: now,
          }),
          now,
          now,
        ]
      );
    }
  );

  return {
    id: productId,
    name,
    weightKg: 0,
    fullStockKg: input.fullStockKg,
    pricePerKg:
      Math.round(input.pricePerKg * 100) / 100,
  };
}
