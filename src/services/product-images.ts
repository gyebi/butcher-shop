import {
  getDownloadURL,
  getStorage,
  deleteObject,
  listAll,
  putFile,
  ref,
} from "@react-native-firebase/storage";

const PRODUCT_IMAGE_FOLDER = "products";
const PRODUCT_IMAGE_PREFIX = "product-";

function buildProductImagePath(
  productId: string,
  timestamp = Date.now()
) {
  return `${PRODUCT_IMAGE_FOLDER}/${PRODUCT_IMAGE_PREFIX}${productId}-${timestamp}.jpg`;
}

function buildLegacyProductImagePath(
  productId: string
) {
  return `${PRODUCT_IMAGE_FOLDER}/${PRODUCT_IMAGE_PREFIX}${productId}.jpg`;
}

function normalizeLocalPath(localUri: string) {
  return localUri.startsWith("file://")
    ? localUri.slice("file://".length)
    : localUri;
}

function isProductImagePath(
  fullPath: string,
  productId: string
) {
  const productPrefix =
    `${PRODUCT_IMAGE_FOLDER}/${PRODUCT_IMAGE_PREFIX}${productId}`;

  return (
    fullPath === buildLegacyProductImagePath(productId) ||
    fullPath.startsWith(`${productPrefix}-`)
  );
}

async function removeProductImageVariants(
  productId: string,
  keepImagePath?: string
) {
  const storage = getStorage();
  const folderRef = ref(storage, PRODUCT_IMAGE_FOLDER);

  try {
    const listing = await listAll(folderRef);

    for (const imageRef of listing.items) {
      if (!isProductImagePath(imageRef.fullPath, productId)) {
        continue;
      }

      if (keepImagePath && imageRef.fullPath === keepImagePath) {
        continue;
      }

      try {
        await deleteObject(imageRef);
      } catch (error) {
        console.warn(
          "Failed to delete stale product image:",
          imageRef.fullPath,
          error
        );
      }
    }
  } catch (error) {
    console.warn(
      "Failed to list product images for cleanup:",
      productId,
      error
    );
  }
}

export async function getProductImageUrl(
  imagePath: string
): Promise<string | null> {
  try {
    const storage = getStorage();
    const imageRef = ref(storage, imagePath);
    const imageUrl = await getDownloadURL(imageRef);

    console.log(
      "IMAGE DISPLAY URL:",
      imagePath,
      imageUrl
    );

    return imageUrl;
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

  const imagePath = buildProductImagePath(productId);

  const imageRef = ref(
    storage,
    imagePath
  );

  const localPath = normalizeLocalPath(localUri);

  console.log(
    "IMAGE UPLOAD START:",
    productId,
    imagePath,
    localPath
  );

  await putFile(
    imageRef,
    localPath,
    {
      contentType: "image/jpeg",
    }
  );

  console.log(
    "IMAGE UPLOAD COMPLETE:",
    productId,
    imagePath
  );

  const imageUrl =
    await getDownloadURL(imageRef);

  console.log(
    "IMAGE STORAGE PATH:",
    imagePath
  );

  console.log(
    "IMAGE DISPLAY URL:",
    imagePath,
    imageUrl
  );

  await removeProductImageVariants(
    productId,
    imagePath
  );

  return {
    imagePath,
    imageUrl,
  };
}

export async function deleteProductImage(
  productId: string,
  imagePath?: string
): Promise<string> {
  const storage = getStorage();
  const legacyImagePath =
    buildLegacyProductImagePath(productId);

  try {
    console.log(
      "IMAGE DELETE START:",
      productId,
      imagePath ?? legacyImagePath
    );

    if (imagePath) {
      try {
        await deleteObject(ref(storage, imagePath));
      } catch (error) {
        console.warn(
          "Failed to delete product image:",
          imagePath,
          error
        );
      }
    }

    await removeProductImageVariants(
      productId,
      imagePath
    );

    console.log(
      "IMAGE DELETE COMPLETE:",
      productId,
      imagePath ?? legacyImagePath
    );
  } catch (error) {
    console.warn(
      "Failed to clean up product image variants:",
      productId,
      error
    );
  }

  return imagePath ?? legacyImagePath;
}
