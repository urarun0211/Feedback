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
    methods: ["GET", "POST", "DELETE"],
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

/* ---------------- ADMIN TOKEN MODEL ---------------- */
const tokenSchema = new mongoose.Schema({
  token: { type: String, required: true, unique: true },
});

const AdminToken = mongoose.model("AdminToken", tokenSchema);

/* ---------------- SOCKET.IO ---------------- */
io.on("connection", (socket) => {
  console.log("📡 Admin connected:", socket.id);
  socket.on("disconnect", () =>
    console.log("📡 Admin disconnected:", socket.id)
  );
});

/* ---------------- TEST ROUTE ---------------- */
app.get("/", (req, res) => {
  res.send("Backend kaam kar raha hai ✅");
});

/* =====================================================
   🔥 SMART AUTO DETECTION LOGIC (Complaint / Feedback)
===================================================== */
function detectType(message) {
  const lower = message.toLowerCase();

  const complaintKeywords = [
    "problem", "issue", "complaint", "error", "not working",
    "bad", "worst", "fail", "slow", "bug", "fix", "help",
    "poor", "kharab", "dikkat", "kaam nahi", "bekar",
    "shikayat", "ghatiya", "fraud", "late", "stop"
  ];

  const positiveKeywords = [
    "good", "great", "awesome", "nice", "excellent",
    "fast", "love", "best", "amazing", "perfect",
    "accha", "badiya", "mast", "shandar", "thank you"
  ];

  let complaintScore = 0;
  let positiveScore = 0;

  complaintKeywords.forEach(word => {
    if (lower.includes(word)) complaintScore++;
  });

  positiveKeywords.forEach(word => {
    if (lower.includes(word)) positiveScore++;
  });

  if (complaintScore > positiveScore) return "Complaint";
  return "Feedback";
}

/* ---------------- SAVE ADMIN TOKEN ---------------- */
app.post("/save-token", async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: "Token required" });
    }

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

/* ---------------- SAVE FEEDBACK ---------------- */
app.post("/feedback", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: "Message required" });
    }

    // 🔥 Auto detect type
    const type = detectType(message);

    const entry = new Feedback({
      message,
      type,
    });

    await entry.save();

    // Real-time emit
    io.emit("newFeedback", entry);

    /* -------- PUSH NOTIFICATION -------- */
    const tokens = await AdminToken.find();
    let messages = [];

    for (let admin of tokens) {
      if (!Expo.isExpoPushToken(admin.token)) {
        console.error("Invalid token:", admin.token);
        continue;
      }

      messages.push({
        to: admin.token,
        sound: "default",
        title: `📢 Naya ${type} Aaya Hai`,
        body: message,
        data: { id: entry._id },
        priority: "high",
      });
    }

    const chunks = expo.chunkPushNotifications(messages);

    for (let chunk of chunks) {
      try {
        await expo.sendPushNotificationsAsync(chunk);
      } catch (error) {
        console.error("Push Error:", error);
      }
    }

    res.status(201).json({
      success: true,
      type,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

/* ---------------- GET ALL FEEDBACK ---------------- */
app.get("/feedback", async (req, res) => {
  try {
    const data = await Feedback.find().sort({ createdAt: -1 });
    res.json(data);
  } catch {
    res.status(500).json({ error: "Fetch failed" });
  }
});

/* ---------------- DELETE FEEDBACK ---------------- */
app.delete("/feedback/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await Feedback.findByIdAndDelete(id);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Delete failed" });
  }
});

/* ---------------- SERVER START ---------------- */
const PORT = process.env.PORT || 5000;

server.listen(PORT, () =>
  console.log(`🚀 Server running on port ${PORT}`)
);