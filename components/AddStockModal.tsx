import { useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  ScrollView,
  Platform,
  View,
} from "react-native";

import type { Product } from "./ProductCard";

type AddStockModalProps = {
  product: Product | null;
  defaultMarkupPercent: number;
  onClose: () => void;
  onConfirm: (data: {
    productId: string;
    addedWeightKg: number;
    totalPurchaseCost: number;
    costPerKg: number;
    sellingPricePerKg: number;
  }) => void;
};

export default function AddStockModal({
  product,
  defaultMarkupPercent,
  onClose,
  onConfirm,
}: AddStockModalProps) {
  const [weightInput, setWeightInput] = useState("");
  const [purchaseCostInput, setPurchaseCostInput] = useState("");
  const [sellingPriceInput, setSellingPriceInput] = useState("");

  useEffect(() => {
    setWeightInput("");
    setPurchaseCostInput("");
    setSellingPriceInput("");
  }, [product]);

  const addedWeightKg = Number(weightInput);
  const totalPurchaseCost = Number(purchaseCostInput);

  const validWeight =
    Number.isFinite(addedWeightKg) && addedWeightKg > 0
      ? addedWeightKg
      : 0;

  const validPurchaseCost =
    Number.isFinite(totalPurchaseCost) && totalPurchaseCost > 0
      ? totalPurchaseCost
      : 0;

  const costPerKg =
    validWeight > 0 && validPurchaseCost > 0
      ? validPurchaseCost / validWeight
      : 0;

  const suggestedSellingPrice = useMemo(() => {
    if (costPerKg <= 0) {
      return 0;
    }

    return costPerKg * (1 + defaultMarkupPercent / 100);
  }, [costPerKg, defaultMarkupPercent]);

  const enteredSellingPrice = Number(sellingPriceInput);

  const finalSellingPrice =
    Number.isFinite(enteredSellingPrice) && enteredSellingPrice > 0
      ? enteredSellingPrice
      : suggestedSellingPrice;

  const estimatedProfitPerKg =
    finalSellingPrice > 0 && costPerKg > 0
      ? finalSellingPrice - costPerKg
      : 0;

  const canConfirm =
    product !== null &&
    validWeight > 0 &&
    validPurchaseCost > 0 &&
    finalSellingPrice > 0;

  const handleConfirm = () => {
    if (!product || !canConfirm) {
      return;
    }

    onConfirm({
      productId: product.id,
      addedWeightKg: validWeight,
      totalPurchaseCost: validPurchaseCost,
      costPerKg,
      sellingPricePerKg: finalSellingPrice,
    });

    setWeightInput("");
    setPurchaseCostInput("");
    setSellingPriceInput("");
  };

  const handleClose = () => {
    setWeightInput("");
    setPurchaseCostInput("");
    setSellingPriceInput("");

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
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.keyboardAvoid}
        >
          <ScrollView
            style={styles.modal}
            contentContainerStyle={styles.modalContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.title}>
              Add {product?.name}
            </Text>

            <Text style={styles.label}>
              Weight received
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

              <Text style={styles.inputSuffix}>
                kg
              </Text>
            </View>

            <Text style={styles.label}>
              Total purchase cost
            </Text>

            <View style={styles.inputRow}>
              <Text style={styles.inputPrefix}>
                GHS
              </Text>

              <TextInput
                value={purchaseCostInput}
                onChangeText={setPurchaseCostInput}
                keyboardType="decimal-pad"
                placeholder="0.00"
                style={styles.input}
              />
            </View>

            <View style={styles.calculationCard}>
              <View style={styles.calculationRow}>
                <Text style={styles.calculationLabel}>
                  Cost per kg
                </Text>

                <Text style={styles.calculationValue}>
                  GHS {costPerKg.toFixed(2)}
                </Text>
              </View>

              <View style={styles.calculationRow}>
                <Text style={styles.calculationLabel}>
                  Default markup
                </Text>

                <Text style={styles.calculationValue}>
                  {defaultMarkupPercent.toFixed(0)}%
                </Text>
              </View>

              <View style={styles.calculationRow}>
                <Text style={styles.calculationLabel}>
                  Suggested selling price
                </Text>

                <Text style={styles.suggestedPrice}>
                  GHS {suggestedSellingPrice.toFixed(2)} / kg
                </Text>
              </View>
            </View>

            <Text style={styles.label}>
              Selling price per kg
            </Text>

            <Text style={styles.helperText}>
              Leave blank to use the suggested price, or enter a different price.
            </Text>

            <View style={styles.inputRow}>
              <Text style={styles.inputPrefix}>
                GHS
              </Text>

              <TextInput
                value={sellingPriceInput}
                onChangeText={setSellingPriceInput}
                keyboardType="decimal-pad"
                placeholder={
                  suggestedSellingPrice > 0
                    ? suggestedSellingPrice.toFixed(2)
                    : "0.00"
                }
                style={styles.input}
              />

              <Text style={styles.inputSuffix}>
                / kg
              </Text>
            </View>

            {costPerKg > 0 && finalSellingPrice > 0 && (
              <View style={styles.profitBox}>
                <Text style={styles.profitLabel}>
                  Estimated gain per kg
                </Text>

                <Text
                  style={[
                    styles.profitValue,
                    estimatedProfitPerKg < 0 &&
                      styles.lossValue,
                  ]}
                >
                  GHS {estimatedProfitPerKg.toFixed(2)}
                </Text>
              </View>
            )}

            {finalSellingPrice > 0 &&
              costPerKg > 0 &&
              finalSellingPrice < costPerKg && (
                <Text style={styles.warning}>
                  Warning: this selling price is below the purchase cost.
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
                disabled={!canConfirm}
                style={[
                  styles.button,
                  styles.confirmButton,
                  !canConfirm &&
                    styles.disabledButton,
                ]}
                onPress={handleConfirm}
              >
                <Text style={styles.confirmText}>
                  ADD STOCK
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
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

  keyboardAvoid: {
    flex: 1,
    justifyContent: "flex-end",
  },

  modal: {
    maxHeight: "90%",
    backgroundColor: "#ffffff",
    padding: 24,
    paddingBottom: 36,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },

  modalContent: {
    paddingBottom: 32,
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
    marginTop: 12,
  },

  helperText: {
    color: "#817770",
    fontSize: 12,
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
    fontSize: 25,
    fontWeight: "700",
    paddingVertical: 12,
    color: "#211c18",
  },

  inputPrefix: {
    marginRight: 8,
    fontSize: 15,
    fontWeight: "700",
    color: "#726962",
  },

  inputSuffix: {
    marginLeft: 8,
    fontSize: 15,
    fontWeight: "700",
    color: "#726962",
  },

  calculationCard: {
    backgroundColor: "#f2efeb",
    borderRadius: 14,
    padding: 16,
    marginTop: 20,
    gap: 10,
  },

  calculationRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },

  calculationLabel: {
    color: "#726962",
    fontSize: 13,
    flex: 1,
  },

  calculationValue: {
    color: "#211c18",
    fontWeight: "700",
  },

  suggestedPrice: {
    color: "#367c4a",
    fontWeight: "800",
  },

  profitBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 14,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#eaf5ed",
  },

  profitLabel: {
    color: "#49614f",
    fontSize: 13,
  },

  profitValue: {
    color: "#26713d",
    fontWeight: "800",
  },

  lossValue: {
    color: "#c62828",
  },

  warning: {
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
