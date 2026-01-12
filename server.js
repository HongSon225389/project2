require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const connectDB = require("./src/config/db");
// Import MQTT Client (Giữ nguyên file service của bạn)
const mqttClient = require("./src/services/mqttService");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// [QUAN TRỌNG] Cấu hình thư mục Frontend
app.use(express.static(path.join(__dirname, "src/public")));

// Kết nối DB
connectDB();

// Routes
app.use("/api/sensors", require("./src/routes/sensorRoutes"));

// API Điều khiển (Gửi lệnh xuống MQTT)
app.post("/api/control", (req, res) => {
  const { topic, message } = req.body;
  if (!topic || !message) {
    return res.status(400).json({ error: "Thiếu topic hoặc message" });
  }

  // Gửi lệnh qua MQTT
  mqttClient.publish(topic, message, (err) => {
    if (err) return res.status(500).json({ error: "Lỗi gửi MQTT" });
    console.log(`📤 Web gửi lệnh: [${topic}] -> ${message}`);
    res.json({ success: true });
  });
});

// Route trang chủ
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "src/public/index.html"));
});
//Route trang lịch sử
app.get("/history", (req, res) => {
  res.sendFile(path.join(__dirname, "src/public/history.html"));
});
app.listen(PORT, () => {
  console.log(`Server chạy tại: ${PORT}`);
});
