
import * as FileSystem from "expo-file-system/legacy";

function getFileExtension({
  fileName,
  mimeType,
  uri,
}: {
  fileName?: string | null;
  mimeType?: string | null;
  uri: string;
}): string {
  const nameToCheck =
    fileName ??
    uri.split("?")[0];

  const match =
    nameToCheck.match(/\.([a-zA-Z0-9]+)$/);

  if (match) {
    return match[1].toLowerCase();
  }

  switch (mimeType) {
    case "image/png":
      return "png";

    case "image/webp":
      return "webp";

    case "image/jpeg":
      return "jpg";

    default:
      return "img";
  }
}

export async function saveProductImageLocally(
  productId: string,
  selectedUri: string,
  fileName?: string | null,
  mimeType?: string | null
): Promise<string> {
  if (!selectedUri) {
    throw new Error("No image file was selected.");
  }

  const documentDirectory =
    FileSystem.documentDirectory;

  if (!documentDirectory) {
    throw new Error(
      "Local application storage is unavailable."
    );
  }

  const imageDirectory =
    `${documentDirectory}product-images/`;

  const directoryInfo =
    await FileSystem.getInfoAsync(
      imageDirectory
    );

  if (!directoryInfo.exists) {
    await FileSystem.makeDirectoryAsync(
      imageDirectory,
      {
        intermediates: true,
      }
    );
  }

  const extension = getFileExtension({
    fileName,
    mimeType,
    uri: selectedUri,
  });

  const destination =
    `${imageDirectory}${productId}.${extension}`;

  /*
   * If this product already has a locally
   * stored image at this destination,
   * remove it before replacing it.
   */
  const existing =
    await FileSystem.getInfoAsync(
      destination
    );

  if (existing.exists) {
    await FileSystem.deleteAsync(
      destination,
      {
        idempotent: true,
      }
    );
  }

  await FileSystem.copyAsync({
    from: selectedUri,
    to: destination,
  });

  return destination;
}
