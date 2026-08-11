import {
  Pressable,
  StyleSheet,
  Text,
  Image,
  View,
} from "react-native";

export type Product = {
  id: string;
  name: string;
  weightKg: number;
  fullStockKg: number;
  pricePerKg: number;
  thumbnail: ReturnType<typeof require>;
};

type ProductCardProps = {
  product: Product;
  isSelected: boolean;
  reorderPercent: number;
  onPress: () => void;
  onSell: () => void;
  onAdd: () => void;
};

export default function ProductCard({
  product,
  isSelected,
  reorderPercent,
  onPress,
  onSell,
  onAdd,
}: ProductCardProps) {
  const stockPercentage =
    product.fullStockKg > 0
      ? (product.weightKg / product.fullStockKg) * 100
      : 0;

  const safePercentage = Math.max(
    0,
    Math.min(stockPercentage, 100)
  );

  const needsReorder =
    stockPercentage <= reorderPercent;

  const productValue =
    product.weightKg * product.pricePerKg;

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.productCard,
        needsReorder && styles.reorderCard,
      ]}
    >
      <Image
        source={product.thumbnail}
        style={styles.productImage}
        resizeMode="contain"
      />

      <View style={styles.productHeader}>
        <Text style={styles.productName}>
          {product.name}
        </Text>

        {needsReorder && (
          <Text style={styles.reorderBadge}>
            REORDER
          </Text>
        )}
      </View>

      <Text style={styles.weight}>
        {product.weightKg.toFixed(1)} kg
      </Text>

      <View style={styles.detailsRow}>
        <Text style={styles.price}>
          GHS {product.pricePerKg.toFixed(2)} / kg
        </Text>

        <Text style={styles.productValue}>
          GHS {productValue.toFixed(2)}
        </Text>
      </View>

      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressBar,
            {
              width: `${safePercentage}%`,
            },
            needsReorder && styles.reorderBar,
          ]}
        />
      </View>

      <View style={styles.stockFooter}>
        <Text style={styles.stockText}>
          {stockPercentage.toFixed(0)}% remaining
        </Text>

        <Text style={styles.stockText}>
          Full stock: {product.fullStockKg} kg
        </Text>
      </View>

      {isSelected && (
        <View style={styles.actions}>
          <Pressable
            style={[
              styles.actionButton,
              styles.sellButton,
            ]}
            onPress={(event) => {
              event.stopPropagation();
              onSell();
            }}
          >
            <Text style={styles.actionButtonText}>
              SELL
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.actionButton,
              styles.addButton,
            ]}
            onPress={(event) => {
              event.stopPropagation();
              onAdd();
            }}
          >
            <Text style={styles.actionButtonText}>
              ADD
            </Text>
          </Pressable>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  productCard: {
    backgroundColor: "#ffffff",
    padding: 18,
    borderRadius: 16,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#e4dfd9",
    overflow: "hidden",
  },

  productImage: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 72,
    height: 72,
    zIndex: 1,
  },

  reorderCard: {
    backgroundColor: "#ffe5e5",
    borderColor: "#c62828",
    borderWidth: 2,
  },

  productHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    paddingRight: 78,
  },

  productName: {
    fontSize: 21,
    fontWeight: "800",
    color: "#211c18",
    flex: 1,
  },

  reorderBadge: {
    backgroundColor: "#c62828",
    color: "#ffffff",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    fontSize: 11,
    fontWeight: "800",
  },

  weight: {
    fontSize: 31,
    fontWeight: "800",
    color: "#211c18",
    marginTop: 14,
    paddingRight: 78,
  },

  detailsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
    paddingRight: 78,
  },

  price: {
    fontSize: 15,
    color: "#5d554f",
  },

  productValue: {
    fontSize: 15,
    fontWeight: "700",
    color: "#211c18",
  },

  progressTrack: {
    height: 11,
    backgroundColor: "#dedad5",
    borderRadius: 999,
    overflow: "hidden",
    marginTop: 16,
  },

  progressBar: {
    height: "100%",
    backgroundColor: "#367c4a",
  },

  reorderBar: {
    backgroundColor: "#c62828",
  },

  stockFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 7,
  },

  stockText: {
    fontSize: 12,
    color: "#726962",
  },

  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#e3ddd7",
  },

  actionButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },

  sellButton: {
    backgroundColor: "#8f1d2c",
  },

  addButton: {
    backgroundColor: "#367c4a",
  },

  actionButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
  },
});
