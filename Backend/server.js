const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const Feedback = require("./models/Feedback");

const app = express();

/* MIDDLEWARE */
app.use(
  cors({
    origin: "*",   // allow all origins (safe for public feedback)
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);
app.options("*", cors());
app.use(express.json());

/* MONGODB CONNECT */
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.log("❌ MongoDB Error:", err.message));

/* ROOT TEST */
app.get("/", (req, res) => {
  res.send("Backend kaam kar raha hai ✅");
});

/* -----------------------------
   POST: Save feedback/complaint
------------------------------ */
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

    const entry = new Feedback({
      message,
      type,
    });

    await entry.save();

    res.status(201).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

/* -----------------------------
   GET: Admin fetch all feedback
------------------------------ */
app.get("/feedback", async (req, res) => {
  try {
    const data = await Feedback.find().sort({ time: -1 });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Fetch failed" });
  }
});

/* SERVER */
const PORT = process.env.PORT;
app.listen(PORT, () =>
  console.log(`🚀 Backend running on port ${PORT}`)
);
