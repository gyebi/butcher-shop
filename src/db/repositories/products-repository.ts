import { getDatabase } from "../database";

export type LocalProduct = {
  id: string;
  name: string;
  categoryId: string | null;
  sku: string | null;

  sellingPricePesewas: number;
  costPricePesewas: number | null;

  weightKg: number;
  fullStockKg: number;

  unit: string;

  imagePath: string | null;
  localImageUri: string | null;

  active: boolean;
  updatedAt: string;

  syncStatus: "PENDING" | "SYNCING" | "SYNCED" | "FAILED";
};

type ProductRow = {
  id: string;
  name: string;
  category_id: string | null;
  sku: string | null;
  selling_price_pesewas: number;
  cost_price_pesewas: number | null;
  weight_kg: number;
  full_stock_kg: number;
  unit: string;
  image_path: string | null;
  local_image_uri: string | null;
  active: number;
  updated_at: string;
  sync_status: LocalProduct["syncStatus"];
};

function mapProductRow(row: ProductRow): LocalProduct {
  return {
    id: row.id,
    name: row.name,
    categoryId: row.category_id,
    sku: row.sku,

    sellingPricePesewas: row.selling_price_pesewas,
    costPricePesewas: row.cost_price_pesewas,

    weightKg: row.weight_kg,
    fullStockKg: row.full_stock_kg,

    unit: row.unit,

    imagePath: row.image_path,
    localImageUri: row.local_image_uri,

    active: row.active === 1,
    updatedAt: row.updated_at,

    syncStatus: row.sync_status,
  };
}

export async function saveLocalProduct(
  product: LocalProduct
): Promise<void> {
  const db = await getDatabase();

  await db.runAsync(
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
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      category_id = excluded.category_id,
      sku = excluded.sku,
      selling_price_pesewas = excluded.selling_price_pesewas,
      cost_price_pesewas = excluded.cost_price_pesewas,
      weight_kg = excluded.weight_kg,
      full_stock_kg = excluded.full_stock_kg,
      unit = excluded.unit,
      image_path = excluded.image_path,
      local_image_uri = excluded.local_image_uri,
      active = excluded.active,
      updated_at = excluded.updated_at,
      sync_status = excluded.sync_status
    `,
    [
      product.id,
      product.name,
      product.categoryId,
      product.sku,
      product.sellingPricePesewas,
      product.costPricePesewas,
      product.weightKg,
      product.fullStockKg,
      product.unit,
      product.imagePath,
      product.localImageUri,
      product.active ? 1 : 0,
      product.updatedAt,
      product.syncStatus,
    ]
  );
}

export async function getLocalProducts(): Promise<LocalProduct[]> {
  const db = await getDatabase();

  const rows = await db.getAllAsync<ProductRow>(
    `
    SELECT
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
    FROM products
    WHERE active = 1
    ORDER BY name ASC
    `
  );

  return rows.map(mapProductRow);
}

export async function getLocalProductById(
  id: string
): Promise<LocalProduct | null> {
  const db = await getDatabase();

  const row = await db.getFirstAsync<ProductRow>(
    `
    SELECT
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
    FROM products
    WHERE id = ?
    LIMIT 1
    `,
    [id]
  );

  return row ? mapProductRow(row) : null;
}

export async function deleteLocalProductById(
  id: string
): Promise<void> {
  const db = await getDatabase();

  await db.runAsync(
    `DELETE FROM products WHERE id = ?`,
    [id]
  );
}
