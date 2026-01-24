import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Modal,
  Alert,
  Animated,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import axios from "axios";
import io from "socket.io-client";
import API_URL from "./config";

export default function App() {
  const [data, setData] = useState([]);
  const [filter, setFilter] = useState("All");
  const [loading, setLoading] = useState(false);

  const [selectedItem, setSelectedItem] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  // Notification Toast State
  const [toastMessage, setToastMessage] = useState(null);
  const toastY = useRef(new Animated.Value(-100)).current;

  /* ---------- SOCKET.IO ---------- */
  useEffect(() => {
    const socket = io(API_URL);

    socket.on("connect", () => console.log("✅ Connected to Socket.io"));
    
    socket.on("newFeedback", (newEntry) => {
      showToast(newEntry.message, newEntry.type);
      fetchFeedback(); // Auto-refresh list
    });

    return () => socket.disconnect();
  }, []);

  const showToast = (msg, type) => {
    setToastMessage({ msg, type });
    Animated.spring(toastY, {
      toValue: 50,
      useNativeDriver: true,
      tension: 20,
      friction: 4,
    }).start();

    // Hide after 4 seconds
    setTimeout(() => {
      Animated.timing(toastY, {
        toValue: -150,
        duration: 500,
        useNativeDriver: true,
      }).start(() => setToastMessage(null));
    }, 4500);
  };

  /* ---------- FETCH ---------- */
  const fetchFeedback = async () => {
    try {
      setLoading(true);
      const res = await axios.get(API_URL + "/feedback");
      setData(res.data);
    } catch (err) {
      console.log("Axios error:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeedback();
  }, []);

  /* ---------- DELETE ---------- */
  const deleteFeedback = async (id) => {
    Alert.alert(
      "Confirm Delete",
      "Are you sure you want to delete?",
      [
        { text: "Cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await axios.delete(`${API_URL}/feedback/${id}`);
              setModalVisible(false);
              fetchFeedback();
            } catch (err) {
              Alert.alert("Error", "Delete failed");
            }
          },
        },
      ]
    );
  };

  /* ---------- FILTER ---------- */
  const filteredData =
    filter === "All"
      ? data
      : data.filter((item) => item.type === filter);

  /* ---------- CARD ---------- */
  const renderItem = ({ item }) => {
    const isComplaint = item.type === "Complaint";

    return (
      <TouchableOpacity
        style={[
          styles.card,
          isComplaint ? styles.complaint : styles.feedback,
        ]}
        onPress={() => {
          setSelectedItem(item);
          setModalVisible(true);
        }}
      >
        <Text style={styles.message} numberOfLines={2}>
          {item.message}
        </Text>

        <View style={styles.metaRow}>
          <Text style={[styles.type, { color: isComplaint ? "#d32f2f" : "#2e7d32" }]}>
            {item.type}
          </Text>
          <Text style={styles.time}>
            {new Date(item.time).toLocaleString()}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.safe}>
      <StatusBar style="dark" />

      {/* NOTIFICATION TOAST */}
      {toastMessage && (
        <Animated.View style={[styles.toast, { transform: [{ translateY: toastY }] }]}>
          <View style={[styles.toastIndicator, { backgroundColor: toastMessage.type === "Complaint" ? "#d32f2f" : "#2e7d32" }]} />
          <View>
            <Text style={styles.toastTitle}>New {toastMessage.type}!</Text>
            <Text style={styles.toastText} numberOfLines={1}>{toastMessage.msg}</Text>
          </View>
        </Animated.View>
      )}

      {/* HEADER */}
      <View style={styles.headerBox}>
        <Text style={styles.header}>Admin Dashboard</Text>
        <Text style={styles.subHeader}>Feedback & Complaints</Text>
      </View>

      {/* FILTER */}
      <View style={styles.filterRow}>
        {["All", "Feedback", "Complaint"].map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterBtn, filter === f && styles.activeFilter]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.activeFilterText]}>
              {f}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* LIST */}
      <FlatList
        data={filteredData}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={fetchFeedback} />
        }
        ListEmptyComponent={
          <Text style={styles.empty}>No feedback found</Text>
        }
      />

      {/* ---------- MODAL ---------- */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            {selectedItem && (
              <>
                <Text style={styles.modalTitle}>{selectedItem.type}</Text>

                <Text style={styles.modalLabel}>Message</Text>
                <Text style={styles.modalText}>{selectedItem.message}</Text>

                <Text style={styles.modalLabel}>Time</Text>
                <Text style={styles.modalText}>
                  {new Date(selectedItem.time).toLocaleString()}
                </Text>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.closeBtn}
                    onPress={() => setModalVisible(false)}
                  >
                    <Text style={styles.btnText}>Close</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => deleteFeedback(selectedItem._id)}
                  >
                    <Text style={styles.btnText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ---------------- STYLES ---------------- */

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f2fdf6" },

  /* TOAST */
  toast: {
    position: "absolute",
    top: 0,
    left: 20,
    right: 20,
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    zIndex: 9999,
  },
  toastIndicator: {
    width: 6,
    height: "100%",
    borderRadius: 3,
    marginRight: 12,
  },
  toastTitle: {
    fontWeight: "800",
    fontSize: 14,
    color: "#333",
  },
  toastText: {
    fontSize: 13,
    color: "#666",
    marginTop: 2,
  },

  headerBox: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: "#e0e0e0",
    marginTop: 40,
  },

  header: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1b5e20",
    textAlign: "center",
  },

  subHeader: {
    fontSize: 13,
    color: "#666",
    textAlign: "center",
  },

  filterRow: { flexDirection: "row", padding: 10 },

  filterBtn: {
    flex: 1,
    paddingVertical: 10,
    marginHorizontal: 4,
    borderRadius: 20,
    backgroundColor: "#eee",
    alignItems: "center",
  },

  activeFilter: { backgroundColor: "#2e7d32" },
  filterText: { fontSize: 13, fontWeight: "600" },
  activeFilterText: { color: "#fff" },

  card: {
    margin: 10,
    padding: 14,
    borderRadius: 12,
    elevation: 2,
  },

  feedback: {
    backgroundColor: "#fff",
    borderLeftWidth: 5,
    borderLeftColor: "#2e7d32",
  },

  complaint: {
    backgroundColor: "#fff1f1",
    borderLeftWidth: 5,
    borderLeftColor: "#d32f2f",
  },

  message: { fontSize: 15, marginBottom: 8 },

  metaRow: { flexDirection: "row", justifyContent: "space-between" },

  type: { fontWeight: "700" },
  time: { fontSize: 12, color: "#666" },

  empty: { textAlign: "center", marginTop: 40, color: "#777" },

  /* MODAL */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    padding: 20,
  },

  modalBox: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
  },

  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 10,
  },

  modalLabel: {
    fontSize: 13,
    color: "#555",
    marginTop: 10,
  },

  modalText: {
    fontSize: 15,
    color: "#111",
  },

  modalActions: {
    flexDirection: "row",
    marginTop: 20,
    justifyContent: "space-between",
  },

  closeBtn: {
    backgroundColor: "#777",
    padding: 10,
    borderRadius: 8,
    flex: 1,
    marginRight: 6,
  },

  deleteBtn: {
    backgroundColor: "#d32f2f",
    padding: 10,
    borderRadius: 8,
    flex: 1,
    marginLeft: 6,
  },

  btnText: { color: "#fff", textAlign: "center", fontWeight: "700" },
});

