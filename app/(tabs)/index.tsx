import { useEffect, useState } from "react";

import {
  loadBusinessSettings,
  saveBusinessSettings,
} from "@/src/services/settings";

import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import ProductCard, { Product } from "../../components/ProductCard";

import SellModal from "../../components/SellModal";
import SummaryCard from "../../components/SummaryCard";
import AddStockModal from "../../components/AddStockModal";
import SettingsModal from "@/components/SettingsModal";

const initialProducts: Product[] = [
  {
    id: "1",
    name: "Chicken Back",
    weightKg: 40,
    fullStockKg: 50,
    pricePerKg: 25,
    thumbnail: require("../../assets/images/chicken-back.png"),
  },
  {
    id: "2",
    name: "Gozde Sausage",
    weightKg: 18,
    fullStockKg: 30,
    pricePerKg: 40,
    thumbnail: require("../../assets/images/sausage.png"),
  },
  {
    id: "3",
    name: "Beef Tripe",
    weightKg: 8,
    fullStockKg: 40,
    pricePerKg: 35,
    thumbnail: require("../../assets/images/beef-tripe.png"),
  },
  {
    id: "4",
    name: "Chicken Drumsticks",
    weightKg: 22,
    fullStockKg: 30,
    pricePerKg: 32,
    thumbnail: require("../../assets/images/chicken-drumsticks.png"),
  },
];

export default function HomeScreen() {
  const [products, setProducts] = useState<Product[]>(initialProducts);

  const [selectedProductId, setSelectedProductId] = useState<string | null>(
    null,
  );

  const [sellProduct, setSellProduct] = useState<Product | null>(null);

  const [addStockProduct, setAddStockProduct] = useState<Product | null>(null);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [reorderPercent, setReorderPercent] = useState(20);
  const [markupPercent, setMarkupPercent] = useState(25);
  const [voiceEnabled, setVoiceEnabled] = useState(true);

  useEffect(() => {
    async function loadSettings() {
      try {
        const savedSettings = await loadBusinessSettings();

        if (!savedSettings) {
          return;
        }

        setReorderPercent(savedSettings.reorderPercent);

        setMarkupPercent(savedSettings.markupPercent);

        setVoiceEnabled(savedSettings.voiceEnabled);
      } catch (error) {
        console.error("Failed to load settings:", error);
      }
    }

    loadSettings();
  }, []);

  const totalWeight = products.reduce(
    (total, product) => total + product.weightKg,
    0,
  );

  const totalValue = products.reduce(
    (total, product) => total + product.weightKg * product.pricePerKg,
    0,
  );

  const handleSale = (productId: string, weightKg: number) => {
    setProducts((currentProducts) =>
      currentProducts.map((product) => {
        if (product.id !== productId) {
          return product;
        }

        const remainingWeight = product.weightKg - weightKg;
        const remainingFullStock = product.fullStockKg - weightKg;

        return {
          ...product,
          weightKg: Math.round(Math.max(0, remainingWeight) * 1000) / 1000,
          fullStockKg:
            Math.round(Math.max(0, remainingFullStock) * 1000) / 1000,
        };
      }),
    );

    setSelectedProductId(null);
    setSellProduct(null);
  };

  const handleAddStock = ({
    productId,
    addedWeightKg,
    sellingPricePerKg,
  }: {
    productId: string;
    addedWeightKg: number;
    totalPurchaseCost: number;
    costPerKg: number;
    sellingPricePerKg: number;
  }) => {
    setProducts((currentProducts) =>
      currentProducts.map((product) => {
        if (product.id !== productId) {
          return product;
        }

        return {
          ...product,
          weightKg:
            Math.round((product.weightKg + addedWeightKg) * 1000) / 1000,
          fullStockKg:
            Math.round((product.fullStockKg + addedWeightKg) * 1000) / 1000,
          pricePerKg: sellingPricePerKg,
        };
      }),
    );

    setSelectedProductId(null);
    setAddStockProduct(null);
  };

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
      >
        <Text style={styles.title}>Lizzy's Butcher Shop</Text>

        <SummaryCard totalWeight={totalWeight} totalValue={totalValue} />

        <Text style={styles.sectionTitle}>Products</Text>

        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            reorderPercent={reorderPercent}
            isSelected={selectedProductId === product.id}
            onPress={() => {
              setSelectedProductId(
                selectedProductId === product.id ? null : product.id,
              );
            }}
            onSell={() => {
              setSellProduct(product);
            }}
            onAdd={() => {
              setAddStockProduct(product);
            }}
          />
        ))}
      </ScrollView>

      <SellModal
        product={sellProduct}
        onClose={() => {
          setSellProduct(null);
        }}
        onConfirm={handleSale}
      />

      <AddStockModal
        product={addStockProduct}
        defaultMarkupPercent={markupPercent}
        onClose={() => {
          setAddStockProduct(null);
        }}
        onConfirm={handleAddStock}
      />

      <SettingsModal
        visible={settingsVisible}
        reorderPercent={reorderPercent}
        markupPercent={markupPercent}
        voiceEnabled={voiceEnabled}
        onClose={() => {
          setSettingsVisible(false);
        }}
        onSave={async (settings) => {
          try {
            await saveBusinessSettings(settings);

            setReorderPercent(settings.reorderPercent);

            setMarkupPercent(settings.markupPercent);

            setVoiceEnabled(settings.voiceEnabled);

            setSettingsVisible(false);
          } catch (error) {
            console.error("Failed to save settings:", error);
          }
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f3f1ed",
  },

  content: {
    padding: 20,
    paddingTop: 60,
    paddingBottom: 50,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },

  title: {
    fontSize: 30,
    fontWeight: "800",
    color: "#211c18",
    marginBottom: 18,
  },

  settingsButton: {
    backgroundColor: "#211c18",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
  },

  settingsButtonText: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 12,
  },

  sectionTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#211c18",
    marginBottom: 14,
  },
});
