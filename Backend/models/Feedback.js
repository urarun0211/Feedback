const mongoose = require("mongoose");

const FeedbackSchema = new mongoose.Schema({
  message: { type: String, required: true },
  type: { type: String, enum: ["Feedback", "Complaint"], required: true },
  status: { type: String, enum: ["Pending", "Closed"], default: "Pending" },
  time: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Feedback", FeedbackSchema);
