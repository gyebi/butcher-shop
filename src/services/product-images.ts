import {
  getDownloadURL,
  getStorage,
  putFile,
  ref,
} from "@react-native-firebase/storage";

export async function getProductImageUrl(
  imagePath: string
): Promise<string | null> {
  try {
    const storage = getStorage();
    const imageRef = ref(storage, imagePath);
    return await getDownloadURL(imageRef);
  } catch (error) {
    console.error(
      "Failed to load product image:",
      imagePath,
      error
    );

    return null;
  }
}

export async function uploadProductImage(
  productId: string,
  localUri: string
) {
  const storage = getStorage();

  const imagePath = `products/product-${productId}.jpg`;
  const imageRef = ref(storage, imagePath);
  const localPath = localUri.replace("file://", "");

  await putFile(imageRef, localPath, {
    contentType: "image/jpeg",
  });

  const imageUrl = await getDownloadURL(imageRef);

  return {
    imagePath,
    imageUrl,
  };
}
