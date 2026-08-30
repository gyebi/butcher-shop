import {
  BluetoothEscposPrinter,
  BluetoothManager,
} from "react-native-bluetooth-escpos-printer";

import { getPrinterSettings } from "@/src/db/repositories/printer-settings-repository";

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
    `Receipt: ${sale.saleId}\r\n`,
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

  return "PRINTED";
}
