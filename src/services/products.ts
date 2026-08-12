import {
  collection,
  doc,
  getDocs,
  getFirestore,
  serverTimestamp,
  setDoc,
} from "@react-native-firebase/firestore";

export type ProductRecord = {
  id: string;
  name: string;
  weightKg: number;
  fullStockKg: number;
  pricePerKg: number;
};

const COLLECTION_NAME = "products";

export async function loadProducts(): Promise<ProductRecord[]> {
  const db = getFirestore();

  const snapshot = await getDocs(
    collection(db, COLLECTION_NAME)
  );

  return snapshot.docs.map((document) => {
    const data = document.data();

    return {
      id: document.id,
      name:
        typeof data.name === "string"
          ? data.name
          : "Unknown Product",

      weightKg:
        typeof data.weightKg === "number"
          ? data.weightKg
          : 0,

      fullStockKg:
        typeof data.fullStockKg === "number"
          ? data.fullStockKg
          : 1,

      pricePerKg:
        typeof data.pricePerKg === "number"
          ? data.pricePerKg
          : 0,
    };
  });
}

export async function saveProduct(
  product: ProductRecord
) {
  const db = getFirestore();

  await setDoc(
    doc(
      collection(db, COLLECTION_NAME),
      product.id
    ),
    {
      name: product.name,
      weightKg: product.weightKg,
      fullStockKg: product.fullStockKg,
      pricePerKg: product.pricePerKg,
      updatedAt: serverTimestamp(),
    },
    {
      merge: true,
    }
  );
}

export async function seedProducts(
  products: ProductRecord[]
) {
  for (const product of products) {
    await saveProduct(product);
  }
}