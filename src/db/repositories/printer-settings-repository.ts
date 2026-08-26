import { getDatabase } from "../database";

export type PrinterSettings = {
  enabled: boolean;
  printerName: string | null;
  printerAddress: string | null;
  connectionType: "BLUETOOTH";
  paperWidthMm: number;
  printWidthMm: number | null;
  charset: string | null;
  updatedAt: string;
};

type PrinterSettingsRow = {
  enabled: number;
  printer_name: string | null;
  printer_address: string | null;
  connection_type: "BLUETOOTH";
  paper_width_mm: number;
  print_width_mm: number | null;
  charset: string | null;
  updated_at: string;
};

function mapRow(row: PrinterSettingsRow): PrinterSettings {
  return {
    enabled: row.enabled === 1,
    printerName: row.printer_name,
    printerAddress: row.printer_address,
    connectionType: row.connection_type,
    paperWidthMm: row.paper_width_mm,
    printWidthMm: row.print_width_mm,
    charset: row.charset,
    updatedAt: row.updated_at,
  };
}

export async function getPrinterSettings(): Promise<PrinterSettings> {
  const db = await getDatabase();

  const row = await db.getFirstAsync<PrinterSettingsRow>(
    `
    SELECT
      enabled,
      printer_name,
      printer_address,
      connection_type,
      paper_width_mm,
      print_width_mm,
      charset,
      updated_at
    FROM printer_settings
    WHERE id = 1
    `
  );

  if (row) {
    return mapRow(row);
  }

  return {
    enabled: false,
    printerName: null,
    printerAddress: null,
    connectionType: "BLUETOOTH",
    paperWidthMm: 58,
    printWidthMm: null,
    charset: null,
    updatedAt: new Date().toISOString(),
  };
}

export async function savePrinterSettings(
  settings: PrinterSettings
): Promise<void> {
  const db = await getDatabase();

  await db.runAsync(
    `
    INSERT INTO printer_settings (
      id,
      enabled,
      printer_name,
      printer_address,
      connection_type,
      paper_width_mm,
      print_width_mm,
      charset,
      updated_at
    )
    VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)

    ON CONFLICT(id) DO UPDATE SET
      enabled = excluded.enabled,
      printer_name = excluded.printer_name,
      printer_address = excluded.printer_address,
      connection_type = excluded.connection_type,
      paper_width_mm = excluded.paper_width_mm,
      print_width_mm = excluded.print_width_mm,
      charset = excluded.charset,
      updated_at = excluded.updated_at
    `,
    [
      settings.enabled ? 1 : 0,
      settings.printerName,
      settings.printerAddress,
      settings.connectionType,
      settings.paperWidthMm,
      settings.printWidthMm,
      settings.charset,
      settings.updatedAt,
    ]
  );
}