import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import SettingsModal from "@/components/SettingsModal";

export default function SettingsScreen() {
  const [settingsVisible, setSettingsVisible] = useState(true);
  const [reorderPercent, setReorderPercent] = useState(20);
  const [markupPercent, setMarkupPercent] = useState(25);
  const [voiceEnabled, setVoiceEnabled] = useState(true);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.description}>
        Tap below to adjust stock alerts, markup, and voice preferences.
      </Text>

      <SettingsModal
        visible={settingsVisible}
        reorderPercent={reorderPercent}
        markupPercent={markupPercent}
        voiceEnabled={voiceEnabled}
        onClose={() => {
          setSettingsVisible(false);
        }}
        onSave={({ reorderPercent, markupPercent, voiceEnabled }) => {
          setReorderPercent(reorderPercent);
          setMarkupPercent(markupPercent);
          setVoiceEnabled(voiceEnabled);
          setSettingsVisible(false);
        }}
      />

      {!settingsVisible && (
        <View style={styles.closedCard}>
          <Text style={styles.closedText}>
            Settings saved. Tap the gear tab again to edit.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    padding: 20,
    paddingTop: 60,
    backgroundColor: "#f3f1ed",
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: "#211c18",
    marginBottom: 12,
  },
  description: {
    fontSize: 15,
    color: "#5d554f",
    marginBottom: 20,
  },
  closedCard: {
    backgroundColor: "#ffffff",
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e4dfd9",
  },
  closedText: {
    color: "#211c18",
    fontSize: 14,
  },
});
