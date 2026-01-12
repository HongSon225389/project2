const mqtt = require("mqtt");
const SensorData = require("../models/SensorData"); // Import Model vừa tạo
require("dotenv").config();

const options = {
  host: process.env.MQTT_HOST,
  port: process.env.MQTT_PORT,
  protocol: "mqtts",
  username: process.env.MQTT_USER,
  password: process.env.MQTT_PASS,
};

const client = mqtt.connect(options);

client.on("connect", () => {
  console.log("✅ MQTT Service: Đã kết nối HiveMQ");
  client.subscribe("iot/#");
});

client.on("message", async (topic, message) => {
  const payload = message.toString();
  // console.log(`📩 [${topic}]: ${payload}`); // Bỏ comment nếu muốn xem log

  try {
    // Tạo một object dữ liệu mới
    let dataToSave = { topic: topic };

    // Phân loại dữ liệu dựa trên Topic gửi đến
    switch (topic) {
      case "iot/temp":
        dataToSave.temperature = parseFloat(payload);
        break;
      case "iot/hum":
        dataToSave.humidity = parseFloat(payload);
        break;
      case "iot/soil":
        dataToSave.soilMoisture = parseInt(payload);
        break;
      case "iot/pump":
        dataToSave.pumpState = payload;
        break;
      case "iot/mode":
        dataToSave.mode = payload;
        break;
      default:
        // Nếu topic lạ thì không làm gì cả
        return;
    }

    // Lưu vào MongoDB
    const newData = new SensorData(dataToSave);
    await newData.save();

    console.log(`💾 Đã lưu vào DB: [${topic}] -> ${payload}`);
  } catch (err) {
    console.error("❌ Lỗi khi lưu DB:", err);
  }
});

module.exports = client;
