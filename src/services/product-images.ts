import {
  getDownloadURL,
  getStorage,
  ref,
} from "@react-native-firebase/storage";

export async function getProductImageUrl(
  imagePath: string
): Promise<string | null> {

  try{
    console.log("imagepath" , imagePath)

    //comments: check 1
  const storage = getStorage();

  const imageRef = ref(
    storage,
    imagePath
  );

  //comments: check 2
  console.log(
      "STORAGE REF:",
      imageRef.fullPath);

  
    const url = await getDownloadURL(
      imageRef
    );

    console.log(
      "IMAGE DOWNLOAD URL:",
      url
    );

    return url;

  } catch (error) {
    console.error(
      "Failed to load product image:",
      imagePath,
      error
    );

    return null;
  }
}
