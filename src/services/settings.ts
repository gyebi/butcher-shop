import {
  collection,
  doc,
  getDoc,
  getFirestore,
  serverTimestamp,
  setDoc,
} from "@react-native-firebase/firestore";

export type BusinessSettings = {
  reorderPercent: number;
  markupPercent: number;
  voiceEnabled: boolean;
};

const SETTINGS_COLLECTION = "settings";
const SETTINGS_DOC = "business";

export async function loadBusinessSettings(): Promise<BusinessSettings | null> {
  const db = getFirestore();

  const settingsCollection = collection(
    db,
    SETTINGS_COLLECTION
  );

  const settingsRef = doc(
    settingsCollection,
    SETTINGS_DOC
  );

  const snapshot = await getDoc(settingsRef);

  if (!snapshot.exists()) {
    return null;
  }

  const data = snapshot.data();

  return {
    reorderPercent:
      typeof data?.reorderPercent === "number"
        ? data.reorderPercent
        : 20,

    markupPercent:
      typeof data?.markupPercent === "number"
        ? data.markupPercent
        : 25,

    voiceEnabled:
      typeof data?.voiceEnabled === "boolean"
        ? data.voiceEnabled
        : true,
  };
}

export async function saveBusinessSettings(
  settings: BusinessSettings
) {
  const db = getFirestore();

  const settingsCollection = collection(
    db,
    SETTINGS_COLLECTION
  );

  const settingsRef = doc(
    settingsCollection,
    SETTINGS_DOC
  );

  await setDoc(
    settingsRef,
    {
      ...settings,
      updatedAt: serverTimestamp(),
    },
    {
      merge: true,
    }
  );
}