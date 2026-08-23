import { getDatabase } from "./database";

export async function initializeDatabase(): Promise<void> {
  const db = await getDatabase();

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'SYNCED'
        CHECK (sync_status IN ('PENDING', 'SYNCING', 'SYNCED', 'FAILED'))
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      category_id TEXT,
      sku TEXT,

      selling_price_pesewas INTEGER NOT NULL DEFAULT 0,
      cost_price_pesewas INTEGER,

      weight_kg REAL NOT NULL DEFAULT 0,
      full_stock_kg REAL NOT NULL DEFAULT 0,
      unit TEXT NOT NULL DEFAULT 'kg',

      image_path TEXT,
      local_image_uri TEXT,

      active INTEGER NOT NULL DEFAULT 1,

      updated_at TEXT NOT NULL,

      sync_status TEXT NOT NULL DEFAULT 'SYNCED'
        CHECK (sync_status IN ('PENDING', 'SYNCING', 'SYNCED', 'FAILED')),

      FOREIGN KEY (category_id)
        REFERENCES categories(id)
        ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_products_category_id
      ON products(category_id);

    CREATE INDEX IF NOT EXISTS idx_products_active
      ON products(active);
  `);

  const productColumns = await db.getAllAsync<{ name: string }>(
    `PRAGMA table_info(products);`
  );

  const hasFullStockKg = productColumns.some(
    (column) => column.name === "full_stock_kg"
  );

  if (!hasFullStockKg) {
    await db.execAsync(`
      ALTER TABLE products
      ADD COLUMN full_stock_kg REAL NOT NULL DEFAULT 0;
    `);
  }
}

export async function verifyDatabaseTables(): Promise<void> {
  const db = await getDatabase();

  const tables = await db.getAllAsync<{ name: string }>(
    `
    SELECT name
    FROM sqlite_master
    WHERE type = 'table'
      AND name NOT LIKE 'sqlite_%'
    ORDER BY name;
    `
  );

  console.log(
    "SQLite tables:",
    tables.map((table) => table.name)
  );
}
