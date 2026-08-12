import { StyleSheet, Text, View } from "react-native";

type SummaryCardProps = {
  totalWeight: number;
  totalValue: number;
};

export default function SummaryCard({
  totalWeight,
  totalValue,
}: SummaryCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>TOTAL STOCK</Text>

      <Text style={styles.weight}>
        {totalWeight.toFixed(1)} kg
      </Text>

      <Text style={styles.value}>
        GHS {totalValue.toFixed(2)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#211c18",
    padding: 22,
    borderRadius: 18,
    marginBottom: 28,
  },

  label: {
    color: "#bcb4ad",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.5,
  },

  weight: {
    color: "#ffffff",
    fontSize: 34,
    fontWeight: "800",
    marginTop: 8,
  },

  value: {
    color: "#e9b949",
    fontSize: 34,
    fontWeight: "700",
    marginTop: 4,
  },
});