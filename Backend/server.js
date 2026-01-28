const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const { Expo } = require("expo-server-sdk"); 
require("dotenv").config();

const Feedback = require("./models/Feedback");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const expo = new Expo(); 

/* ---------------- MIDDLEWARE ---------------- */
app.use(cors());
app.use(express.json());

/* ---------------- MONGODB ---------------- */
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.log("❌ MongoDB Error:", err.message));

// Admin Token Schema (Push Notification ke liye)
const tokenSchema = new mongoose.Schema({
  token: { type: String, required: true, unique: true },
});
const AdminToken = mongoose.model("AdminToken", tokenSchema);

/* ---------------- SOCKET.IO ---------------- */
io.on("connection", (socket) => {
  console.log("📡 Admin connected:", socket.id);
  socket.on("disconnect", () => console.log("📡 Admin disconnected"));
});

/* ---------------- ROUTES ---------------- */

// Test route
app.get("/", (req, res) => {
  res.send("Backend kaam kar raha hai ✅");
});

// 1. Admin Token Save Karein (Notification ke liye)
app.post("/save-token", async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: "Token required" });

    const exists = await AdminToken.findOne({ token });
    if (!exists) {
      await AdminToken.create({ token });
      console.log("🎟️ New Admin Token Saved");
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Token save error" });
  }
});

// 2. Feedback Save & Notify (User isse hit karega)
app.post("/feedback", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: "Message required" });
    }

    const lower = message.toLowerCase();

    // Categorization Logic
    const complaintKeywords = [
      "problem", "issue", "complaint", "error", "not working", "bad", "worst", 
      "fail", "slow", "bug", "fix", "help", "poor", "kharab", "dikkat", 
      "kaam nahi kar raha", "bekar", "shikayat", "ghatiya", "fraud", "stop"
    ];

    const isComplaint = complaintKeywords.some((word) => lower.includes(word));
    const type = isComplaint ? "Complaint" : "Feedback";

    // Save to Database
    const entry = new Feedback({ message, type });
    await entry.save();

    // Socket Emit (Real-time in App)
    io.emit("newFeedback", entry);

    // --- PUSH NOTIFICATION LOGIC ---
    const tokens = await AdminToken.find();
    let messages = [];

    for (let admin of tokens) {
      if (!Expo.isExpoPushToken(admin.token)) {
        console.error(`Invalid token: ${admin.token}`);
        continue;
      }

      messages.push({
        to: admin.token,
        sound: "default",
        title: `Naya ${type} Aaya Hai! 📢`,
        body: message,
        data: { feedbackId: entry._id },
        priority: "high",
      });
    }

    // Expo ko chunks mein messages bhejna (Best Practice)
    let chunks = expo.chunkPushNotifications(messages);
    for (let chunk of chunks) {
      try {
        await expo.sendPushNotificationsAsync(chunk);
      } catch (error) {
        console.error("Push Notification Error:", error);
      }
    }

    res.status(201).json({ success: true, type });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// 3. Admin Fetch (Sari list lane ke liye)
app.get("/feedback", async (req, res) => {
  try {
    const data = await Feedback.find().sort({ time: -1 });
    res.json(data);
  } catch {
    res.status(500).json({ error: "Fetch failed" });
  }
});

// 4. Delete Feedback
app.delete("/feedback/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await Feedback.findByIdAndDelete(id);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Delete failed" });
  }
});

/* ---------------- SERVER ---------------- */
const PORT = process.env.PORT || 5000;
server.listen(PORT, () =>
  console.log(`🚀 Server running on port ${PORT}`)
);
