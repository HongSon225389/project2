const mongoose = require("mongoose");
require("dotenv").config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ MongoDB: Đã kết nối thành công!");
  } catch (error) {
    console.error("❌ MongoDB: Lỗi kết nối:", error.message);
    process.exit(1); // Dừng chương trình nếu không nối được DB
  }
};

module.exports = connectDB;
