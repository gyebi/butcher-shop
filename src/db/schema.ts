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

      CREATE TABLE IF NOT EXISTS business_settings (
  id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),

  reorder_percent REAL NOT NULL DEFAULT 20,
  markup_percent REAL NOT NULL DEFAULT 20,
  voice_enabled INTEGER NOT NULL DEFAULT 1,

  updated_at TEXT NOT NULL,

  sync_status TEXT NOT NULL DEFAULT 'SYNCED'
    CHECK (
      sync_status IN (
        'PENDING',
        'SYNCING',
        'SYNCED',
        'FAILED'
      )
    )
);
  `);

  await db.execAsync(`
  CREATE TABLE IF NOT EXISTS printer_settings (
    id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),

    enabled INTEGER NOT NULL DEFAULT 0,

    printer_name TEXT,
    printer_address TEXT,

    connection_type TEXT NOT NULL DEFAULT 'BLUETOOTH',

    paper_width_mm INTEGER NOT NULL DEFAULT 58,
    print_width_mm INTEGER,

    charset TEXT,

    updated_at TEXT NOT NULL
  );
  `);

  await db.execAsync(`
  CREATE TABLE IF NOT EXISTS sales (
    id TEXT PRIMARY KEY NOT NULL,

    total_amount_pesewas INTEGER NOT NULL
      CHECK (total_amount_pesewas >= 0),

    item_count INTEGER NOT NULL
      CHECK (item_count > 0),

    sold_at TEXT NOT NULL,

    sync_status TEXT NOT NULL DEFAULT 'PENDING'
      CHECK (
        sync_status IN (
          'PENDING',
          'SYNCING',
          'SYNCED',
          'FAILED'
        )
      )
  );

  CREATE TABLE IF NOT EXISTS sale_items (
    id TEXT PRIMARY KEY NOT NULL,

    sale_id TEXT NOT NULL,
    product_id TEXT NOT NULL,

    product_name TEXT NOT NULL,

    weight_kg REAL NOT NULL
      CHECK (weight_kg > 0),

    price_per_kg_pesewas INTEGER NOT NULL
      CHECK (price_per_kg_pesewas >= 0),

    line_total_pesewas INTEGER NOT NULL
      CHECK (line_total_pesewas >= 0),

    stock_before_kg REAL NOT NULL,
    stock_after_kg REAL NOT NULL,

    FOREIGN KEY (sale_id)
      REFERENCES sales(id)
      ON DELETE RESTRICT,

    FOREIGN KEY (product_id)
      REFERENCES products(id)
      ON DELETE RESTRICT
  );

  CREATE TABLE IF NOT EXISTS inventory_movements (
    id TEXT PRIMARY KEY NOT NULL,

    product_id TEXT NOT NULL,

    movement_type TEXT NOT NULL
      CHECK (
        movement_type IN (
          'SALE',
          'STOCK_IN',
          'ADJUSTMENT',
          'WASTE'
        )
      ),

    weight_kg REAL NOT NULL,

    reference_id TEXT,

    created_at TEXT NOT NULL,

    sync_status TEXT NOT NULL DEFAULT 'PENDING'
      CHECK (
        sync_status IN (
          'PENDING',
          'SYNCING',
          'SYNCED',
          'FAILED'
        )
      ),

    FOREIGN KEY (product_id)
      REFERENCES products(id)
      ON DELETE RESTRICT
  );

  CREATE TABLE IF NOT EXISTS sync_queue (
    id TEXT PRIMARY KEY NOT NULL,

    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,

    operation TEXT NOT NULL
      CHECK (
        operation IN (
          'CREATE',
          'UPDATE',
          'DELETE'
        )
      ),

    payload TEXT NOT NULL,

    status TEXT NOT NULL DEFAULT 'PENDING'
      CHECK (
        status IN (
          'PENDING',
          'SYNCING',
          'SYNCED',
          'FAILED'
        )
      ),

    attempt_count INTEGER NOT NULL DEFAULT 0,

    last_attempt_at TEXT,
    last_error TEXT,

    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id
    ON sale_items(sale_id);

  CREATE INDEX IF NOT EXISTS idx_sale_items_product_id
    ON sale_items(product_id);

  CREATE INDEX IF NOT EXISTS idx_inventory_movements_product_id
    ON inventory_movements(product_id);

  CREATE INDEX IF NOT EXISTS idx_inventory_movements_reference_id
    ON inventory_movements(reference_id);

  CREATE INDEX IF NOT EXISTS idx_sync_queue_status
    ON sync_queue(status);

  CREATE INDEX IF NOT EXISTS idx_sync_queue_entity
    ON sync_queue(entity_type, entity_id);

  CREATE TABLE IF NOT EXISTS stock_batches (
  id TEXT PRIMARY KEY NOT NULL,

  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,

  weight_received_kg REAL NOT NULL
    CHECK (weight_received_kg > 0),

  remaining_weight_kg REAL NOT NULL
    CHECK (remaining_weight_kg >= 0),

  total_purchase_cost_pesewas INTEGER NOT NULL
    CHECK (total_purchase_cost_pesewas >= 0),

  cost_per_kg_pesewas INTEGER NOT NULL
    CHECK (cost_per_kg_pesewas >= 0),

  selling_price_per_kg_pesewas INTEGER NOT NULL
    CHECK (selling_price_per_kg_pesewas >= 0),

  stock_before_kg REAL NOT NULL,
  stock_after_kg REAL NOT NULL,

  received_at TEXT NOT NULL,

  sync_status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (
      sync_status IN (
        'PENDING',
        'SYNCING',
        'SYNCED',
        'FAILED'
      )
    ),

  FOREIGN KEY (product_id)
    REFERENCES products(id)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_stock_batches_product_id
ON stock_batches(product_id);

CREATE INDEX IF NOT EXISTS idx_stock_batches_sync_status
ON stock_batches(sync_status);
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

