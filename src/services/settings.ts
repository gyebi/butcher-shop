import {
  getLocalBusinessSettings,
  saveLocalBusinessSettings,
} from "@/src/db/repositories/business-settings-repository";
import {
  collection,
  doc,
  getDoc,
  getFirestore,
} from "@react-native-firebase/firestore";

export type BusinessSettings = {
  reorderPercent: number;
  markupPercent: number;
  voiceEnabled: boolean;
};

const SETTINGS_COLLECTION = "settings";
const SETTINGS_DOC = "business";

/**
 * Local-first settings read for normal UI use.
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
 * BOD cloud refresh for business settings.
 * Any non-synced local row wins over cloud data.
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

  // Keep any local row that still needs sync.
  if (currentLocal.syncStatus !== "SYNCED") {
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
 * Local-only save during the trading day.
 */
export async function saveBusinessSettings(
  settings: BusinessSettings
): Promise<void> {
  const updatedAt =
    new Date().toISOString();

  await saveLocalBusinessSettings({
    ...settings,
    updatedAt,
    syncStatus: "PENDING",
  });
}
