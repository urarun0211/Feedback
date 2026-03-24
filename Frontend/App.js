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
  Image,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import axios from "axios";
import io from "socket.io-client";
import API_URL from "./config";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";

const CACHE_KEY = "@feedback_data";
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function App() {
  const [data, setData] = useState([]);
  const [filter, setFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [loading, setLoading] = useState(false);

  const [selectedItem, setSelectedItem] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Notification Toast State
  const [toastMessage, setToastMessage] = useState(null);
  const toastY = useRef(new Animated.Value(-100)).current;

  const loadCachedData = async () => {
    try {
      const cachedData = await AsyncStorage.getItem(CACHE_KEY);
      if (cachedData !== null) {
        setData(JSON.parse(cachedData));
      }
    } catch (e) {
      console.log("Error loading cache", e);
    }
  };

  const saveToCache = async (newData) => {
    try {
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(newData));
    } catch (e) {
      console.log("Error saving cache", e);
    }
  };

  useEffect(() => {
    registerForPushNotificationsAsync().then((token) => {
      if (token) {
        sendTokenToBackend(token);
      }
    });
  }, []);

  async function registerForPushNotificationsAsync() {
    let token;
    if (Device.isDevice) {
      const { status: existingStatus } =
        await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== "granted") {
        alert("Failed to get push token for push notification!");
        return;
      }
      token = (
        await Notifications.getExpoPushTokenAsync({
          projectId: "2ee91b4c-ceb8-4a42-a0d4-6060a00d2ef2",
        })
      ).data;
    } else {
      alert("Must use physical device for Push Notifications");
    }
    return token;
  }

  const sendTokenToBackend = async (token) => {
    try {
      await axios.post(`${API_URL}/save-token`, { token });
    } catch (err) {
      console.log("Error saving token", err);
    }
  };

  /* ---------- SOCKET.IO ---------- */
  useEffect(() => {
    const socket = io(API_URL);

    socket.on("connect", () => {});

    socket.on("newFeedback", (newEntry) => {
      showToast(newEntry.message, newEntry.type);
      fetchFeedback();
    });

    socket.on("statusUpdated", (updated) => {
      setData((prev) => {
        const newData = prev.map((item) =>
          item._id === updated._id ? { ...item, status: updated.status } : item
        );
        saveToCache(newData);
        return newData;
      });
      // Also update selected modal item if open
      setSelectedItem((prev) =>
        prev && prev._id === updated._id
          ? { ...prev, status: updated.status }
          : prev
      );
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
      // ✅ Sabse naye messages manually top par sort karein
      const sortedData = res.data.sort((a, b) => new Date(b.time) - new Date(a.time));
      setData(sortedData);
      saveToCache(sortedData);
    } catch (err) {
      console.log("Axios error:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCachedData();
    fetchFeedback();
  }, []);

  /* ---------- DELETE ---------- */
  const deleteFeedback = async (id) => {
    Alert.alert("Confirm Delete", "Are you sure you want to delete?", [
      { text: "Cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await axios.delete(`${API_URL}/feedback/${id}`);
            setModalVisible(false);
            const updatedData = data.filter((item) => item._id !== id);
            setData(updatedData);
            saveToCache(updatedData);
          } catch (err) {
            Alert.alert("Error", "Delete failed");
          }
        },
      },
    ]);
  };

  const updateStatus = async (id, newStatus) => {
    try {
      setActionLoading(true);
      await axios.patch(`${API_URL}/feedback/${id}/status`, {
        status: newStatus,
      });
      // ✅ Manually update local state as fallback
      setData((prev) =>
        prev.map((item) =>
          item._id === id ? { ...item, status: newStatus } : item
        )
      );
      if (selectedItem && selectedItem._id === id) {
        setSelectedItem({ ...selectedItem, status: newStatus });
      }
    } catch (err) {
      Alert.alert("Error", "Status update failed");
    } finally {
      setActionLoading(false);
    }
  };

  /* ---------- FILTER ---------- */
  const filteredData = data
    .filter((item) => filter === "All" || item.type === filter)
    .filter(
      (item) => statusFilter === "All" || item.status === statusFilter
    );

  /* ---------- STATS ---------- */
  const totalComplaints = data.filter((i) => i.type === "Complaint").length;
  const pendingComplaints = data.filter(
    (i) => i.type === "Complaint" && i.status === "Pending"
  ).length;
  const closedComplaints = data.filter(
    (i) => i.type === "Complaint" && i.status === "Closed"
  ).length;

  /* ---------- CARD ---------- */
  const renderItem = ({ item }) => {
    const isComplaint = item.type === "Complaint";
    const isClosed = item.status === "Closed";

    return (
      <TouchableOpacity
        style={[
          styles.card,
          isComplaint ? styles.complaint : styles.feedback,
          isClosed && styles.closedCard,
        ]}
        onPress={() => {
          setSelectedItem(item);
          setModalVisible(true);
        }}
      >
        <View style={styles.cardHeader}>
          <Text
            style={[
              styles.type,
              { color: isComplaint ? "#d32f2f" : "#a855f7" },
            ]}
          >
            {item.type}
          </Text>
          <View
            style={[
              styles.statusBadge,
              isClosed ? styles.closedBadge : styles.pendingBadge,
            ]}
          >
            <Text style={styles.statusBadgeText}>
              {isClosed ? "✅ Closed" : "⏳ Pending"}
            </Text>
          </View>
        </View>

        <Text style={[styles.message, isClosed && styles.closedMessage]} numberOfLines={2}>
          {item.message}
        </Text>

        <Text style={styles.time}>
          {new Date(item.time).toLocaleString()}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.safe}>
      <StatusBar style="dark" />

      {/* NOTIFICATION TOAST */}
      {toastMessage && (
        <Animated.View
          style={[styles.toast, { transform: [{ translateY: toastY }] }]}
        >
          <View
            style={[
              styles.toastIndicator,
              {
                backgroundColor:
                  toastMessage.type === "Complaint" ? "#d32f2f" : "#a855f7",
              },
            ]}
          />
          <View>
            <Text style={styles.toastTitle}>New {toastMessage.type}!</Text>
            <Text style={styles.toastText} numberOfLines={1}>
              {toastMessage.msg}
            </Text>
          </View>
        </Animated.View>
      )}

      {/* HEADER */}
      <View style={styles.header}>
        <Image
          source={require("./assets/logo.png")}
          style={{ width: 45, height: 45, borderRadius: 8, marginRight: 12 }}
        />
        <View>
          <Text style={styles.title}>Admin Feedback</Text>
          <Text style={styles.subtitle}>SANGHI BROTHERS</Text>
        </View>
      </View>

      {/* STATS */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { borderLeftColor: "#f57c00" }]}>
          <Text style={styles.statNum}>{totalComplaints}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={[styles.statCard, { borderLeftColor: "#d32f2f" }]}>
          <Text style={styles.statNum}>{pendingComplaints}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={[styles.statCard, { borderLeftColor: "#2e7d32" }]}>
          <Text style={styles.statNum}>{closedComplaints}</Text>
          <Text style={styles.statLabel}>Closed</Text>
        </View>
      </View>

      {/* TYPE FILTER */}
      <View style={styles.filterRow}>
        {["All", "Feedback", "Complaint"].map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterBtn, filter === f && styles.activeFilter]}
            onPress={() => setFilter(f)}
          >
            <Text
              style={[
                styles.filterText,
                filter === f && styles.activeFilterText,
              ]}
            >
              {f}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* STATUS FILTER */}
      <View style={styles.filterRow}>
        {["All", "Pending", "Closed"].map((s) => (
          <TouchableOpacity
            key={s}
            style={[
              styles.filterBtn,
              statusFilter === s && styles.activeStatusFilter,
            ]}
            onPress={() => setStatusFilter(s)}
          >
            <Text
              style={[
                styles.filterText,
                statusFilter === s && styles.activeFilterText,
              ]}
            >
              {s === "Pending" ? "⏳ " : s === "Closed" ? "✅ " : ""}
              {s}
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
                <View style={styles.modalTitleRow}>
                  <Text style={styles.modalTitle}>{selectedItem.type}</Text>
                  <View
                    style={[
                      styles.statusBadge,
                      selectedItem.status === "Closed"
                        ? styles.closedBadge
                        : styles.pendingBadge,
                    ]}
                  >
                    <Text style={styles.statusBadgeText}>
                      {selectedItem.status === "Closed"
                        ? "✅ Closed"
                        : "⏳ Pending"}
                    </Text>
                  </View>
                </View>

                <Text style={styles.modalLabel}>Message</Text>
                <Text style={styles.modalText}>{selectedItem.message}</Text>

                <Text style={styles.modalLabel}>Time</Text>
                <Text style={styles.modalText}>
                  {new Date(selectedItem.time).toLocaleString()}
                </Text>

                {/* ACTION BUTTON */}
                <TouchableOpacity
                  style={[
                    styles.actionBtn,
                    selectedItem.status === "Closed"
                      ? styles.pendingActionBtn
                      : styles.closedActionBtn,
                  ]}
                  onPress={() =>
                    updateStatus(
                      selectedItem._id,
                      selectedItem.status === "Closed" ? "Pending" : "Closed"
                    )
                  }
                  disabled={actionLoading}
                >
                  <Text style={styles.actionBtnText}>
                    {actionLoading
                      ? "Updating..."
                      : selectedItem.status === "Closed"
                      ? "🔄 Mark as Pending"
                      : "✅ Mark as Closed"}
                  </Text>
                </TouchableOpacity>

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
  toastTitle: { fontWeight: "800", fontSize: 14, color: "#333" },
  toastText: { fontSize: 13, color: "#666", marginTop: 2 },

  header: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: "#e0e0e0",
    marginTop: 40,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#a855f7",
  },
  subtitle: { fontSize: 13, color: "#666", marginTop: 2 },

  /* STATS */
  statsRow: {
    flexDirection: "row",
    paddingHorizontal: 10,
    paddingTop: 10,
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 10,
    borderLeftWidth: 4,
    elevation: 2,
    alignItems: "center",
  },
  statNum: { fontSize: 22, fontWeight: "800", color: "#333" },
  statLabel: { fontSize: 11, color: "#888", marginTop: 2 },

  filterRow: { flexDirection: "row", paddingHorizontal: 10, paddingTop: 8 },

  filterBtn: {
    flex: 1,
    paddingVertical: 8,
    marginHorizontal: 3,
    borderRadius: 20,
    backgroundColor: "#eee",
    alignItems: "center",
  },
  activeFilter: { backgroundColor: "#a855f7" },
  activeStatusFilter: { backgroundColor: "#1565c0" },
  filterText: { fontSize: 12, fontWeight: "600" },
  activeFilterText: { color: "#fff" },

  card: {
    margin: 10,
    padding: 14,
    borderRadius: 12,
    elevation: 2,
    borderColor: "#a855f720",
    backgroundColor: "#ffffff",
  },
  feedback: {
    borderLeftColor: "#a855f7",
  },
  complaint: {
    backgroundColor: "#fff1f1",
    borderLeftWidth: 5,
    borderLeftColor: "#d32f2f",
  },
  closedCard: { opacity: 0.65 },
  closedMessage: { textDecorationLine: "line-through", color: "#999" },

  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },

  /* STATUS BADGE */
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  pendingBadge: { backgroundColor: "#fff3e0" },
  closedBadge: { backgroundColor: "#e8f5e9" },
  statusBadgeText: { fontSize: 11, fontWeight: "700" },

  message: { fontSize: 15, marginBottom: 6 },
  type: { fontWeight: "700" },
  time: { fontSize: 12, color: "#888" },

  empty: { textAlign: "center", marginTop: 40, color: "#777" },

  /* MODAL */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    padding: 20,
  },
  modalBox: { backgroundColor: "#fff", borderRadius: 16, padding: 18 },

  modalTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  modalTitle: { fontSize: 18, fontWeight: "800" },

  modalLabel: { fontSize: 13, color: "#555", marginTop: 10 },
  modalText: { fontSize: 15, color: "#111" },

  /* ACTION BUTTON */
  actionBtn: {
    marginTop: 16,
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  closedActionBtn: { backgroundColor: "#2e7d32" },
  pendingActionBtn: { backgroundColor: "#f57c00" },
  actionBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },

  modalActions: {
    flexDirection: "row",
    marginTop: 12,
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
