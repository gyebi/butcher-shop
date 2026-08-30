import {
  collection,
  doc,
  getDoc,
  getFirestore,
  serverTimestamp,
  setDoc,
} from "@react-native-firebase/firestore";

import {
  getLocalBusinessSettings,
  saveLocalBusinessSettings,
} from "@/src/db/repositories/business-settings-repository";

export type BusinessSettings = {
  reorderPercent: number;
  markupPercent: number;
  voiceEnabled: boolean;
};

const SETTINGS_COLLECTION = "settings";
const SETTINGS_DOC = "business";

/**
 * LOCAL FIRST
 *
 * This is what the UI should call when it needs settings.
 * It does not require Firebase.
 */
export async function loadBusinessSettings(): Promise<BusinessSettings> {
  const localSettings = await getLocalBusinessSettings();

  return {
    reorderPercent: localSettings.reorderPercent,
    markupPercent: localSettings.markupPercent,
    voiceEnabled: localSettings.voiceEnabled,
  };
}

/**
 * CLOUD REFRESH
 *
 * Call this in the background when internet is available.
 * It must not overwrite local PENDING changes.
 */
export async function refreshBusinessSettingsFromFirebase():
  Promise<BusinessSettings | null> {
  const firestore = getFirestore();

  const settingsRef = doc(
    collection(
      firestore,
      SETTINGS_COLLECTION
    ),
    SETTINGS_DOC
  );

  const snapshot = await getDoc(settingsRef);

  if (!snapshot.exists()) {
    return null;
  }

  const data = snapshot.data();

  const firebaseSettings: BusinessSettings = {
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

  const currentLocal =
    await getLocalBusinessSettings();

  // Do not overwrite settings changed locally
  // but not yet synchronized.
  if (currentLocal.syncStatus === "PENDING") {
    return {
      reorderPercent:
        currentLocal.reorderPercent,
      markupPercent:
        currentLocal.markupPercent,
      voiceEnabled:
        currentLocal.voiceEnabled,
    };
  }

  await saveLocalBusinessSettings({
    ...firebaseSettings,
    updatedAt: new Date().toISOString(),
    syncStatus: "SYNCED",
  });

  return firebaseSettings;
}

/**
 * LOCAL-FIRST SAVE
 *
 * Save immediately to SQLite.
 * Firebase is attempted afterward.
 */
export async function saveBusinessSettings(
  settings: BusinessSettings
): Promise<void> {
  const updatedAt =
    new Date().toISOString();

  // 1. Save locally immediately.
  await saveLocalBusinessSettings({
    ...settings,
    updatedAt,
    syncStatus: "PENDING",
  });

  // 2. Try Firebase without making the
  // local save depend on the network.
  void syncBusinessSettingsToFirebase(
    settings,
    updatedAt
  );
}

async function syncBusinessSettingsToFirebase(
  settings: BusinessSettings,
  localUpdatedAt: string
): Promise<void> {
  try {
    const firestore = getFirestore();

    const settingsRef = doc(
      collection(
        firestore,
        SETTINGS_COLLECTION
      ),
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

    // Check that the user has not made another
    // local change while Firebase was saving.
    const currentLocal =
      await getLocalBusinessSettings();

    if (
      currentLocal.updatedAt !==
      localUpdatedAt
    ) {
      return;
    }

    await saveLocalBusinessSettings({
      ...settings,
      updatedAt: localUpdatedAt,
      syncStatus: "SYNCED",
    });
  } catch (error) {
    // This is acceptable offline.
    // SQLite already contains the change
    // and remains PENDING.
    console.log(
      "Business settings saved locally; Firebase unavailable.",
      error
    );
  }
}