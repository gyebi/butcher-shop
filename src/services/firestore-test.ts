import firestore from "@react-native-firebase/firestore";

export async function testFirestoreConnection() {
  try {
    await firestore()
      .collection("system")
      .doc("connection-test")
      .set({
        app: "Auntie Lizzy's Butcher Shop",
        status: "connected",
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });

    console.log("Firestore Test: Success");
  } catch (error) {
    console.error("Firestore Test: Failed:", error);
  }
}
