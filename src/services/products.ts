import {
  collection,
  doc,
  getDocs,
  getFirestore,
  serverTimestamp,
  setDoc,
} from "@react-native-firebase/firestore";

import { getProductImageUrl } from "@/src/services/product-images";

export type ProductRecord = {
  id: string;
  name: string;
  weightKg: number;
  fullStockKg: number;
  pricePerKg: number;
  imagePath?: string;
  imageUrl?: string;
};

const COLLECTION_NAME = "products";

export async function loadProducts(): Promise<ProductRecord[]> {
  const db = getFirestore();

  const snapshot = await getDocs(
    collection(db, COLLECTION_NAME)
  );

  const products = snapshot.docs.map((document) => {
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

      imagePath:
        typeof data.imagePath === "string"
          ? data.imagePath
          : undefined,
    };
  });

  const productsWithImages =
    await Promise.all(
      products.map(async (product) => {
        if (!product.imagePath) {
          return product;
        }

        const imageUrl =
          await getProductImageUrl(
            product.imagePath
          );

        return {
          ...product,
          imageUrl:
            imageUrl ?? undefined,
        };
      })
    );

  return productsWithImages;
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
      imagePath: product.imagePath ?? null,
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
