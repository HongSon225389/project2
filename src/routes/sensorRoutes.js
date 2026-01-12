const express = require("express");
const router = express.Router();
const sensorController = require("../controllers/sensorController");

// API lấy lịch sử
router.get("/history", sensorController.getHistory);

// API lấy hiện tại
router.get("/current", sensorController.getCurrentStatus);

module.exports = router;
