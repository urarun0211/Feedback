const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const Feedback = require("./models/Feedback");

const app = express();

/* =========================
   MIDDLEWARE
========================= */
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
  })
);

app.use(express.json());

/* =========================
   MONGODB CONNECTION
========================= */
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => {
    console.error("❌ MongoDB Error:", err.message);
    process.exit(1);
  });

/* =========================
   ROUTES
========================= */

/* ROOT */
app.get("/", (req, res) => {
  res.status(200).send("Backend kaam kar raha hai ✅");
});

/* POST feedback */
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

    const feedback = new Feedback({
      message: message.trim(),
      type,
    });

    await feedback.save();

    res.status(201).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

/* GET feedback */
app.get("/feedback", async (req, res) => {
  try {
    const data = await Feedback.find().sort({ time: -1 });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Fetch failed" });
  }
});

/* =========================
   SERVER
========================= */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`🚀 Backend running on port ${PORT}`)
);
