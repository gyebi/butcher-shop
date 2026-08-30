
import { getDatabase } from "@/src/db/database";

export type LocalBusinessSettings = {
  reorderPercent: number;
  markupPercent: number;
  voiceEnabled: boolean;
  updatedAt: string;
  syncStatus: "PENDING" | "SYNCING" | "SYNCED" | "FAILED";
};

type BusinessSettingsRow = {
  reorder_percent: number;
  markup_percent: number;
  voice_enabled: number;
  updated_at: string;
  sync_status: LocalBusinessSettings["syncStatus"];
};

export async function getLocalBusinessSettings(): Promise<LocalBusinessSettings> {
  const db = await getDatabase();

  const row = await db.getFirstAsync<BusinessSettingsRow>(
    `
    SELECT
      reorder_percent,
      markup_percent,
      voice_enabled,
      updated_at,
      sync_status
    FROM business_settings
    WHERE id = 1;
    `
  );

  if (!row) {
    return {
      reorderPercent: 20,
      markupPercent: 25,
      voiceEnabled: true,
      updatedAt: new Date().toISOString(),
      syncStatus: "SYNCED",
    };
  }

  return {
    reorderPercent: row.reorder_percent,
    markupPercent: row.markup_percent,
    voiceEnabled: row.voice_enabled === 1,
    updatedAt: row.updated_at,
    syncStatus: row.sync_status,
  };
}

export async function saveLocalBusinessSettings(
  settings: LocalBusinessSettings
): Promise<void> {
  const db = await getDatabase();

  await db.runAsync(
    `
    INSERT INTO business_settings (
      id,
      reorder_percent,
      markup_percent,
      voice_enabled,
      updated_at,
      sync_status
    )
    VALUES (1, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      reorder_percent = excluded.reorder_percent,
      markup_percent = excluded.markup_percent,
      voice_enabled = excluded.voice_enabled,
      updated_at = excluded.updated_at,
      sync_status = excluded.sync_status;
    `,
    [
      settings.reorderPercent,
      settings.markupPercent,
      settings.voiceEnabled ? 1 : 0,
      settings.updatedAt,
      settings.syncStatus,
    ]
  );
}

