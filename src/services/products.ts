import {
  addDoc,
  collection,
  doc,
  getDocs,
  getFirestore,
  serverTimestamp,
  setDoc,
} from "@react-native-firebase/firestore";

import { getProductImageUrl } from "@/src/services/product-images";
import { getLocalProducts, saveLocalProduct } from "@/src/db/repositories/products-repository";


export type ProductRecord = {
  id: string;
  name: string;
  weightKg: number;
  fullStockKg: number;
  pricePerKg: number;
  imagePath?: string;
  imageUrl?: string;
};

export type CreateProductInput = {
  name: string;
  fullStockKg: number;
  pricePerKg: number;
};

const COLLECTION_NAME = "products";

export async function createProduct(
  input: CreateProductInput
): Promise<ProductRecord> {
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

  const db = getFirestore();

  const productData = {
    name,

    // New product exists, but no physical
    // stock has been received yet.
    weightKg: 0,

    fullStockKg: input.fullStockKg,

    pricePerKg:
      Math.round(input.pricePerKg * 100) / 100,

    active: true,

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const productRef = await addDoc(
    collection(db, COLLECTION_NAME),
    productData
  );

  return {
    id: productRef.id,
    name,
    weightKg: 0,
    fullStockKg: input.fullStockKg,
    pricePerKg:
      Math.round(input.pricePerKg * 100) / 100,
  };
}

export async function loadProducts(): Promise<ProductRecord[]> {
  try {
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

    const productsWithImages = await Promise.all(
      products.map(async (product) => {
        if (!product.imagePath) {
          return product;
        }

        const imageUrl = await getProductImageUrl(
          product.imagePath
        );

        return {
          ...product,
          imageUrl: imageUrl ?? undefined,
        };
      })
    );

    await cacheProductsLocally(productsWithImages);

    return productsWithImages;
  } catch (error) {
    console.warn(
      "Firebase product load failed. Falling back to SQLite.",
      error
    );

    const localProducts = await getLocalProducts();

    return localProducts.map((product) => ({
      id: product.id,
      name: product.name,
      weightKg: product.weightKg,
      fullStockKg: product.fullStockKg,
      pricePerKg: product.sellingPricePesewas / 100,
      imagePath: product.imagePath ?? undefined,

      // We deliberately do not generate a Firebase
      // download URL here while offline.
      imageUrl: product.localImageUri ?? undefined,
    }));
  }
}

export async function updateProductImage(
  productId: string,
  imagePath: string
) {
  const db = getFirestore();

  const productRef = doc(
    collection(db, COLLECTION_NAME),
    productId
  );

  await setDoc(
    productRef,
    {
      imagePath,
      updatedAt: serverTimestamp(),
    },
    {
      merge: true,
    }
  );
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

/*
export async function cacheProductsLocally(
  products: ProductRecord[]
): Promise<void> {
  for (const product of products) {
    await saveLocalProduct({
      id: product.id,
      name: product.name,

      categoryId: null,
      sku: null,

      sellingPricePesewas: Math.round(
        product.pricePerKg * 100
      ),

      costPricePesewas: null,

      weightKg: product.weightKg,
      fullStockKg: product.fullStockKg,

      unit: "kg",

      imagePath: product.imagePath ?? null,
      localImageUri: null,

      active: true,

      updatedAt: new Date().toISOString(),

      syncStatus: "SYNCED",
    });
  }
}
  */

export async function cacheProductsLocally(
  products: ProductRecord[]
): Promise<void> {
  for (const product of products) {
    await saveLocalProduct({
      id: product.id,
      name: product.name,
      categoryId: null,
      sku: null,
      sellingPricePesewas: Math.round(product.pricePerKg * 100),
      costPricePesewas: null,
      weightKg: product.weightKg,
      fullStockKg: product.fullStockKg,
      unit: "kg",
      imagePath: product.imagePath ?? null,
      localImageUri: null,
      active: true,
      updatedAt: new Date().toISOString(),
      syncStatus: "SYNCED",
    });
  }

  const localProducts = await getLocalProducts();

  console.log(
    `Cached ${products.length} Firebase products into SQLite.`
  );

  console.log("SQLite products after Firebase cache:", localProducts);
}