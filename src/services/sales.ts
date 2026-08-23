
import {
  collection,
  doc,
  getFirestore,
  runTransaction,
  serverTimestamp,
} from "@react-native-firebase/firestore";

export type SaleResult = {
  saleId: string;
  remainingWeightKg: number;
  totalAmount: number;
};

export async function completeSaleTransaction({
  productId,
  weightKg,
}: {
  productId: string;
  weightKg: number;
}): Promise<SaleResult> {
  if (!Number.isFinite(weightKg) || weightKg <= 0) {
    throw new Error("Invalid sale weight.");
  }

  const db = getFirestore();

  const productRef = doc(
    collection(db, "products"),
    productId
  );

  // Generate the ID before entering the transaction.
  const saleRef = doc(collection(db, "sales"));

  const result = await runTransaction(
    db,
    async (transaction) => {
      // IMPORTANT:
      // All reads happen before writes.
      const productSnapshot =
        await transaction.get(productRef);

      if (!productSnapshot.exists()) {
        throw new Error("Product not found.");
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
          "Product has no valid selling price."
        );
      }

      if (weightKg > currentWeight) {
        throw new Error(
          `Only ${currentWeight.toFixed(
            2
          )} kg is available.`
        );
      }

      const remainingWeightKg =
        Math.round(
          (currentWeight - weightKg) * 1000
        ) / 1000;

      const totalAmount =
        Math.round(
          weightKg * pricePerKg * 100
        ) / 100;

      transaction.update(productRef, {
        weightKg: remainingWeightKg,
        updatedAt: serverTimestamp(),
      });

      transaction.set(saleRef, {
        productId,
        productName,

        weightKg,

        // Snapshot the price at the moment of sale.
        // Future price changes must not alter history.
        pricePerKg,

        totalAmount,

        stockBeforeKg: currentWeight,
        stockAfterKg: remainingWeightKg,

        soldAt: serverTimestamp(),
      });

      return {
        saleId: saleRef.id,
        remainingWeightKg,
        totalAmount,
      };
    }
  );

  return result;
}
