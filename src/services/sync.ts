
import {
  collection,
  doc,
  getDoc,
  getFirestore,
  runTransaction,
  serverTimestamp,
  setDoc,
} from "@react-native-firebase/firestore";

import { getDatabase } from "@/src/db/database";
import {
  getLocalBusinessSettings,
  saveLocalBusinessSettings,
} from "@/src/db/repositories/business-settings-repository";
import {
  refreshBusinessSettingsFromFirebase,
} from "@/src/services/settings";
import {
  refreshProductsFromFirebase,
} from "@/src/services/products";

type SyncQueueRow = {
  id: string;
  entity_id: string;
  payload: string;
  attempt_count: number;
};

type PendingSalePayload = {
  saleId: string;
  totalAmount: number;
  soldAt: string;

  items: {
    productId: string;
    productName: string;
    weightKg: number;
    pricePerKg: number;
    lineTotal: number;
    stockBeforeKg: number;
    remainingWeightKg: number;
  }[];
};


type PendingStockBatchPayload = {
  batchId: string;
  productId: string;
  productName: string;

  addedWeightKg: number;

  totalPurchaseCost: number;
  costPerKg: number;
  sellingPricePerKg: number;

  stockBeforeKg: number;
  stockAfterKg: number;
  fullStockKg: number;

  receivedAt: string;
};

type PendingProductPayload = {
  productId: string;
  name: string;
  weightKg: number;
  fullStockKg: number;
  pricePerKg: number;
  createdAt: string;
};

type SyncSectionResult = {
  attempted: number;
  synced: number;
  failed: number;
};

type SyncCoordinatorResult = {
  success: boolean;
  skipped: boolean;
  errorMessage: string | null;
  businessSettings: SyncSectionResult;
  products: SyncSectionResult;
  stockBatches: SyncSectionResult;
  sales: SyncSectionResult;
};

type BeginDaySyncResult = {
  success: boolean;
  skipped: boolean;
  errorMessage: string | null;
  businessSettingsRefreshed: boolean;
  productsRefreshed: boolean;
};

export async function getEndOfDayPendingRecordCount(): Promise<number> {
  const localDb = await getDatabase();
  const pendingQueue = await localDb.getFirstAsync<{
    count: number;
  }>(
    `
    SELECT COUNT(*) AS count
    FROM sync_queue
    WHERE status IN ('PENDING', 'FAILED');
    `
  );

  const businessSettings =
    await getLocalBusinessSettings();

  return (pendingQueue?.count ?? 0) +
    (businessSettings.syncStatus === "SYNCED" ? 0 : 1);
}

async function withSyncLock<T>(
  operation: () => Promise<T>
): Promise<{ skipped: boolean; result?: T }> {
  if (syncInProgress) {
    console.log("SYNC SKIPPED: Already in progress.");

    return {
      skipped: true,
    };
  }

  syncInProgress = true;

  try {
    return {
      skipped: false,
      result: await operation(),
    };
  } finally {
    syncInProgress = false;
  }
}


export async function syncPendingSales(): Promise<SyncSectionResult> {
  const localDb = await getDatabase();
  const result: SyncSectionResult = {
    attempted: 0,
    synced: 0,
    failed: 0,
  };

  const pendingJobs =
    await localDb.getAllAsync<SyncQueueRow>(
      `
      SELECT
        id,
        entity_id,
        payload,
        attempt_count
      FROM sync_queue
      WHERE entity_type = 'SALE'
        AND operation = 'CREATE'
        AND status IN ('PENDING', 'FAILED')
      ORDER BY created_at ASC;
      `
    );

  if (pendingJobs.length === 0) {
    return result;
  }

  console.log(`Found ${pendingJobs.length} pending sale(s) to sync.`);

  for (const job of pendingJobs) {
    result.attempted += 1;

    const synced = await syncOneSale(job);

    if (synced) {
      result.synced += 1;
    } else {
      result.failed += 1;
    }
  }

  return result;
}

async function syncOneSale(
  job: SyncQueueRow
): Promise<boolean> {
  const localDb = await getDatabase();
  const now = new Date().toISOString();

  let payload: PendingSalePayload;

  try {
    payload = JSON.parse(
      job.payload
    ) as PendingSalePayload;
  } catch {
    await markSyncFailed(
      job.id,
      job.attempt_count,
      "Invalid sale sync payload."
    );

    return false;
  }

  try {
    /*
     * Mark the queue item as currently being
     * processed.
     */
    await localDb.runAsync(
      `
      UPDATE sync_queue
      SET
        status = 'SYNCING',
        attempt_count = attempt_count + 1,
        last_attempt_at = ?,
        last_error = NULL,
        updated_at = ?
      WHERE id = ?;
      `,
      [now, now, job.id]
    );

    const firestore = getFirestore();

    /*
     * IMPORTANT:
     *
     * We use the LOCAL sale ID as the
     * Firestore document ID.
     *
     * This makes synchronization idempotent.
     *
     * Retrying the same offline sale will not
     * create another sale.
     */
    const saleRef = doc(
      collection(firestore, "sales"),
      payload.saleId
    );

    await runTransaction(
      firestore,
      async (transaction) => {
        /*
         * First check whether this sale already
         * exists in Firebase.
         */
        const existingSale =
          await transaction.get(saleRef);

        /*
         * If it already exists, this job was
         * previously synchronized successfully.
         *
         * Do not reduce stock a second time.
         */
        if (existingSale.exists()) {
          return;
        }

        /*
         * Firestore transactions require reads
         * before writes.
         */
        const productRefs = payload.items.map(
          (item) =>
            doc(
              collection(
                firestore,
                "products"
              ),
              item.productId
            )
        );

        const productSnapshots =
          await Promise.all(
            productRefs.map((productRef) =>
              transaction.get(productRef)
            )
          );

        /*
         * Validate cloud inventory before
         * applying the offline sale.
         */
        for (
          let index = 0;
          index < payload.items.length;
          index += 1
        ) {
          const item = payload.items[index];
          const snapshot =
            productSnapshots[index];

          if (!snapshot.exists()) {
            throw new Error(
              `Product missing in Firebase: ${item.productName}`
            );
          }

          const cloudProduct =
            snapshot.data();

          const cloudWeight =
            typeof cloudProduct.weightKg ===
            "number"
              ? cloudProduct.weightKg
              : 0;

          /*
           * For our current single-device POS,
           * Firebase should still contain the
           * stock level that existed before the
           * offline sale.
           *
           * If it does not, stop rather than
           * silently corrupt inventory.
           */
          const expectedWeight =
            item.stockBeforeKg;

          const difference = Math.abs(
            cloudWeight - expectedWeight
          );

          if (difference > 0.001) {
            throw new Error(
              `Inventory conflict for ${item.productName}. ` +
                `Firebase has ${cloudWeight} kg; ` +
                `offline sale expected ${expectedWeight} kg.`
            );
          }
        }

        /*
         * All checks passed.
         * Apply stock updates.
         */
        payload.items.forEach(
          (item, index) => {
            transaction.update(
              productRefs[index],
              {
                weightKg:
                  item.remainingWeightKg,

                updatedAt:
                  serverTimestamp(),
              }
            );

            /*
             * Deterministic item ID.
             *
             * One product occurs only once in a
             * cart, so productId is safe here.
             */
            const saleItemRef = doc(
              collection(
                saleRef,
                "items"
              ),
              item.productId
            );

            transaction.set(
              saleItemRef,
              {
                productId:
                  item.productId,

                productName:
                  item.productName,

                weightKg:
                  item.weightKg,

                pricePerKg:
                  item.pricePerKg,

                lineTotal:
                  item.lineTotal,

                stockBeforeKg:
                  item.stockBeforeKg,

                stockAfterKg:
                  item.remainingWeightKg,
              }
            );
          }
        );

        /*
         * Preserve when the sale actually
         * happened offline.
         */
        transaction.set(
          saleRef,
          {
            totalAmount:
              payload.totalAmount,

            itemCount:
              payload.items.length,

            schemaVersion: 2,

            soldAt:
              new Date(payload.soldAt),

            syncedAt:
              serverTimestamp(),

            source: "OFFLINE_POS",
          }
        );
      }
    );

    /*
     * Firebase transaction succeeded.
     * Now update local sync state.
     */
    await localDb.withExclusiveTransactionAsync(
      async (txn) => {
        await txn.runAsync(
          `
          UPDATE sync_queue
          SET
            status = 'SYNCED',
            last_error = NULL,
            updated_at = ?
          WHERE id = ?;
          `,
          [new Date().toISOString(), job.id]
        );

        await txn.runAsync(
          `
          UPDATE sales
          SET sync_status = 'SYNCED'
          WHERE id = ?;
          `,
          [payload.saleId]
        );

        await txn.runAsync(
          `
          UPDATE inventory_movements
          SET sync_status = 'SYNCED'
          WHERE movement_type = 'SALE'
            AND reference_id = ?;
          `,
          [payload.saleId]
        );

        /*
         * A product may have several pending
         * movements.
         *
         * Only mark it SYNCED when there are
         * no unsynchronized inventory movements
         * remaining for that product.
         */
        for (const item of payload.items) {
          const pendingMovement =
            await txn.getFirstAsync<{
              id: string;
            }>(
              `
              SELECT id
              FROM inventory_movements
              WHERE product_id = ?
                AND sync_status != 'SYNCED'
              LIMIT 1;
              `,
              [item.productId]
            );

          if (!pendingMovement) {
            await txn.runAsync(
              `
              UPDATE products
              SET sync_status = 'SYNCED'
              WHERE id = ?;
              `,
              [item.productId]
            );
          }
        }
      }
    );

    console.log("SALE SYNCED");
    return true;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : String(error);

    await markSyncFailed(
      job.id,
      job.attempt_count + 1,
      message
    );

    console.log("SALE SYNC FAILED");

    return false;
  }
}

async function markSyncFailed(
  jobId: string,
  attemptCount: number,
  errorMessage: string
): Promise<void> {
  const localDb = await getDatabase();
  const now = new Date().toISOString();

  await localDb.runAsync(
    `
    UPDATE sync_queue
    SET
      status = 'FAILED',
      attempt_count = ?,
      last_attempt_at = ?,
      last_error = ?,
      updated_at = ?
    WHERE id = ?;
    `,
    [
      attemptCount,
      now,
      errorMessage,
      now,
      jobId,
    ]
  );
}

export async function syncPendingStockBatches(): Promise<SyncSectionResult> {
  const localDb = await getDatabase();
  const result: SyncSectionResult = {
    attempted: 0,
    synced: 0,
    failed: 0,
  };

  const pendingJobs =
    await localDb.getAllAsync<SyncQueueRow>(
      `
      SELECT
        id,
        entity_id,
        payload,
        attempt_count
      FROM sync_queue
      WHERE entity_type = 'STOCK_BATCH'
        AND operation = 'CREATE'
        AND status IN ('PENDING', 'FAILED')
      ORDER BY created_at ASC;
      `
    );

  if (pendingJobs.length === 0) {
    return result;
  }

  console.log(`Found ${pendingJobs.length} pending stock batch(es) to sync.`);

  for (const job of pendingJobs) {
    result.attempted += 1;

    const synced = await syncOneStockBatch(job);

    if (synced) {
      result.synced += 1;
    } else {
      result.failed += 1;
    }
  }

  return result;
}

async function syncOneStockBatch(
  job: SyncQueueRow
): Promise<boolean> {
  const localDb = await getDatabase();
  const now = new Date().toISOString();

  let payload: PendingStockBatchPayload;

  try {
    payload = JSON.parse(
      job.payload
    ) as PendingStockBatchPayload;
  } catch {
    await markSyncFailed(
      job.id,
      job.attempt_count,
      "Invalid stock batch sync payload."
    );

    return false;
  }

  try {
    await localDb.runAsync(
      `
      UPDATE sync_queue
      SET
        status = 'SYNCING',
        attempt_count = attempt_count + 1,
        last_attempt_at = ?,
        last_error = NULL,
        updated_at = ?
      WHERE id = ?;
      `,
      [now, now, job.id]
    );

    const firestore = getFirestore();

    const productRef = doc(
      collection(firestore, "products"),
      payload.productId
    );

    /*
     * Use our LOCAL batch ID as the Firebase ID.
     * This prevents duplicates if sync is retried.
     */
    const batchRef = doc(
      collection(firestore, "stockBatches"),
      payload.batchId
    );

    await runTransaction(
      firestore,
      async (transaction) => {
        /*
         * All reads happen before writes.
         */
        const batchSnapshot =
          await transaction.get(batchRef);

        const productSnapshot =
          await transaction.get(productRef);

        /*
         * Already uploaded previously.
         * Do not increase stock twice.
         */
        if (batchSnapshot.exists()) {
          return;
        }

        if (!productSnapshot.exists()) {
          throw new Error(
            `Product missing in Firebase: ${payload.productName}`
          );
        }

        const cloudProduct =
          productSnapshot.data();

        const cloudWeightKg =
          typeof cloudProduct.weightKg === "number"
            ? cloudProduct.weightKg
            : 0;

        /*
         * Protect inventory from silent corruption.
         *
         * Firebase should still contain the stock
         * that existed BEFORE this offline stock-in.
         */
        const difference = Math.abs(
          cloudWeightKg -
            payload.stockBeforeKg
        );

        if (difference > 0.001) {
          throw new Error(
            `Inventory conflict for ${payload.productName}. ` +
              `Firebase has ${cloudWeightKg} kg; ` +
              `stock batch expected ${payload.stockBeforeKg} kg.`
          );
        }

        transaction.update(
          productRef,
          {
            weightKg:
              payload.stockAfterKg,

            fullStockKg:
              payload.fullStockKg,

            pricePerKg:
              Math.round(
                payload.sellingPricePerKg *
                  100
              ) / 100,

            updatedAt:
              serverTimestamp(),
          }
        );

        transaction.set(
          batchRef,
          {
            productId:
              payload.productId,

            productName:
              payload.productName,

            weightReceivedKg:
              payload.addedWeightKg,

            remainingWeightKg:
              payload.addedWeightKg,

            totalPurchaseCost:
              payload.totalPurchaseCost,

            costPerKg:
              payload.costPerKg,

            sellingPricePerKg:
              payload.sellingPricePerKg,

            stockBeforeKg:
              payload.stockBeforeKg,

            stockAfterKg:
              payload.stockAfterKg,

            receivedAt:
              new Date(
                payload.receivedAt
              ),

            syncedAt:
              serverTimestamp(),

            source:
              "OFFLINE_POS",
          }
        );
      }
    );

    /*
     * Firebase succeeded.
     * Mark local records synchronized.
     */
    await localDb.withExclusiveTransactionAsync(
      async (txn) => {
        const syncedAt =
          new Date().toISOString();

        await txn.runAsync(
          `
          UPDATE sync_queue
          SET
            status = 'SYNCED',
            last_error = NULL,
            updated_at = ?
          WHERE id = ?;
          `,
          [syncedAt, job.id]
        );

        await txn.runAsync(
          `
          UPDATE stock_batches
          SET sync_status = 'SYNCED'
          WHERE id = ?;
          `,
          [payload.batchId]
        );

        await txn.runAsync(
          `
          UPDATE inventory_movements
          SET sync_status = 'SYNCED'
          WHERE movement_type = 'STOCK_IN'
            AND reference_id = ?;
          `,
          [payload.batchId]
        );

        /*
         * Only mark product SYNCED when it has
         * no other unsynchronized movements.
         */
        const pendingMovement =
          await txn.getFirstAsync<{
            id: string;
          }>(
            `
            SELECT id
            FROM inventory_movements
            WHERE product_id = ?
              AND sync_status != 'SYNCED'
            LIMIT 1;
            `,
            [payload.productId]
          );

        if (!pendingMovement) {
          await txn.runAsync(
            `
            UPDATE products
            SET sync_status = 'SYNCED'
            WHERE id = ?;
            `,
            [payload.productId]
          );
        }
      }
    );

    console.log("STOCK BATCH SYNCED");
    return true;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : String(error);

    await markSyncFailed(
      job.id,
      job.attempt_count + 1,
      message
    );

    console.log("STOCK BATCH SYNC FAILED");

    return false;
  }
}

export async function syncPendingProducts(): Promise<SyncSectionResult> {
  const localDb = await getDatabase();
  const result: SyncSectionResult = {
    attempted: 0,
    synced: 0,
    failed: 0,
  };

  const pendingJobs =
    await localDb.getAllAsync<SyncQueueRow>(
      `
      SELECT
        id,
        entity_id,
        payload,
        attempt_count
      FROM sync_queue
      WHERE entity_type = 'PRODUCT'
        AND operation = 'CREATE'
        AND status IN ('PENDING', 'FAILED')
      ORDER BY created_at ASC;
      `
    );

  if (pendingJobs.length === 0) {
    return result;
  }

  console.log(`Found ${pendingJobs.length} pending product(s) to sync.`);

  for (const job of pendingJobs) {
    result.attempted += 1;

    const synced = await syncOneProduct(job);

    if (synced) {
      result.synced += 1;
    } else {
      result.failed += 1;
    }
  }

  return result;
}

async function syncOneProduct(
  job: SyncQueueRow
): Promise<boolean> {
  const localDb = await getDatabase();
  const now = new Date().toISOString();

  let payload: PendingProductPayload;

  try {
    payload = JSON.parse(
      job.payload
    ) as PendingProductPayload;
  } catch {
    await markSyncFailed(
      job.id,
      job.attempt_count,
      "Invalid product sync payload."
    );

    return false;
  }

  try {
    await localDb.runAsync(
      `
      UPDATE sync_queue
      SET
        status = 'SYNCING',
        attempt_count = attempt_count + 1,
        last_attempt_at = ?,
        last_error = NULL,
        updated_at = ?
      WHERE id = ?;
      `,
      [now, now, job.id]
    );

    const firestore = getFirestore();

    const productRef = doc(
      collection(firestore, "products"),
      payload.productId
    );

    const existingProduct =
      await getDoc(productRef);

    if (!existingProduct.exists()) {
      await setDoc(productRef, {
        name: payload.name,
        weightKg: payload.weightKg,
        fullStockKg: payload.fullStockKg,
        pricePerKg: payload.pricePerKg,
        active: true,

        createdAt: new Date(
          payload.createdAt
        ),

        updatedAt: serverTimestamp(),

        source: "OFFLINE_POS",
      });
    }

    await localDb.withExclusiveTransactionAsync(
      async (txn) => {
        const syncedAt =
          new Date().toISOString();

        await txn.runAsync(
          `
          UPDATE sync_queue
          SET
            status = 'SYNCED',
            last_error = NULL,
            updated_at = ?
          WHERE id = ?;
          `,
          [syncedAt, job.id]
        );

        /*
         * Only mark the product SYNCED if no
         * other pending work exists for it.
         */
        const pendingJob =
          await txn.getFirstAsync<{
            id: string;
          }>(
            `
            SELECT id
            FROM sync_queue
            WHERE entity_id = ?
              AND status != 'SYNCED'
            LIMIT 1;
            `,
            [payload.productId]
          );

        if (!pendingJob) {
          await txn.runAsync(
            `
            UPDATE products
            SET sync_status = 'SYNCED'
            WHERE id = ?;
            `,
            [payload.productId]
          );
        }
      }
    );

    console.log("PRODUCT SYNCED");
    return true;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : String(error);

    await markSyncFailed(
      job.id,
      job.attempt_count + 1,
      message
    );

    console.log("PRODUCT SYNC FAILED");

    return false;
  }
}
let syncInProgress = false;

async function syncPendingBusinessSettings(): Promise<SyncSectionResult> {
  const localSettings = await getLocalBusinessSettings();
  const result: SyncSectionResult = {
    attempted: 0,
    synced: 0,
    failed: 0,
  };

  if (localSettings.syncStatus === "SYNCED") {
    return result;
  }

  result.attempted = 1;

  const snapshotUpdatedAt = localSettings.updatedAt;

  try {
    await saveLocalBusinessSettings({
      ...localSettings,
      syncStatus: "SYNCING",
    });

    const firestore = getFirestore();
    const settingsRef = doc(
      collection(firestore, "settings"),
      "business"
    );

    await setDoc(
      settingsRef,
      {
        reorderPercent: localSettings.reorderPercent,
        markupPercent: localSettings.markupPercent,
        voiceEnabled: localSettings.voiceEnabled,
        updatedAt: serverTimestamp(),
      },
      {
        merge: true,
      }
    );

    const currentLocal =
      await getLocalBusinessSettings();

    if (currentLocal.updatedAt !== snapshotUpdatedAt) {
      console.warn("BUSINESS SETTINGS CHANGED DURING SYNC");

      result.failed = 1;
      return result;
    }

    await saveLocalBusinessSettings({
      ...localSettings,
      updatedAt: snapshotUpdatedAt,
      syncStatus: "SYNCED",
    });

    result.synced = 1;
    return result;
  } catch {
    await saveLocalBusinessSettings({
      ...localSettings,
      updatedAt: snapshotUpdatedAt,
      syncStatus: "FAILED",
    });

    result.failed = 1;

    console.log("BUSINESS SETTINGS SYNC FAILED");

    return result;
  }
}

export async function beginDaySync(): Promise<BeginDaySyncResult> {
  try {
    const lockResult = await withSyncLock(async () => {
      try {
        await refreshBusinessSettingsFromFirebase();
        await refreshProductsFromFirebase();

        return {
          success: true,
          skipped: false,
          errorMessage: null,
          businessSettingsRefreshed: true,
          productsRefreshed: true,
        } satisfies BeginDaySyncResult;
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : String(error);

        console.error("BEGIN DAY SYNC FAILED");

        return {
          success: false,
          skipped: false,
          errorMessage: message,
          businessSettingsRefreshed: false,
          productsRefreshed: false,
        } satisfies BeginDaySyncResult;
      }
    });

    if (lockResult.skipped) {
      return {
        success: false,
        skipped: true,
        errorMessage: "Sync already in progress.",
        businessSettingsRefreshed: false,
        productsRefreshed: false,
      };
    }

    return lockResult.result!;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : String(error);

    console.error("BEGIN DAY SYNC FAILED");

    return {
      success: false,
      skipped: false,
      errorMessage: message,
      businessSettingsRefreshed: false,
      productsRefreshed: false,
    };
  }
}

export async function syncPendingChanges(): Promise<SyncCoordinatorResult> {
  try {
    const lockResult = await withSyncLock(async () => {
      const businessSettings =
        await syncPendingBusinessSettings();
      const products = await syncPendingProducts();
      const stockBatches =
        await syncPendingStockBatches();
      const sales = await syncPendingSales();

      const failedCount =
        businessSettings.failed +
        products.failed +
        stockBatches.failed +
        sales.failed;

      return {
        success: failedCount === 0,
        skipped: false,
        errorMessage:
          failedCount === 0
            ? null
            : "One or more sync jobs failed.",
        businessSettings,
        products,
        stockBatches,
        sales,
      } satisfies SyncCoordinatorResult;
    });

    if (lockResult.skipped) {
      return {
        success: false,
        skipped: true,
        errorMessage: "Sync already in progress.",
        businessSettings: {
          attempted: 0,
          synced: 0,
          failed: 0,
        },
        products: {
          attempted: 0,
          synced: 0,
          failed: 0,
        },
        stockBatches: {
          attempted: 0,
          synced: 0,
          failed: 0,
        },
        sales: {
          attempted: 0,
          synced: 0,
          failed: 0,
        },
      };
    }

    return lockResult.result!;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : String(error);

    console.error("SYNC FAILED");

    return {
      success: false,
      skipped: false,
      errorMessage: message,
      businessSettings: {
        attempted: 0,
        synced: 0,
        failed: 0,
      },
      products: {
        attempted: 0,
        synced: 0,
        failed: 0,
      },
      stockBatches: {
        attempted: 0,
        synced: 0,
        failed: 0,
      },
      sales: {
        attempted: 0,
        synced: 0,
        failed: 0,
      },
    };
  }
}

export async function endDaySync(): Promise<SyncCoordinatorResult> {
  return syncPendingChanges();
}
