import { useCallback, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import {
  loadBusinessSettings,
  saveBusinessSettings,
} from "@/src/services/settings";

import {
  getPrinterSettings,
  savePrinterSettings,
} from "@/src/db/repositories/printer-settings-repository";

export default function SettingsScreen() {
  const [reorderInput, setReorderInput] = useState("20");
  const [markupInput, setMarkupInput] = useState("25");
  const [voiceEnabled, setVoiceEnabled] = useState(true);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [printerEnabled, setPrinterEnabled] = useState(false);
  const [printerName, setPrinterName] = useState("");
  const [printerAddress, setPrinterAddress] = useState("");
  const [paperWidthInput, setPaperWidthInput] = useState("58");

  const [printerSaving, setPrinterSaving] = useState(false);
  const [printerMessage, setPrinterMessage] = useState("");

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      async function loadSettings() {
        try {
          setLoading(true);
          setMessage("");
          setPrinterMessage("");

          const [
            savedBusinessSettings,
            savedPrinterSettings,
          ] = await Promise.all([
            loadBusinessSettings(),
            getPrinterSettings(),
          ]);

          if (!isActive) {
            return;
          }

          if (savedBusinessSettings) {
            setReorderInput(
              String(savedBusinessSettings.reorderPercent)
            );

            setMarkupInput(
              String(savedBusinessSettings.markupPercent)
            );

            setVoiceEnabled(
              savedBusinessSettings.voiceEnabled
            );
          }

          setPrinterEnabled(
            savedPrinterSettings.enabled
          );

          setPrinterName(
            savedPrinterSettings.printerName ?? ""
          );

          setPrinterAddress(
            savedPrinterSettings.printerAddress ?? ""
          );

          setPaperWidthInput(
            String(savedPrinterSettings.paperWidthMm)
          );

          console.log(
            "Loaded printer settings:",
            savedPrinterSettings
          );
        } catch (error) {
          console.error(
            "Failed to load settings:",
            error
          );

          if (isActive) {
            setMessage(
              "Could not load saved settings."
            );
          }
        } finally {
          if (isActive) {
            setLoading(false);
          }
        }
      }

      void loadSettings();

      return () => {
        isActive = false;
      };
    }, [])
  );

  const reorderPercent = Number(reorderInput);
  const markupPercent = Number(markupInput);

  const reorderValid =
    Number.isFinite(reorderPercent) &&
    reorderPercent >= 0 &&
    reorderPercent <= 100;

  const markupValid =
    Number.isFinite(markupPercent) &&
    markupPercent >= 0 &&
    markupPercent <= 500;

  const canSave =
    reorderValid &&
    markupValid &&
    !saving;

  const handleSave = async () => {
    if (!canSave) {
      return;
    }

    try {
      setSaving(true);
      setMessage("");

      await saveBusinessSettings({
        reorderPercent,
        markupPercent,
        voiceEnabled,
      });

      setMessage("Settings saved.");
    } catch (error) {
      console.error(
        "Failed to save settings:",
        error
      );

      setMessage(
        "Could not save settings."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSavePrinterSettings = async () => {
    const paperWidthMm = Number(paperWidthInput);

    if (
      !Number.isFinite(paperWidthMm) ||
      paperWidthMm <= 0
    ) {
      setPrinterMessage(
        "Enter a valid paper width."
      );
      return;
    }

    try {
      setPrinterSaving(true);
      setPrinterMessage("");

      await savePrinterSettings({
        enabled: printerEnabled,
        printerName: printerName.trim() || null,
        printerAddress:
          printerAddress.trim() || null,
        connectionType: "BLUETOOTH",
        paperWidthMm,
        printWidthMm: null,
        charset: null,
        updatedAt: new Date().toISOString(),
      });

      const saved = await getPrinterSettings();

      console.log(
        "Printer settings after save:",
        saved
      );

      setPrinterMessage(
        "Printer settings saved."
      );
    } catch (error) {
      console.error(
        "Failed to save printer settings:",
        error
      );

      setPrinterMessage(
        "Could not save printer settings."
      );
    } finally {
      setPrinterSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>
          Loading settings...
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>
        Settings
      </Text>

      <Text style={styles.description}>
        Control stock warnings, pricing markup,
        and voice announcements.
      </Text>

      <View style={styles.card}>
        <Text style={styles.label}>
          Reorder warning
        </Text>

        <View style={styles.inputRow}>
          <TextInput
            value={reorderInput}
            onChangeText={setReorderInput}
            keyboardType="decimal-pad"
            style={styles.input}
            selectTextOnFocus
          />

          <Text style={styles.suffix}>
            %
          </Text>
        </View>

        <Text style={styles.helper}>
          Product cards turn red when remaining
          stock reaches this percentage or lower.
        </Text>

        {!reorderValid && (
          <Text style={styles.errorText}>
            Enter a value between 0 and 100.
          </Text>
        )}

        <Text style={styles.label}>
          Default markup
        </Text>

        <View style={styles.inputRow}>
          <TextInput
            value={markupInput}
            onChangeText={setMarkupInput}
            keyboardType="decimal-pad"
            style={styles.input}
            selectTextOnFocus
          />

          <Text style={styles.suffix}>
            %
          </Text>
        </View>

        <Text style={styles.helper}>
          Used to calculate the suggested selling
          price when stock is added.
        </Text>

        {!markupValid && (
          <Text style={styles.errorText}>
            Enter a value between 0 and 500.
          </Text>
        )}

        <Text style={styles.label}>
          Voice announcements
        </Text>

        <Pressable
          style={[
            styles.voiceButton,
            voiceEnabled &&
            styles.voiceButtonEnabled,
          ]}
          onPress={() =>
            setVoiceEnabled((current) => !current)
          }
        >
          <Text
            style={[
              styles.voiceButtonText,
              voiceEnabled &&
              styles.voiceButtonTextEnabled,
            ]}
          >
            {voiceEnabled ? "ON" : "OFF"}
          </Text>
        </Pressable>

        <Pressable
          disabled={!canSave}
          style={[
            styles.saveButton,
            !canSave &&
            styles.saveButtonDisabled,
          ]}
          onPress={handleSave}
        >
          <Text style={styles.saveButtonText}>
            {saving
              ? "SAVING..."
              : "SAVE SETTINGS"}
          </Text>
        </Pressable>

        {message !== "" && (
          <Text style={styles.message}>
            {message}
          </Text>
        )}
      </View>

      <View style={styles.printerCard}>
        <Text style={styles.sectionTitle}>
          Receipt Printer
        </Text>

        <Text style={styles.sectionDescription}>
          Configure the Bluetooth receipt printer
          used with this POS tablet.
        </Text>

        <Text style={styles.label}>
          Printer enabled
        </Text>

        <Pressable
          style={[
            styles.voiceButton,
            printerEnabled &&
            styles.voiceButtonEnabled,
          ]}
          onPress={() =>
            setPrinterEnabled(
              (current) => !current
            )
          }
        >
          <Text
            style={[
              styles.voiceButtonText,
              printerEnabled &&
              styles.voiceButtonTextEnabled,
            ]}
          >
            {printerEnabled ? "ON" : "OFF"}
          </Text>
        </Pressable>

        <Text style={styles.label}>
          Printer name
        </Text>

        <TextInput
          value={printerName}
          onChangeText={setPrinterName}
          placeholder="Select printer"
          style={styles.textInput}
          autoCapitalize="none"
        />

        <Text style={styles.label}>
          Bluetooth address
        </Text>

        <TextInput
          value={printerAddress}
          onChangeText={setPrinterAddress}
          placeholder="Not selected"
          style={styles.textInput}
          autoCapitalize="characters"
        />

        <Text style={styles.helper}>
          This will eventually be filled automatically
          when you choose a paired Bluetooth printer.
        </Text>

        <Text style={styles.label}>
          Paper width
        </Text>

        <View style={styles.inputRow}>
          <TextInput
            value={paperWidthInput}
            onChangeText={setPaperWidthInput}
            keyboardType="number-pad"
            style={styles.input}
            selectTextOnFocus
          />

          <Text style={styles.suffix}>
            mm
          </Text>
        </View>

        <Pressable
          style={[
            styles.saveButton,
            printerSaving &&
            styles.saveButtonDisabled,
          ]}
          disabled={printerSaving}
          onPress={handleSavePrinterSettings}
        >
          <Text style={styles.saveButtonText}>
            {printerSaving
              ? "SAVING..."
              : "SAVE PRINTER SETTINGS"}
          </Text>
        </Pressable>

        {printerMessage !== "" && (
          <Text style={styles.message}>
            {printerMessage}
          </Text>
        )}
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    padding: 20,
    paddingTop: 60,
    backgroundColor: "#f3f1ed",
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f3f1ed",
  },

  loadingText: {
    color: "#5d554f",
  },

  title: {
    fontSize: 30,
    fontWeight: "800",
    color: "#211c18",
    marginBottom: 8,
  },

  description: {
    fontSize: 15,
    color: "#5d554f",
    marginBottom: 22,
  },

  card: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: "#e4dfd9",
  },

  label: {
    fontSize: 14,
    fontWeight: "700",
    color: "#211c18",
    marginTop: 18,
    marginBottom: 7,
  },

  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#d8d2cc",
    borderRadius: 14,
    paddingHorizontal: 15,
  },

  input: {
    flex: 1,
    fontSize: 24,
    fontWeight: "700",
    paddingVertical: 12,
    color: "#211c18",
  },

  suffix: {
    fontSize: 17,
    fontWeight: "700",
    color: "#726962",
  },

  helper: {
    fontSize: 12,
    color: "#817770",
    marginTop: 7,
  },

  errorText: {
    color: "#c62828",
    marginTop: 6,
    fontSize: 12,
    fontWeight: "600",
  },

  voiceButton: {
    backgroundColor: "#ece8e4",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },

  voiceButtonEnabled: {
    backgroundColor: "#367c4a",
  },

  voiceButtonText: {
    color: "#211c18",
    fontWeight: "800",
  },

  voiceButtonTextEnabled: {
    color: "#ffffff",
  },

  saveButton: {
    backgroundColor: "#211c18",
    paddingVertical: 16,
    borderRadius: 13,
    alignItems: "center",
    marginTop: 28,
  },

  saveButtonDisabled: {
    opacity: 0.35,
  },

  saveButtonText: {
    color: "#ffffff",
    fontWeight: "800",
  },

  message: {
    marginTop: 14,
    textAlign: "center",
    color: "#367c4a",
    fontWeight: "700",
  },

  printerCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: "#e4dfd9",
    marginTop: 20,
  },

  sectionTitle: {
    fontSize: 21,
    fontWeight: "800",
    color: "#211c18",
  },

  sectionDescription: {
    fontSize: 13,
    color: "#817770",
    marginTop: 5,
    marginBottom: 4,
  },

  textInput: {
    borderWidth: 2,
    borderColor: "#d8d2cc",
    borderRadius: 14,
    paddingHorizontal: 15,
    paddingVertical: 13,
    fontSize: 16,
    color: "#211c18",
  },
});
