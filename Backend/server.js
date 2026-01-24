const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
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

/* ---------------- MIDDLEWARE ---------------- */
app.use(cors());
app.use(express.json());

/* ---------------- MONGODB ---------------- */
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.log("❌ MongoDB Error:", err.message));

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

// Save feedback
app.post("/feedback", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: "Message required" });
    }

    const lower = message.toLowerCase();
    const type =
      lower.includes("problem") ||
        lower.includes("issue") ||
        lower.includes("complaint")
        ? "Complaint"
        : "Feedback";

    const entry = new Feedback({ message, type });
    await entry.save();

    // Broadcast new feedback to all connected clients
    io.emit("newFeedback", entry);

    res.status(201).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Admin fetch
app.get("/feedback", async (req, res) => {
  try {
    const data = await Feedback.find().sort({ time: -1 });
    res.json(data);
  } catch {
    res.status(500).json({ error: "Fetch failed" });
  }
});

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

