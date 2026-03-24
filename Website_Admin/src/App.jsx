import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { io } from "socket.io-client";
import { 
  LayoutDashboard, 
  MessageSquare, 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  Trash2, 
  Menu, 
  X, 
  Search, 
  RefreshCw,
  Bell,
  ChevronRight,
  Filter
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import logo from "./assets/logo.png";
import "./App.css";

const API_URL = "https://feedback-backend-fdux.onrender.com";

function App() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [filter, setFilter] = useState("All"); // All, Feedback, Complaint
  const [statusFilter, setStatusFilter] = useState("All"); // All, Pending, Closed
  const [search, setSearch] = useState("");
  const [view, setView] = useState("Dashboard");

  // Socket setup
  useEffect(() => {
    const socket = io(API_URL);

    socket.on("newFeedback", (entry) => {
      setData((prev) => [entry, ...prev]);
      notify(`New ${entry.type}!`, entry.message);
    });

    socket.on("statusUpdated", (updated) => {
      setData((prev) => prev.map(item => item._id === updated._id ? { ...item, status: updated.status } : item));
    });

    fetchData();

    return () => socket.disconnect();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/feedback`);
      // Sort newest first
      const sorted = res.data.sort((a, b) => new Date(b.time) - new Date(a.time));
      setData(sorted);
    } catch (err) {
      console.error("Fetch error", err);
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === "Closed" ? "Pending" : "Closed";
    try {
      await axios.patch(`${API_URL}/feedback/${id}/status`, { status: newStatus });
      // Local update
      setData(prev => prev.map(item => item._id === id ? { ...item, status: newStatus } : item));
    } catch (err) {
      alert("Status update failed");
    }
  };

  const deleteItem = async (id) => {
    if (!window.confirm("Delete this entry?")) return;
    try {
      await axios.delete(`${API_URL}/feedback/${id}`);
      setData(prev => prev.filter(item => item._id !== id));
    } catch (err) {
      alert("Delete failed");
    }
  };

  const notify = (title, body) => {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body });
    }
  };

  // Filtering
  const filteredData = data.filter(item => {
    const typeOk = filter === "All" || item.type === filter;
    const statusOk = statusFilter === "All" || item.status === statusFilter;
    const searchOk = !search || item.message.toLowerCase().includes(search.toLowerCase());
    return typeOk && statusOk && searchOk;
  });

  // Stats
  const total = data.length;
  const complaints = data.filter(i => i.type === "Complaint").length;
  const pending = data.filter(i => i.status === "Pending").length;
  const closed = data.filter(i => i.status === "Closed").length;

  return (
    <div className="admin-container">
      {/* SIDEBAR */}
      <motion.aside 
        initial={false}
        animate={{ width: sidebarOpen ? 260 : 80 }}
        className="sidebar"
      >
        <div className="logo-section">
          <img src={logo} alt="Sanghi Logo" className="sidebar-logo" />
          {sidebarOpen && <span className="logo-text">{`ADMIN PANEL`}</span>}
        </div>

        <nav className="nav-list">
          <NavItem active={view === "Dashboard"} icon={<LayoutDashboard size={20} />} label="Dashboard" open={sidebarOpen} onClick={() => setView("Dashboard")} />
          <NavItem active={view === "Complaints"} icon={<AlertCircle size={20} />} label="Complaints" open={sidebarOpen} onClick={() => { setView("Complaints"); setFilter("Complaint"); }} />
          <NavItem active={view === "Feedback"} icon={<MessageSquare size={20} />} label="Feedback" open={sidebarOpen} onClick={() => { setView("Feedback"); setFilter("Feedback"); }} />
        </nav>

        <button className="sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
          {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </motion.aside>

      {/* MAIN CONTENT */}
      <main className="main-content">
        <header className="top-header">
          <div className="header-left">
            <h1 className="page-title">{view}</h1>
            <p className="page-date">{new Date().toLocaleDateString("en-IN", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
          
          <div className="header-actions">
            <div className="search-bar">
              <Search size={18} className="search-icon" />
              <input type="text" placeholder="Search entries..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <button className="refresh-btn" onClick={fetchData}>
              <RefreshCw size={18} />
            </button>
          </div>
        </header>

        {/* STATS GRID */}
        <section className="stats-grid">
          <StatCard label="Total Entries" value={total} color="purple-theme" icon={<Bell style={{ color: "white" }} />} />
          <StatCard label="Pending" value={pending} color="orange-theme" icon={<Clock style={{ color: "white" }} />} />
          <StatCard label="Closed" value={closed} color="green-theme" icon={<CheckCircle style={{ color: "white" }} />} />
          <StatCard label="Complaints" value={complaints} color="red-theme" icon={<AlertCircle style={{ color: "white" }} />} />
        </section>

        {/* TABLE SECTION */}
        <div className="table-card">
          <div className="table-header">
            <div className="filter-chips">
              <button className={`chip ${filter === "All" ? "active" : ""}`} onClick={() => setFilter("All")}>All</button>
              <button className={`chip ${filter === "Complaint" ? "active" : ""}`} onClick={() => setFilter("Complaint")}>Complaints</button>
              <button className={`chip ${filter === "Feedback" ? "active" : ""}`} onClick={() => setFilter("Feedback")}>Feedback</button>
              <div className="v-divider" />
              <button className={`chip status-btn ${statusFilter === "Pending" ? "active" : ""}`} onClick={() => setStatusFilter(statusFilter === "Pending" ? "All" : "Pending")}>Pending</button>
              <button className={`chip status-btn ${statusFilter === "Closed" ? "active" : ""}`} onClick={() => setStatusFilter(statusFilter === "Closed" ? "All" : "Closed")}>Closed</button>
            </div>
          </div>

          <div className="table-wrap">
            <table className="styled-table">
              <thead>
                <tr>
                  <th>Message</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Time</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {filteredData.map((item) => (
                    <motion.tr 
                      key={item._id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      layout
                    >
                      <td className="entry-msg">
                        <div className={`msg-text ${item.status === "Closed" ? "resolved" : ""}`}>{item.message}</div>
                      </td>
                      <td>
                        <span className={`badge ${item.type.toLowerCase()}`}>
                          {item.type === "Complaint" ? "🚨 " : "💬 "}{item.type}
                        </span>
                      </td>
                      <td>
                        <button 
                          className={`status-chip ${item.status.toLowerCase()}`}
                          onClick={() => toggleStatus(item._id, item.status)}
                        >
                          {item.status === "Closed" ? "Resolved" : "Pending"}
                        </button>
                      </td>
                      <td className="time-cell">{new Date(item.time).toLocaleString([], { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}</td>
                      <td>
                        <div className="row-actions">
                          <button onClick={() => deleteItem(item._id)} className="delete-row"><Trash2 size={16} /></button>
                          <ChevronRight size={16} style={{ color: "#cbd5e1" }} />
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
            {filteredData.length === 0 && (
              <div className="no-data">No results found for this selection.</div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

// Subcomponents
const NavItem = ({ active, icon, label, open, onClick }) => (
  <button className={`nav-item ${active ? "active" : ""}`} onClick={onClick}>
    <div className="nav-icon">{icon}</div>
    {open && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{label}</motion.span>}
  </button>
);

const StatCard = ({ label, value, color, icon }) => (
  <motion.div whileHover={{ y: -5 }} className={`stat-card ${color}`}>
    <div className="stat-info">
      <p className="s-label">{label}</p>
      <h3 className="s-value">{value}</h3>
    </div>
    <div className="stat-icon-box">{icon}</div>
  </motion.div>
);

export default App;
