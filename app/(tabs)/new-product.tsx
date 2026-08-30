import { useRouter } from "expo-router";
import {
  ScrollView,
  StyleSheet,
  Text,
} from "react-native";

import NewProductForm from "@/components/NewProductForm";

import { createLocalProduct } from "@/src/services/local-products";

export default function NewProductScreen() {
  const router = useRouter();

  const handleCreateProduct = async ({
    name,
    fullStockKg,
    pricePerKg,
  }: {
    name: string;
    fullStockKg: number;
    pricePerKg: number;
  }) => {
    await createLocalProduct({
      name,
      fullStockKg,
      pricePerKg,
    });

    router.replace("/(tabs)");
  };

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>
        New Product
      </Text>

      <Text style={styles.description}>
        Create the product first. Once created,
        go to Home and use ADD to receive its
        first stock.
      </Text>

      <NewProductForm
        onCreate={handleCreateProduct}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    padding: 20,
    paddingTop: 60,
    paddingBottom: 40,
    backgroundColor: "#f3f1ed",
  },

  title: {
    fontSize: 30,
    fontWeight: "800",
    color: "#211c18",
    marginBottom: 8,
  },

  description: {
    fontSize: 15,
    lineHeight: 21,
    color: "#5d554f",
    marginBottom: 22,
  },
});