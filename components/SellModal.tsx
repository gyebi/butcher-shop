import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Pressable,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  ScrollView,
  View,
} from "react-native";

import type { Product } from "./ProductCard";

import * as Speech from "expo-speech";

type SellModalProps = {
  product: Product | null;
  onClose: () => void;
  onConfirm: (productId: string, weightKg: number) => void;
};

export default function SellModal({
  product,
  onClose,
  onConfirm,
}: SellModalProps) {
  const [weightInput, setWeightInput] = useState("");

  useEffect(() => {
    if (!product) {
      setWeightInput("");
    }
  }, [product]);

  const weightKg = Number(weightInput);

  const validWeight =
    Number.isFinite(weightKg) && weightKg > 0
      ? weightKg
      : 0;

  const amountDue = product
    ? validWeight * product.pricePerKg
    : 0;

  const hasEnoughStock =
    product !== null &&
    validWeight > 0 &&
    validWeight <= product.weightKg;

  const speakSaleTotal = (speechText: string) => {
    void Speech.stop();

    Speech.speak(speechText, {
      language: "en-GH",
      rate: 0.5,
      pitch: 1.0,
    });
  };

  const handleConfirm = () => {
    if (!product || !hasEnoughStock) {
      return;
    }

    const cedis = Math.floor(amountDue);
    const pesewas = Math.round(
      (amountDue - cedis) * 100,
    );

    let speechText = `${cedis} Ghana cedis`;

    if (pesewas > 0) {
      speechText += ` and ${pesewas} pesewas`;
    }

    speechText += ". Medaase.";

    void speakSaleTotal(speechText);
    onConfirm(product.id, validWeight);

    setWeightInput("");
  };

  const handleClose = () => {
    setWeightInput("");
    onClose();
  };

  return (
    <Modal
      visible={product !== null}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.backdrop}>
        <KeyboardAvoidingView
          style={styles.keyboardAvoid}
          behavior={
            Platform.OS === "ios" ? "padding" : "height"
          }
        >
          <View style={styles.modal}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalContent}
            >
              <Text style={styles.title}>
                Sell {product?.name}
              </Text>

              <Text style={styles.label}>
                Weight customer is buying
              </Text>

              <View style={styles.inputRow}>
                <TextInput
                  value={weightInput}
                  onChangeText={setWeightInput}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  autoFocus
                  style={styles.input}
                />

                <Text style={styles.kg}>
                  kg
                </Text>
              </View>

              <Text style={styles.available}>
                Available: {product?.weightKg.toFixed(2)} kg
              </Text>

              <View style={styles.amountCard}>
                <Text style={styles.amountLabel}>
                  CUSTOMER PAYS
                </Text>

                <Text style={styles.amount}>
                  GHS {amountDue.toFixed(2)}
                </Text>
              </View>

              {product &&
                validWeight > product.weightKg && (
                  <Text style={styles.error}>
                    Not enough stock available.
                  </Text>
                )}

              <View style={styles.actions}>
                <Pressable
                  style={[
                    styles.button,
                    styles.cancelButton,
                  ]}
                  onPress={handleClose}
                >
                  <Text style={styles.cancelText}>
                    Cancel
                  </Text>
                </Pressable>

                <Pressable
                  disabled={!hasEnoughStock}
                  style={[
                    styles.button,
                    styles.confirmButton,
                    !hasEnoughStock &&
                      styles.disabledButton,
                  ]}
                  onPress={handleConfirm}
                >
                  <Text style={styles.confirmText}>
                    COMPLETE SALE
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    paddingHorizontal: 16,
  },

  keyboardAvoid: {
    flex: 1,
    justifyContent: "center",
  },

  modal: {
    alignSelf: "center",
    width: "100%",
    maxWidth: 520,
    maxHeight: "100%",
    backgroundColor: "#ffffff",
    padding: 24,
    paddingBottom: 36,
    borderRadius: 24,
  },

  modalContent: {
    paddingBottom: 12,
  },

  title: {
    fontSize: 25,
    fontWeight: "800",
    color: "#211c18",
    marginBottom: 22,
  },

  label: {
    fontSize: 14,
    color: "#5d554f",
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
    fontSize: 30,
    fontWeight: "700",
    paddingVertical: 13,
    color: "#211c18",
  },

  kg: {
    fontSize: 18,
    fontWeight: "700",
    color: "#726962",
  },

  available: {
    marginTop: 8,
    fontSize: 13,
    color: "#726962",
  },

  amountCard: {
    backgroundColor: "#211c18",
    borderRadius: 16,
    padding: 20,
    marginTop: 22,
  },

  amountLabel: {
    color: "#bcb4ad",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.3,
  },

  amount: {
    color: "#e9b949",
    fontSize: 36,
    fontWeight: "800",
    marginTop: 5,
  },

  error: {
    marginTop: 10,
    color: "#c62828",
    fontWeight: "700",
  },

  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 24,
  },

  button: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 15,
    borderRadius: 12,
  },

  cancelButton: {
    backgroundColor: "#ece8e4",
  },

  cancelText: {
    color: "#211c18",
    fontWeight: "700",
  },

  confirmButton: {
    backgroundColor: "#367c4a",
  },

  disabledButton: {
    opacity: 0.35,
  },

  confirmText: {
    color: "#ffffff",
    fontWeight: "800",
  },
});
