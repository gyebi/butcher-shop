import { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

type SettingsModalProps = {
  visible: boolean;
  reorderPercent: number;
  markupPercent: number;
  voiceEnabled: boolean;
  onClose: () => void;
  onSave: (settings: {
    reorderPercent: number;
    markupPercent: number;
    voiceEnabled: boolean;
  }) => void;
};

export default function SettingsModal({
  visible,
  reorderPercent,
  markupPercent,
  voiceEnabled,
  onClose,
  onSave,
}: SettingsModalProps) {
  const [reorderInput, setReorderInput] = useState(
    String(reorderPercent)
  );

  const [markupInput, setMarkupInput] = useState(
    String(markupPercent)
  );

  const [voice, setVoice] = useState(voiceEnabled);

  useEffect(() => {
    if (visible) {
      setReorderInput(String(reorderPercent));
      setMarkupInput(String(markupPercent));
      setVoice(voiceEnabled);
    }
  }, [
    visible,
    reorderPercent,
    markupPercent,
    voiceEnabled,
  ]);

  const reorder = Number(reorderInput);
  const markup = Number(markupInput);

  const validReorder =
    Number.isFinite(reorder) &&
    reorder >= 0 &&
    reorder <= 100;

  const validMarkup =
    Number.isFinite(markup) &&
    markup >= 0 &&
    markup <= 500;

  const canSave = validReorder && validMarkup;

  const handleSave = () => {
    if (!canSave) {
      return;
    }

    onSave({
      reorderPercent: reorder,
      markupPercent: markup,
      voiceEnabled: voice,
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.modal}>
          <Text style={styles.title}>
            Settings
          </Text>

          <Text style={styles.label}>
            Reorder warning
          </Text>

          <View style={styles.inputRow}>
            <TextInput
              value={reorderInput}
              onChangeText={setReorderInput}
              keyboardType="decimal-pad"
              style={styles.input}
            />

            <Text style={styles.suffix}>
              %
            </Text>
          </View>

          <Text style={styles.helper}>
            Product cards turn red when stock falls to
            this percentage or lower.
          </Text>

          <Text style={styles.label}>
            Default markup
          </Text>

          <View style={styles.inputRow}>
            <TextInput
              value={markupInput}
              onChangeText={setMarkupInput}
              keyboardType="decimal-pad"
              style={styles.input}
            />

            <Text style={styles.suffix}>
              %
            </Text>
          </View>

          <Text style={styles.helper}>
            Used to suggest a selling price when new
            stock is added.
          </Text>

          <Text style={styles.label}>
            Voice announcements
          </Text>

          <Pressable
            style={[
              styles.voiceButton,
              voice && styles.voiceButtonOn,
            ]}
            onPress={() => setVoice((current) => !current)}
          >
            <Text
              style={[
                styles.voiceText,
                voice && styles.voiceTextOn,
              ]}
            >
              {voice ? "ON" : "OFF"}
            </Text>
          </Pressable>

          <View style={styles.actions}>
            <Pressable
              style={[
                styles.button,
                styles.cancelButton,
              ]}
              onPress={onClose}
            >
              <Text style={styles.cancelText}>
                Cancel
              </Text>
            </Pressable>

            <Pressable
              disabled={!canSave}
              style={[
                styles.button,
                styles.saveButton,
                !canSave && styles.disabledButton,
              ]}
              onPress={handleSave}
            >
              <Text style={styles.saveText}>
                SAVE SETTINGS
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },

  modal: {
    backgroundColor: "#ffffff",
    padding: 24,
    paddingBottom: 36,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },

  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#211c18",
    marginBottom: 22,
  },

  label: {
    fontSize: 14,
    color: "#5d554f",
    marginBottom: 7,
    marginTop: 14,
  },

  helper: {
    fontSize: 12,
    color: "#817770",
    marginTop: 6,
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

  voiceButton: {
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "#ece8e4",
  },

  voiceButtonOn: {
    backgroundColor: "#367c4a",
  },

  voiceText: {
    color: "#211c18",
    fontWeight: "800",
  },

  voiceTextOn: {
    color: "#ffffff",
  },

  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 28,
  },

  button: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: "center",
  },

  cancelButton: {
    backgroundColor: "#ece8e4",
  },

  cancelText: {
    color: "#211c18",
    fontWeight: "700",
  },

  saveButton: {
    backgroundColor: "#367c4a",
  },

  saveText: {
    color: "#ffffff",
    fontWeight: "800",
  },

  disabledButton: {
    opacity: 0.35,
  },
});