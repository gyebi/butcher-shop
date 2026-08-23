import { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

type NewProductFormProps = {
  onCreate: (product: {
    name: string;
    fullStockKg: number;
    pricePerKg: number;
  }) => Promise<void>;
};

export default function NewProductForm({
  onCreate,
}: NewProductFormProps) {
  const [name, setName] = useState("");
  const [fullStockInput, setFullStockInput] =
    useState("");
  const [priceInput, setPriceInput] =
    useState("");

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const fullStockKg = Number(fullStockInput);
  const pricePerKg = Number(priceInput);

  const validName = name.trim().length > 0;

  const validFullStock =
    Number.isFinite(fullStockKg) &&
    fullStockKg > 0;

  const validPrice =
    Number.isFinite(pricePerKg) &&
    pricePerKg >= 0;

  const canCreate =
    validName &&
    validFullStock &&
    validPrice &&
    !saving;

  const resetForm = () => {
    setName("");
    setFullStockInput("");
    setPriceInput("");
  };

  const handleCreate = async () => {
    if (!canCreate) {
      return;
    }

    try {
      setSaving(true);
      setMessage("");
      setError("");

      await onCreate({
        name: name.trim(),
        fullStockKg,
        pricePerKg,
      });

      resetForm();

      setMessage(
        "Product created successfully."
      );
    } catch (err) {
      console.error(
        "Failed to create product:",
        err
      );

      setError(
        "Could not create product. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.label}>
        Product name
      </Text>

      <TextInput
        value={name}
        onChangeText={(value) => {
          setName(value);
          setMessage("");
          setError("");
        }}
        placeholder="e.g. Turkey Wings"
        autoCapitalize="words"
        maxLength={80}
        style={styles.textInput}
      />

      <Text style={styles.label}>
        Normal full stock
      </Text>

      <View style={styles.inputRow}>
        <TextInput
          value={fullStockInput}
          onChangeText={(value) => {
            setFullStockInput(value);
            setMessage("");
            setError("");
          }}
          keyboardType="decimal-pad"
          placeholder="0.00"
          style={styles.numberInput}
        />

        <Text style={styles.suffix}>
          kg
        </Text>
      </View>

      <Text style={styles.helper}>
        This is the reference stock level used
        to calculate the reorder percentage.
      </Text>

      <Text style={styles.label}>
        Initial selling price
      </Text>

      <View style={styles.inputRow}>
        <Text style={styles.prefix}>
          GHS
        </Text>

        <TextInput
          value={priceInput}
          onChangeText={(value) => {
            setPriceInput(value);
            setMessage("");
            setError("");
          }}
          keyboardType="decimal-pad"
          placeholder="0.00"
          style={styles.numberInput}
        />

        <Text style={styles.suffix}>
          / kg
        </Text>
      </View>

      <Text style={styles.helper}>
        This is only the starting selling price.
        It can change when stock is added.
      </Text>

      {!validFullStock &&
        fullStockInput !== "" && (
          <Text style={styles.validationText}>
            Full stock must be greater than 0 kg.
          </Text>
        )}

      {!validPrice &&
        priceInput !== "" && (
          <Text style={styles.validationText}>
            Selling price cannot be negative.
          </Text>
        )}

      {error !== "" && (
        <Text style={styles.errorText}>
          {error}
        </Text>
      )}

      {message !== "" && (
        <Text style={styles.successText}>
          {message}
        </Text>
      )}

      <Pressable
        disabled={!canCreate}
        style={[
          styles.createButton,
          !canCreate &&
            styles.disabledButton,
        ]}
        onPress={handleCreate}
      >
        <Text style={styles.createButtonText}>
          {saving
            ? "CREATING..."
            : "CREATE PRODUCT"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
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

  textInput: {
    borderWidth: 2,
    borderColor: "#d8d2cc",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 18,
    color: "#211c18",
  },

  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#d8d2cc",
    borderRadius: 14,
    paddingHorizontal: 14,
  },

  numberInput: {
    flex: 1,
    paddingVertical: 13,
    fontSize: 22,
    fontWeight: "700",
    color: "#211c18",
  },

  prefix: {
    marginRight: 8,
    color: "#726962",
    fontWeight: "700",
  },

  suffix: {
    color: "#726962",
    fontWeight: "700",
  },

  helper: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 17,
    color: "#817770",
  },

  validationText: {
    color: "#c62828",
    fontSize: 12,
    marginTop: 7,
  },

  errorText: {
    color: "#c62828",
    fontWeight: "700",
    marginTop: 16,
  },

  successText: {
    color: "#367c4a",
    fontWeight: "700",
    marginTop: 16,
  },

  createButton: {
    backgroundColor: "#367c4a",
    borderRadius: 13,
    alignItems: "center",
    paddingVertical: 16,
    marginTop: 26,
  },

  disabledButton: {
    opacity: 0.35,
  },

  createButtonText: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 14,
  },
});