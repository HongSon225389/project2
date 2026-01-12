const mongoose = require("mongoose");

const SensorSchema = new mongoose.Schema({
  topic: { type: String, required: true },
  // Các trường giá trị (tùy thuộc vào topic nào mà trường đó có dữ liệu)
  temperature: { type: Number },
  humidity: { type: Number },
  soilMoisture: { type: Number },
  pumpState: { type: String },
  mode: { type: String },
  timestamp: { type: Date, default: Date.now }, // Tự động lưu thời gian
});

module.exports = mongoose.model("SensorData", SensorSchema);
