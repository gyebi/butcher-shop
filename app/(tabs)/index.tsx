import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useState } from "react";

import {
  loadBusinessSettings,
  saveBusinessSettings,
} from "@/src/services/settings";

import {
  loadProducts,
  updateProductImage,
} from "@/src/services/products";

import {
  uploadProductImage,
} from "@/src/services/product-images";
import { addStockTransaction } from "@/src/services/stock-batches";

import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";

import ProductCard, { Product } from "../../components/ProductCard";

import SettingsModal from "@/components/SettingsModal";
import AddStockModal from "../../components/AddStockModal";
import SellModal from "../../components/SellModal";
import SummaryCard from "../../components/SummaryCard";

import { useFocusEffect } from "@react-navigation/native";
import { completeSaleTransaction } from "@/src/services/sales";

export default function HomeScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);

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

  useEffect(() => {
    async function initialiseProducts() {
      try {
        const savedProducts = await loadProducts();
        setProducts(savedProducts);
      } catch (error) {
        console.error("Failed to load products:", error);
      } finally {
        setProductsLoading(false);
      }
    }

    initialiseProducts();
  }, []);

  const refreshProducts = useCallback(async () => {
    try {
      setProductsLoading(true);

      const loadedProducts = await loadProducts();

      setProducts(loadedProducts);
    } catch (error) {
      console.error("Failed to load products:", error);
    } finally {
      setProductsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshProducts();
    }, [refreshProducts]),
  );


  const uploadSelectedImage = async (
    product: Product,
    localUri: string
  ) => {
    const { imagePath, imageUrl } =
      await uploadProductImage(
        product.id,
        localUri
      );

    await updateProductImage(
      product.id,
      imagePath
    );

    setProducts((currentProducts) =>
      currentProducts.map((item) =>
        item.id === product.id
          ? {
            ...item,
            imagePath,
            imageUrl,
          }
          : item
      )
    );
  };

  const chooseImageFromGallery = async (
    product: Product
  ) => {
    try {
      const result =
        await ImagePicker.launchImageLibraryAsync({
          mediaTypes: "images",
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.8,
        });

      if (result.canceled) {
        return;
      }

      const asset = result.assets[0];

      if (!asset?.uri) {
        return;
      }

      await uploadSelectedImage(
        product,
        asset.uri
      );
    } catch (error) {
      console.error(
        "Failed to choose image:",
        error
      );
    }
  };

  const takeProductPhoto = async (
    product: Product
  ) => {
    try {
      const permission =
        await ImagePicker.requestCameraPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Camera permission required",
          "Please allow camera access to take a product photo."
        );

        return;
      }

      const result =
        await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.8,
        });

      if (result.canceled) {
        return;
      }

      const asset = result.assets[0];

      if (!asset?.uri) {
        return;
      }

      await uploadSelectedImage(
        product,
        asset.uri
      );
    } catch (error) {
      console.error(
        "Failed to take product photo:",
        error
      );
    }
  };

  const handleChooseImage = (
    product: Product
  ) => {
    Alert.alert(
      "Product Image",
      `Update image for ${product.name}`,
      [
        {
          text: "Choose from Gallery",
          onPress: () =>
            chooseImageFromGallery(product),
        },
        {
          text: "Take Photo",
          onPress: () =>
            takeProductPhoto(product),
        },
        {
          text: "Cancel",
          style: "cancel",
        },
      ]
    );
  };

  const totalWeight = products.reduce(
    (total, product) => total + product.weightKg,
    0,
  );

  const totalValue = products.reduce(
    (total, product) => total + product.weightKg * product.pricePerKg,
    0,
  );

  if (productsLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading stock...</Text>
      </View>
    );
  }

  const handleSale = async (
    productId: string,
    weightKg: number
  ) => {
    try {
      const result =
        await completeSaleTransaction({
          productId,
          weightKg,
        });

      setProducts((currentProducts) =>
        currentProducts.map((product) =>
          product.id === productId
            ? {
              ...product,
              weightKg:
                result.remainingWeightKg,
            }
            : product
        )
      );

      setSelectedProductId(null);
      setSellProduct(null);

      console.log(
        "SALE SAVED:",
        result.saleId,
        "GHS",
        result.totalAmount
      );
    } catch (error) {
      console.error(
        "Sale failed:",
        error
      );
    }
  };

  const handleAddStock = async ({
    productId,
    addedWeightKg,
    totalPurchaseCost,
    costPerKg,
    sellingPricePerKg,
  }: {
    productId: string;
    addedWeightKg: number;
    totalPurchaseCost: number;
    costPerKg: number;
    sellingPricePerKg: number;
  }) => {
    try {
      const result =
        await addStockTransaction({
          productId,
          addedWeightKg,
          totalPurchaseCost,
          costPerKg,
          sellingPricePerKg,
        });

      setProducts((currentProducts) =>
        currentProducts.map((product) =>
          product.id === productId
            ? {
              ...product,
              weightKg:
                result.newWeightKg,

              pricePerKg:
                result.sellingPricePerKg,

              fullStockKg:
                result.fullStockKg,
            }
            : product
        )
      );

      setSelectedProductId(null);
      setProductsLoading(false);

      console.log(
        "STOCK ADDED:",
        result.batchId
      );
    } catch (error) {
      console.error(
        "Add stock failed:",
        error
      );
    }
  };

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
      >
        <Text style={styles.title}>Lizzys Butcher Shop</Text>

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
            onChooseImage={() => {
              handleChooseImage(product);
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

  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f3f1ed",
  },

  loadingText: {
    color: "#5d554f",
    fontSize: 15,
    fontWeight: "600",
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
