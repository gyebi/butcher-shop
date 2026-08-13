import {
  getDownloadURL,
  getStorage,
  ref,
} from "@react-native-firebase/storage";

export async function getProductImageUrl(
  imagePath: string
): Promise<string> {
  const storage = getStorage();

  const imageRef = ref(
    storage,
    imagePath
  );

  return await getDownloadURL(imageRef);
}
