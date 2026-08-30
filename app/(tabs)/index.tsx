import { syncPendingChanges } from "@/src/services/sync";

import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useState } from "react";

import { saveProductImageLocally } from "@/src/services/local-product-images";

import {
  loadBusinessSettings,
  saveBusinessSettings,
} from "@/src/services/settings";

import {
  loadProducts,
  updateProductImage,
  loadLocalProducts,
} from "@/src/services/products";

import { updateLocalProductImage } from "@/src/db/repositories/products-repository";


import { addLocalStockTransaction } from "@/src/services/local-stock";

import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable
} from "react-native";

import ProductCard, { Product } from "../../components/ProductCard";

import SettingsModal from "@/components/SettingsModal";
import AddStockModal from "../../components/AddStockModal";
import SellModal from "../../components/SellModal";
import SummaryCard from "../../components/SummaryCard";

import { useFocusEffect } from "@react-navigation/native";
import { completeLocalSaleTransaction } from "@/src/services/local-sales";
import { printSaleReceipt } from "@/src/services/printer";



export default function HomeScreen() {

  type CartItem = {
    productId: string;
    productName: string;
    weightKg: number;
    pricePerKg: number;
  };

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

  const [cart, setCart] = useState<CartItem[]>([]);



  useEffect(() => {
    void syncPendingChanges();
  }, []);

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

  useFocusEffect(
    useCallback(() => {
      void syncPendingChanges();
    }, [])
  );

  const refreshProducts = useCallback(async () => {
    try {
      setProductsLoading(true)     // 1. Load SQLite immediately
      const localProducts = await loadLocalProducts();

      if (localProducts.length > 0) {
        setProducts(localProducts);
      }

      //local data is ready , so stop the loading state now 

      setProductsLoading(false);

      //refresh from Firebase in the background 

      void loadProducts()
        .then((freshProducts) => {
          setProducts(freshProducts);
        })
        .catch((firebaseError) => {
          console.log(
            "Firebase unavailable. Continuing with local products.",
            firebaseError,
          );
        });

    } catch (error) {
      console.error(
        "Failed to load local products:",
        error,
      );

      setProductsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshProducts();
  }, [refreshProducts]);


  const uploadSelectedImage = async (
    product: Product,
    localUri: string,
    fileName?: string | null,
    mimeType?: string | null
  ) => {
    const savedLocalUri =
      await saveProductImageLocally(
        product.id,
        localUri,
        fileName,
        mimeType
      );
    await updateLocalProductImage(
      product.id,
      savedLocalUri
    );
    setProducts((currentProducts) =>
      currentProducts.map((item) =>
        item.id === product.id
          ? {
            ...item,
            imageUrl: savedLocalUri,
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
        asset.uri,
        asset.fileName,
        asset.mimeType
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

  const handleAddToCart = (
    productId: string,
    weightKg: number,
  ) => {
    const product = products.find(
      (item) => item.id === productId,
    );

    if (!product) {
      return;
    }

    setCart((currentCart) => {
      const existingItem = currentCart.find(
        (item) => item.productId === productId,
      );

      if (existingItem) {
        const newWeight =
          existingItem.weightKg + weightKg;

        if (newWeight > product.weightKg) {
          console.error(
            `Only ${product.weightKg.toFixed(
              2,
            )} kg is available.`,
          );

          return currentCart;
        }

        return currentCart.map((item) =>
          item.productId === productId
            ? {
              ...item,
              weightKg: newWeight,
            }
            : item,
        );
      }

      return [
        ...currentCart,
        {
          productId,
          productName: product.name,
          weightKg,
          pricePerKg: product.pricePerKg,
        },
      ];
    });

    setSelectedProductId(null);
    setSellProduct(null);
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
      const result = await addLocalStockTransaction({
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

  const cartTotal = cart.reduce(
    (total, item) =>
      total + item.weightKg * item.pricePerKg,
    0,
  );

  const handleCompleteCartSale = async () => {
    if (cart.length === 0) {
      return;
    }

    try {
      const result = await completeLocalSaleTransaction({
        items: cart.map((item) => ({
          productId: item.productId,
          weightKg: item.weightKg,
        })),
      });

      setProducts((currentProducts) =>
        currentProducts.map((product) => {
          const soldItem = result.items.find(
            (item) => item.productId === product.id,
          );

          if (!soldItem) {
            return product;
          }

          return {
            ...product,
            weightKg: soldItem.remainingWeightKg,
          };
        }),
      );

      console.log(
        "SALE SAVED:",
        result.saleId,
        "ITEMS:",
        result.items.length,
        "GHS",
        result.totalAmount,
      );
      try {
        const printResult = await printSaleReceipt({
          saleId: result.saleId,
          items: result.items.map((item) => ({
            productName: item.productName,
            weightKg: item.weightKg,
            pricePerKg: item.pricePerKg,
            lineTotal: item.lineTotal,
          })),
          totalAmount: result.totalAmount,
        });

        console.log(
          "RECEIPT PRINT:",
          printResult,
        );
      } catch (printError) {
        console.error(
          "Sale saved, but receipt printing failed:",
          printError,
        );
      }
      setCart([]);

      // Printing will go HERE.
      // One print call for the entire transaction.
    } catch (error) {
      console.error(
        "Sale failed:",
        error,
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
        onConfirm={handleAddToCart}
      />

      {cart.length > 0 && (
        <View style={styles.cartCard}>
          <Text style={styles.cartTitle}>
            Current Sale
          </Text>

          {cart.map((item) => {
            const lineTotal =
              item.weightKg * item.pricePerKg;

            return (
              <View
                key={item.productId}
                style={styles.cartItem}
              >
                <View style={styles.cartItemDetails}>
                  <Text style={styles.cartItemName}>
                    {item.productName}
                  </Text>

                  <Text style={styles.cartItemMeta}>
                    {item.weightKg.toFixed(2)} kg × GHS{" "}
                    {item.pricePerKg.toFixed(2)}
                  </Text>
                </View>

                <Text style={styles.cartItemTotal}>
                  GHS {lineTotal.toFixed(2)}
                </Text>
              </View>
            );
          })}

          <View style={styles.cartTotalRow}>
            <Text style={styles.cartTotalLabel}>
              TOTAL
            </Text>

            <Text style={styles.cartTotalAmount}>
              GHS {cartTotal.toFixed(2)}
            </Text>
          </View>

          <Pressable
            style={styles.completeCartButton}
            onPress={handleCompleteCartSale}
          >
            <Text style={styles.completeCartButtonText}>
              COMPLETE SALE
            </Text>
          </Pressable>
        </View>
      )}

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
  cartCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 18,
    marginTop: 20,
    borderWidth: 1,
    borderColor: "#e4dfd9",
  },

  cartTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#211c18",
    marginBottom: 12,
  },

  cartItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eee9e5",
  },

  cartItemDetails: {
    flex: 1,
    paddingRight: 12,
  },

  cartItemName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#211c18",
  },

  cartItemMeta: {
    marginTop: 3,
    fontSize: 12,
    color: "#726962",
  },

  cartItemTotal: {
    fontSize: 15,
    fontWeight: "800",
    color: "#211c18",
  },

  cartTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 2,
    borderTopColor: "#211c18",
  },

  cartTotalLabel: {
    fontSize: 16,
    fontWeight: "800",
    color: "#211c18",
  },

  cartTotalAmount: {
    fontSize: 24,
    fontWeight: "800",
    color: "#367c4a",
  },

  completeCartButton: {
    marginTop: 18,
    backgroundColor: "#367c4a",
    paddingVertical: 16,
    borderRadius: 13,
    alignItems: "center",
  },

  completeCartButtonText: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 16,
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
