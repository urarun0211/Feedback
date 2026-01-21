import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import axios from "axios";
import API_URL from "./config";

export default function App() {
  const [data, setData] = useState([]);
  const [filter, setFilter] = useState("All");
  const [loading, setLoading] = useState(false);

  const fetchFeedback = async () => {
    try {
      setLoading(true);
      const res = await axios.get({API_URL}/feedback);
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

  const filteredData =
    filter === "All"
      ? data
      : data.filter((item) => item.type === filter);

  const renderItem = ({ item }) => {
    const isComplaint = item.type === "Complaint";

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        style={[
          styles.card,
          isComplaint ? styles.complaint : styles.feedback,
        ]}
      >
        <Text style={styles.message}>{item.message}</Text>

        <View style={styles.metaRow}>
          <Text
            style={[
              styles.type,
              { color: isComplaint ? "#d32f2f" : "#2e7d32" },
            ]}
          >
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

      {/* HEADER */}
      <View style={styles.headerBox}>
        <Text style={styles.header}>Admin Dashboard</Text>
        <Text style={styles.subHeader}>
          Feedback & Complaints
        </Text>
      </View>

      {/* FILTER */}
      <View style={styles.filterRow}>
        {["All", "Feedback", "Complaint"].map((f) => (
          <TouchableOpacity
            key={f}
            style={[
              styles.filterBtn,
              filter === f && styles.activeFilter,
            ]}
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

      {/* LIST */}
      <FlatList
        contentContainerStyle={{ paddingBottom: 20 }}
        data={filteredData}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={fetchFeedback}
            colors={["#2e7d32"]}
          />
        }
        ListEmptyComponent={
          <Text style={styles.empty}>No feedback found</Text>
        }
      />
    </View>
  );
}

/* ---------------- STYLES ---------------- */

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#f2fdf6",
  },

  headerBox: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderColor: "#e0e0e0",
    marginTop:40
  },

  header: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1b5e20",
    alignContent:'center',
    textAlign:'center'
  },

  subHeader: {
    fontSize: 13,
    color: "#666",
    marginTop: 2,textAlign:'center'
  },

  filterRow: {
    flexDirection: "row",
    padding: 10,
  },

  filterBtn: {
    flex: 1,
    paddingVertical: 10,
    marginHorizontal: 4,
    borderRadius: 20,
    backgroundColor: "#eeeeee",
    alignItems: "center",
  },

  activeFilter: {
    backgroundColor: "#2e7d32",
  },

  filterText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#333",
  },

  activeFilterText: {
    color: "#ffffff",
  },

  card: {
    marginHorizontal: 12,
    marginVertical: 6,
    padding: 14,
    borderRadius: 12,
    elevation: 2,
  },

  feedback: {
    backgroundColor: "#ffffff",
    borderLeftWidth: 5,
    borderLeftColor: "#2e7d32",
  },

  complaint: {
    backgroundColor: "#fff1f1",
    borderLeftWidth: 5,
    borderLeftColor: "#d32f2f",
  },

  message: {
    fontSize: 15,
    color: "#212121",
    marginBottom: 10,
    lineHeight: 20,
  },

  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  type: {
    fontSize: 13,
    fontWeight: "700",
  },

  time: {
    fontSize: 12,
    color: "#666",
  },

  empty: {
    textAlign: "center",
    marginTop: 50,
    color: "#777",
    fontSize: 14,
  },
});
