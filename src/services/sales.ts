import {
  collection,
  doc,
  getFirestore,
  runTransaction,
  serverTimestamp,
} from "@react-native-firebase/firestore";

export type SaleTransactionItem = {
  productId: string;
  weightKg: number;
};

export type CompletedSaleItem = {
  productId: string;
  productName: string;
  weightKg: number;
  pricePerKg: number;
  lineTotal: number;
  stockBeforeKg: number;
  remainingWeightKg: number;
};

export type SaleResult = {
  saleId: string;
  totalAmount: number;
  items: CompletedSaleItem[];
};

export async function completeSaleTransaction({
  items,
}: {
  items: SaleTransactionItem[];
}): Promise<SaleResult> {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("Sale must contain at least one item.");
  }

  for (const item of items) {
    if (
      !item.productId ||
      !Number.isFinite(item.weightKg) ||
      item.weightKg <= 0
    ) {
      throw new Error("Sale contains an invalid item.");
    }
  }

  // For now, each product should appear once in the cart.
  // The UI will combine repeated selections.
  const productIds = items.map((item) => item.productId);

  if (new Set(productIds).size !== productIds.length) {
    throw new Error(
      "The same product appears more than once in the sale.",
    );
  }

  const db = getFirestore();

  // Generate sale ID before the transaction.
  const saleRef = doc(collection(db, "sales"));

  return runTransaction(db, async (transaction) => {
    /*
     * IMPORTANT:
     * Read ALL product documents first.
     * Only after every read succeeds do we start writing.
     */
    const productSnapshots = await Promise.all(
      items.map((item) => {
        const productRef = doc(
          collection(db, "products"),
          item.productId,
        );

        return transaction.get(productRef);
      }),
    );

    const completedItems: CompletedSaleItem[] = [];

    /*
     * Validate every item before writing anything.
     */
    for (let index = 0; index < items.length; index += 1) {
      const requestedItem = items[index];
      const productSnapshot = productSnapshots[index];

      if (!productSnapshot.exists()) {
        throw new Error("One of the products no longer exists.");
      }

      const product = productSnapshot.data();

      const currentWeight =
        typeof product.weightKg === "number"
          ? product.weightKg
          : 0;

      const pricePerKg =
        typeof product.pricePerKg === "number"
          ? product.pricePerKg
          : 0;

      const productName =
        typeof product.name === "string"
          ? product.name
          : "Unknown Product";

      if (pricePerKg <= 0) {
        throw new Error(
          `${productName} has no valid selling price.`,
        );
      }

      if (requestedItem.weightKg > currentWeight) {
        throw new Error(
          `${productName}: only ${currentWeight.toFixed(
            2,
          )} kg is available.`,
        );
      }

      const remainingWeightKg =
        Math.round(
          (currentWeight - requestedItem.weightKg) * 1000,
        ) / 1000;

      const lineTotal =
        Math.round(
          requestedItem.weightKg * pricePerKg * 100,
        ) / 100;

      completedItems.push({
        productId: requestedItem.productId,
        productName,
        weightKg: requestedItem.weightKg,
        pricePerKg,
        lineTotal,
        stockBeforeKg: currentWeight,
        remainingWeightKg,
      });
    }

    const totalAmount =
      Math.round(
        completedItems.reduce(
          (sum, item) => sum + item.lineTotal,
          0,
        ) * 100,
      ) / 100;

    /*
     * Everything is valid.
     * Now perform the writes.
     */

    completedItems.forEach((item) => {
      const productRef = doc(
        collection(db, "products"),
        item.productId,
      );

      transaction.update(productRef, {
        weightKg: item.remainingWeightKg,
        updatedAt: serverTimestamp(),
      });

      // One historical item record per product sold.
      const saleItemRef = doc(
        collection(saleRef, "items"),
      );

      transaction.set(saleItemRef, {
        productId: item.productId,
        productName: item.productName,

        weightKg: item.weightKg,

        // Historical price snapshot.
        pricePerKg: item.pricePerKg,

        lineTotal: item.lineTotal,

        stockBeforeKg: item.stockBeforeKg,
        stockAfterKg: item.remainingWeightKg,
      });
    });

    // One sale document for the whole customer transaction.
    transaction.set(saleRef, {
      totalAmount,
      itemCount: completedItems.length,

      // Helps us distinguish the new cart-based structure
      // from existing single-product sales.
      schemaVersion: 2,

      soldAt: serverTimestamp(),
    });

    return {
      saleId: saleRef.id,
      totalAmount,
      items: completedItems,
    };
  });
}