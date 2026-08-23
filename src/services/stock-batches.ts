import {
  collection,
  doc,
  getFirestore,
  runTransaction,
  serverTimestamp,
} from "@react-native-firebase/firestore";

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
    throw new Error(
      "Invalid purchase cost."
    );
  }

  if (
    !Number.isFinite(costPerKg) ||
    costPerKg <= 0
  ) {
    throw new Error(
      "Invalid cost per kg."
    );
  }

  if (
    !Number.isFinite(sellingPricePerKg) ||
    sellingPricePerKg <= 0
  ) {
    throw new Error(
      "Invalid selling price."
    );
  }

  const db = getFirestore();

  const productRef = doc(
    collection(db, "products"),
    productId
  );

  // Generate the batch ID before entering
  // the transaction.
  const batchRef = doc(
    collection(db, "stockBatches")
  );

  const result = await runTransaction(
    db,
    async (transaction) => {
      const productSnapshot =
        await transaction.get(productRef);

      if (!productSnapshot.exists()) {
        throw new Error(
          "Product not found."
        );
      }

      const product =
        productSnapshot.data();

      const currentWeightKg =
        typeof product.weightKg === "number"
          ? product.weightKg
          : 0;

      const currentFullStockKg =
        typeof product.fullStockKg === "number"
          ? product.fullStockKg
          : 0;

      const productName =
        typeof product.name === "string"
          ? product.name
          : "Unknown Product";

      const newWeightKg =
        Math.round(
          (currentWeightKg +
            addedWeightKg) *
            1000
        ) / 1000;

      const roundedSellingPrice =
        Math.round(
          sellingPricePerKg * 100
        ) / 100;

      const newFullStockKg =
        Math.max(
          currentFullStockKg,
          newWeightKg
        );

      // Update current dashboard state.
      transaction.update(productRef, {
        weightKg: newWeightKg,
        fullStockKg: newFullStockKg,
        pricePerKg:
          roundedSellingPrice,
        updatedAt:
          serverTimestamp(),
      });

      // Preserve this specific purchase forever.
      transaction.set(batchRef, {
        productId,
        productName,

        weightReceivedKg:
          addedWeightKg,

        remainingWeightKg:
          addedWeightKg,

        totalPurchaseCost,

        costPerKg,

        sellingPricePerKg:
          roundedSellingPrice,

        stockBeforeKg:
          currentWeightKg,

        stockAfterKg:
          newWeightKg,

        receivedAt:
          serverTimestamp(),
      });

      return {
        batchId: batchRef.id,
        newWeightKg,
        sellingPricePerKg:
          roundedSellingPrice,
        fullStockKg:
          newFullStockKg,
      };
    }
  );

  return result;
}