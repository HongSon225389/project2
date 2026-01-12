const SensorData = require("../models/SensorData");

// 1. LẤY LỊCH SỬ (50 dòng mới nhất)
exports.getHistory = async (req, res) => {
  try {
    const data = await SensorData.find()
      .sort({ timestamp: -1 }) // Mới nhất lên đầu
      .limit(50);
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 2. LẤY TRẠNG THÁI HIỆN TẠI (Cho Card & Mode)
exports.getCurrentStatus = async (req, res) => {
  try {
    // Tìm bản ghi mới nhất của từng Topic song song
    const [temp, hum, soil, pump, mode] = await Promise.all([
      SensorData.findOne({ topic: "iot/temp" }).sort({ timestamp: -1 }),
      SensorData.findOne({ topic: "iot/hum" }).sort({ timestamp: -1 }),
      SensorData.findOne({ topic: "iot/soil" }).sort({ timestamp: -1 }),
      SensorData.findOne({ topic: "iot/pump" }).sort({ timestamp: -1 }),
      SensorData.findOne({ topic: "iot/mode" }).sort({ timestamp: -1 }),
    ]);

    res.json({
      temp: temp ? temp.temperature : 0,
      hum: hum ? hum.humidity : 0,
      soil: soil ? soil.soilMoisture : 0,
      pump: pump ? pump.pumpState : "OFF",
      mode: mode ? mode.mode : "MANUAL",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
