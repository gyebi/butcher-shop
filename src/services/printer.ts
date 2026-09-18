import {
  BluetoothEscposPrinter,
  BluetoothManager,
} from "react-native-bluetooth-escpos-printer";

import {
  getPrinterSettings,
  type PrinterSettings,
} from "@/src/db/repositories/printer-settings-repository";

import type { EndOfDaySummary } from "@/src/db/repositories/sales-repository";

import {
  PermissionsAndroid,
  Platform,
} from "react-native";



export async function requestBluetoothPermissions(): Promise<void> {
  if (Platform.OS !== "android") {
    return;
  }

  if (Platform.Version < 31) {
    return;
  }

  const results = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
  ]);

  const scanGranted =
    results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] ===
    PermissionsAndroid.RESULTS.GRANTED;

  const connectGranted =
    results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] ===
    PermissionsAndroid.RESULTS.GRANTED;

  if (!scanGranted || !connectGranted) {
    throw new Error(
      "Bluetooth permission is required to use the receipt printer.",
    );
  }
}

export async function connectSavedPrinter(): Promise<void> {
  await requestBluetoothPermissions();

  const settings = await getPrinterSettings();

  if (!settings.enabled) {
    throw new Error("Receipt printer is disabled.");
  }

  if (!settings.printerAddress) {
    throw new Error("No Bluetooth printer has been selected.");
  }

  await BluetoothManager.connect(settings.printerAddress);
}

export async function printTestReceipt(): Promise<void> {
  await requestBluetoothPermissions();

  const settings = await getPrinterSettings();

  if (!settings.enabled) {
    throw new Error("Receipt printer is disabled.");
  }

  if (!settings.printerAddress) {
    throw new Error("No Bluetooth printer has been selected.");
  }

  await BluetoothManager.connect(settings.printerAddress);

  await BluetoothEscposPrinter.printerInit();

  await BluetoothEscposPrinter.printerAlign(
    BluetoothEscposPrinter.ALIGN.CENTER,
  );

  await BluetoothEscposPrinter.printText(
    "LIZZY'S BUTCHER SHOP\r\n",
    {},
  );

  await BluetoothEscposPrinter.printText(
    "PRINTER TEST\r\n",
    {},
  );

  await BluetoothEscposPrinter.printText(
    "------------------------------\r\n",
    {},
  );

  await BluetoothEscposPrinter.printText(
    "Bluetooth connection successful\r\n",
    {},
  );

  await BluetoothEscposPrinter.printText(
    "\r\n\r\n\r\n",
    {},
  );
}

export type StockCorrectionReceiptInput = {
  productName: string;
  previousFullStockKg: number;
  correctedFullStockKg: number;
  currentWeightKg: number;
};

export async function printStockCorrectionReceipt(
  correction: StockCorrectionReceiptInput,
  settings: PrinterSettings,
): Promise<"PRINTED" | "SKIPPED"> {
  if (!settings.enabled) {
    return "SKIPPED";
  }

  if (!settings.printerAddress) {
    throw new Error(
      "Receipt printer is enabled but no printer is selected.",
    );
  }

  await requestBluetoothPermissions();
  await BluetoothManager.connect(settings.printerAddress);
  await BluetoothEscposPrinter.printerInit();

  await BluetoothEscposPrinter.printerAlign(
    BluetoothEscposPrinter.ALIGN.CENTER,
  );

  await BluetoothEscposPrinter.printText(
    "AUNTIE LIZZY'S BUTCHER SHOP\r\n",
    {},
  );

  await BluetoothEscposPrinter.printText(
    "Tel: 055 143 8483\r\n",
    {},
  );

  await BluetoothEscposPrinter.printText(
    "STOCK CORRECTION\r\n",
    {},
  );

  await BluetoothEscposPrinter.printText(
    "------------------------------\r\n",
    {},
  );

  await BluetoothEscposPrinter.printerAlign(
    BluetoothEscposPrinter.ALIGN.LEFT,
  );

  await BluetoothEscposPrinter.printText(
    `Product: ${correction.productName}\r\n\r\n`,
    {},
  );

  await BluetoothEscposPrinter.printText(
    `Previous Full Stock: ${correction.previousFullStockKg.toFixed(2)} kg\r\n`,
    {},
  );

  await BluetoothEscposPrinter.printText(
    `Corrected Full Stock: ${correction.correctedFullStockKg.toFixed(2)} kg\r\n`,
    {},
  );

  await BluetoothEscposPrinter.printText(
    `Current Available: ${correction.currentWeightKg.toFixed(2)} kg\r\n`,
    {},
  );

  await BluetoothEscposPrinter.printText(
    "------------------------------\r\n",
    {},
  );

  await BluetoothEscposPrinter.printerAlign(
    BluetoothEscposPrinter.ALIGN.CENTER,
  );

  await BluetoothEscposPrinter.printText(
    `${new Date().toLocaleString()}\r\n`,
    {},
  );

  await BluetoothEscposPrinter.printText(
    "CORRECTION SAVED\r\n\r\n\r\n",
    {},
  );

  return "PRINTED";
}

export type SyncConfirmationKind = "BOD" | "EOD";

export async function printSyncConfirmationReceipt(
  kind: SyncConfirmationKind,
): Promise<"PRINTED" | "SKIPPED"> {
  const settings = await getPrinterSettings();

  if (!settings.enabled) {
    return "SKIPPED";
  }

  if (!settings.printerAddress) {
    throw new Error(
      "Receipt printer is enabled but no printer is selected.",
    );
  }

  await requestBluetoothPermissions();

  await BluetoothManager.connect(
    settings.printerAddress,
  );

  await BluetoothEscposPrinter.printerInit();

  await BluetoothEscposPrinter.printerAlign(
    BluetoothEscposPrinter.ALIGN.CENTER,
  );

  await BluetoothEscposPrinter.printText(
    "AUNTIE LIZZY'S BUTCHER SHOP\r\n",
    {},
  );

  await BluetoothEscposPrinter.printText(
    `${kind} SUCCESSFUL\r\n`,
    {},
  );

  await BluetoothEscposPrinter.printText(
    "------------------------------\r\n",
    {},
  );

  await BluetoothEscposPrinter.printText(
    `${new Date().toLocaleString()}\r\n`,
    {},
  );

  await BluetoothEscposPrinter.printText(
    "\r\n\r\n\r\n",
    {},
  );

  return "PRINTED";
}

export type SaleReceiptItem = {
  productName: string;
  weightKg: number;
  pricePerKg: number;
  lineTotal: number;
};

export type SaleReceiptInput = {
  saleId: string;
  items: SaleReceiptItem[];
  totalAmount: number;
};


export async function printSaleReceipt(

  sale: SaleReceiptInput,
  settings: PrinterSettings,
): Promise<"PRINTED" | "SKIPPED"> {
  console.log("SALE PRINT 1: ENTERED");

  const shortReceiptNumber = sale.saleId.slice(0, 18) ?? sale.saleId;

  if (!settings.enabled) {
    console.log("SALE PRINT: SKIPPED - DISABLED");

    return "SKIPPED";
  }

  if (!settings.printerAddress) {
    throw new Error(
      "Receipt printer is enabled but no printer is selected.",
    );
  }

  await requestBluetoothPermissions();
  console.log("SALE PRINT 4: PERMISSIONS OK");

  console.log("SALE PRINT 5: CONNECTING");
  await BluetoothManager.connect(
    settings.printerAddress,
  );
  console.log("SALE PRINT 6: CONNECTED");

  
  await BluetoothEscposPrinter.printerInit();

  await BluetoothEscposPrinter.printerAlign(
    BluetoothEscposPrinter.ALIGN.CENTER,
  );
 

  await BluetoothEscposPrinter.printText(
    "AUNTIE LIZZY'S BUTCHER SHOP\r\n",
    {},
  );

  await BluetoothEscposPrinter.printText(
    "Tel: 055 143 8483\r\n",
    {},
  );

  await BluetoothEscposPrinter.printText(
    "SALES RECEIPT\r\n",
    {},
  );

  await BluetoothEscposPrinter.printText(
    "------------------------------\r\n",
    {},
  );

  await BluetoothEscposPrinter.printerAlign(
    BluetoothEscposPrinter.ALIGN.LEFT,
  );

  for (const item of sale.items) {
    await BluetoothEscposPrinter.printText(
      `${item.productName}\r\n`,
      {},
    );

    await BluetoothEscposPrinter.printText(
      `${item.weightKg.toFixed(2)} kg x GHS ${item.pricePerKg.toFixed(2)}\r\n`,
      {},
    );

    await BluetoothEscposPrinter.printText(
      `GHS ${item.lineTotal.toFixed(2)}\r\n\r\n`,
      {},
    );
  }

  await BluetoothEscposPrinter.printText(
    "------------------------------\r\n",
    {},
  );

  await BluetoothEscposPrinter.printText(
    `TOTAL: GHS ${sale.totalAmount.toFixed(2)}\r\n`,
    {},
  );

  await BluetoothEscposPrinter.printText(
    "------------------------------\r\n",
    {},
  );

  await BluetoothEscposPrinter.printText(
    `Receipt: ${shortReceiptNumber}\r\n`,
    {},
  );

  await BluetoothEscposPrinter.printerAlign(
    BluetoothEscposPrinter.ALIGN.CENTER,
  );

  await BluetoothEscposPrinter.printText(
    "\r\nThank you for your purchase!\r\n",
    {},
  );

  await BluetoothEscposPrinter.printText(
    "\r\n\r\n\r\n",
    {},
  );

  console.log("SALE PRINT 10: COMPLETE");
  return "PRINTED";
}


export async function printEndOfDaySummary(
  summary: EndOfDaySummary,
  settings: PrinterSettings,
): Promise<"PRINTED" | "SKIPPED"> {
  if (!settings.enabled) {
    return "SKIPPED";
  }

  if (!settings.printerAddress) {
    throw new Error(
      "Receipt printer is enabled but no printer is selected.",
    );
  }

  await requestBluetoothPermissions();

  await BluetoothManager.connect(
    settings.printerAddress,
  );

  await BluetoothEscposPrinter.printerInit();

  await BluetoothEscposPrinter.printerAlign(
    BluetoothEscposPrinter.ALIGN.CENTER,
  );

  await BluetoothEscposPrinter.printText(
    "AUNTIE LIZZY'S BUTCHER SHOP\r\n",
    {},
  );

  await BluetoothEscposPrinter.printText(
    "Tel: 055 143 8483\r\n",
    {},
  );

  await BluetoothEscposPrinter.printText(
    "END OF DAY SUMMARY\r\n",
    {},
  );

  await BluetoothEscposPrinter.printText(
    "------------------------------\r\n",
    {},
  );

  await BluetoothEscposPrinter.printerAlign(
    BluetoothEscposPrinter.ALIGN.LEFT,
  );

  await BluetoothEscposPrinter.printText(
    `Transactions: ${summary.transactionCount}\r\n`,
    {},
  );

  await BluetoothEscposPrinter.printText(
    `Total Sales: GHS ${(summary.totalSalesPesewas / 100).toFixed(2)}\r\n`,
    {},
  );

  await BluetoothEscposPrinter.printText(
    "------------------------------\r\n",
    {},
  );

  await BluetoothEscposPrinter.printText(
    "SALES BY PRODUCT\r\n",
    {},
  );

  await BluetoothEscposPrinter.printText(
    "------------------------------\r\n",
    {},
  );

  for (const product of summary.products) {
    await BluetoothEscposPrinter.printText(
      `${product.productName}\r\n`,
      {},
    );

    await BluetoothEscposPrinter.printText(
      `${product.totalWeightKg.toFixed(2)} kg   GHS ${(product.totalAmountPesewas / 100).toFixed(2)}\r\n\r\n`,
      {},
    );
  }

  await BluetoothEscposPrinter.printText(
    "------------------------------\r\n",
    {},
  );

  await BluetoothEscposPrinter.printText(
    `TOTAL: GHS ${(summary.totalSalesPesewas / 100).toFixed(2)}\r\n`,
    {},
  );

  await BluetoothEscposPrinter.printText(
    "------------------------------\r\n",
    {},
  );

  await BluetoothEscposPrinter.printerAlign(
    BluetoothEscposPrinter.ALIGN.CENTER,
  );

  await BluetoothEscposPrinter.printText(
    "EOD COMPLETE\r\n",
    {},
  );

  await BluetoothEscposPrinter.printText(
    `${new Date().toLocaleDateString()}\r\n`,
    {},
  );

  await BluetoothEscposPrinter.printText(
    "\r\n\r\n\r\n",
    {},
  );

  return "PRINTED";
}
