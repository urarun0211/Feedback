import React, { useState, useEffect } from "react";
import axios from "axios";
import { MessageSquare, AlertCircle, Mic, Send, CheckCircle, Info } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import logo from "./assets/logo.png";
import "./App.css";

const API_URL = "https://feedback-backend-fdux.onrender.com/feedback";

function App() {
  const [type, setType] = useState("Feedback");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null); // 'success' | 'error' | null

  // 🎤 Speech Recognition Setup
  const [isRecording, setIsRecording] = useState(false);
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = SpeechRecognition ? new SpeechRecognition() : null;

  if (recognition) {
    recognition.lang = "hi-IN";
    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setMessage((prev) => (prev ? `${prev} ${transcript}` : transcript));
      setIsRecording(false);
    };
    recognition.onerror = () => setIsRecording(false);
    recognition.onend = () => setIsRecording(false);
  }

  const startVoiceInput = () => {
    if (recognition) {
      if (isRecording) {
        recognition.stop();
        setIsRecording(false);
      } else {
        setIsRecording(true);
        recognition.start();
      }
    } else {
      alert("Voice input is not supported in this browser. / वॉइस इनपुट अभी उपलब्ध नहीं है।");
    }
  };

  const handleSubmit = async () => {
    if (!message.trim()) return;

    setLoading(true);
    setStatus(null);

    try {
      await axios.post(API_URL, {
        message: message.trim(),
        type: type,
      });
      setStatus("success");
      setMessage("");
      setTimeout(() => setStatus(null), 5000);
    } catch (error) {
      console.error(error);
      setStatus("error");
      setTimeout(() => setStatus(null), 5000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-wrapper">
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="container"
      >
        {/* LOGO & TITLE */}
        <div className="header">
        
          <motion.img 
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            src={logo} 
            alt="Sanghi Logo" 
            className="logo" 
          />
            <h5 className="text-center">SANGHI BROTHERS</h5>
          <h1 className="title">Feedback Portal</h1>
          <p className="subtitle">अपनी राय या शिकायत बताएं</p>
        </div>

        {/* TYPE SELECTOR */}
        <div className="selector-group">
          <TouchableOpacityChild 
            className={`select-btn feedback ${type === "Feedback" ? "active" : ""}`}
            onClick={() => setType("Feedback")}
          >
            <MessageSquare size={18} />
            <span>Feedback</span>
          </TouchableOpacityChild>
          <TouchableOpacityChild 
            className={`select-btn complaint ${type === "Complaint" ? "active" : ""}`}
            onClick={() => setType("Complaint")}
          >
            <AlertCircle size={18} />
            <span>Complaint</span>
          </TouchableOpacityChild>
        </div>

        {/* TEXTAREA */}
        <div className="input-group">
          <textarea
            placeholder="Type your message here...&#10;अपनी बात यहाँ लिखें..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="styled-textarea"
          />
        </div>

        {/* BUTTONS */}
        <div className="button-group">
          <button 
            className={`voice-btn ${isRecording ? "recording" : ""}`}
            onClick={startVoiceInput}
          >
            <Mic size={20} color={isRecording ? "#fff" : "#4a148c"} />
            <span>{isRecording ? "Listening..." : "बोलें"}</span>
          </button>
          
          <button 
            className="submit-btn" 
            onClick={handleSubmit}
            disabled={loading || !message.trim()}
          >
            {loading ? "Sending..." : "भेजें"}
            {!loading && <Send size={18} />}
          </button>
        </div>

        {/* MESSAGES */}
        <AnimatePresence>
          {status === "success" && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="status-banner success"
            >
              <CheckCircle size={20} />
              <p>Sent Successfully! / बात पहुँच गई है।</p>
            </motion.div>
          )}
          {status === "error" && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="status-banner error"
            >
              <AlertCircle size={20} />
              <p>Something went wrong. / दोबारा कोशिश करें।</p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="footer-hint">
          <Info size={14} />
          <span>Your identity is private / आपकी पहचान सुरक्षित है</span>
        </div>
      </motion.div>
    </div>
  );
}

// Simple Helper for Hover
const TouchableOpacityChild = ({ children, className, onClick }) => (
  <motion.button 
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
    className={className} 
    onClick={onClick}
  >
    {children}
  </motion.button>
);

export default App;
