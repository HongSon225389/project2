// Cấu hình API
const API_BASE = ""; // Hoặc đường dẫn server của bạn

// ===== CÁC BIẾN CHUNG =====
// Kiểm tra xem đang ở trang nào bằng cách check ID của element đặc trưng
const isDashboardPage = document.getElementById("soil-val") !== null;
const isChartPage = document.getElementById("sensorsChart") !== null;
const isHistoryPage = document.getElementById("sensor-table-body") !== null;

let myChart = null;
const maxDataPoints = 20;

// ==========================================================
// PHẦN 1: LOGIC CHUNG (GỬI LỆNH & LẤY DỮ LIỆU CƠ BẢN)
// ==========================================================

// Hàm gửi lệnh điều khiển (Chỉ dùng ở Dashboard nhưng khai báo chung để tránh lỗi)
window.sendCommand = async function (topic, message) {
  try {
    await fetch(`${API_BASE}/api/control`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic, message }),
    });
    console.log("Đã gửi lệnh:", topic, message);
  } catch (error) {
    console.error("Lỗi gửi lệnh:", error);
  }
};

// ==========================================================
// PHẦN 2: LOGIC TRANG DASHBOARD (INDEX.HTML)
// ==========================================================
if (isDashboardPage) {
  console.log("--- Đang chạy logic Dashboard ---");
  let isUserInteracting = false;
  let interactionTimeout = null;

  // Xử lý nút bấm chế độ
  window.setMode = function (mode) {
    window.sendCommand("iot/cmd/mode", mode);
    updateStatusUI(null, mode);
    tempPauseUpdates();
  };

  // Xử lý nút bấm bơm
  window.controlPump = function (action) {
    window.sendCommand("iot/cmd/pump", action);
    updateStatusUI(action === "ON" ? "ON" : "OFF", null);
    tempPauseUpdates();
  };

  function tempPauseUpdates() {
    isUserInteracting = true;
    if (interactionTimeout) clearTimeout(interactionTimeout);
    interactionTimeout = setTimeout(() => {
      isUserInteracting = false;
    }, 5000);
  }

  // Cập nhật giao diện nút bấm
  function updateStatusUI(pumpState, modeState) {
    if (modeState) {
      const isAuto = modeState === "AUTO";
      document
        .getElementById("btn-mode-auto")
        .classList.toggle("active", isAuto);
      document
        .getElementById("btn-mode-manual")
        .classList.toggle("active", !isAuto);
      document.getElementById("ui-auto").style.display = isAuto
        ? "block"
        : "none";
      document.getElementById("ui-manual").style.display = isAuto
        ? "none"
        : "block";
    }
    if (pumpState) {
      const isPumpOn = pumpState === "ON";
      const text = isPumpOn ? "ĐANG BƠM" : "ĐANG TẮT";
      const cls = isPumpOn ? "status-label on" : "status-label off";

      const lblAuto = document.getElementById("auto-pump-status");
      const lblManual = document.getElementById("manual-pump-status");
      if (lblAuto) {
        lblAuto.innerText = text;
        lblAuto.className = cls;
      }
      if (lblManual) {
        lblManual.innerText = "TRẠNG THÁI: " + (isPumpOn ? "BẬT" : "TẮT");
        lblManual.className = cls;
      }
    }
  }

  // Hàm cập nhật thẻ (Cards)
  window.updateDashboardCards = function (data) {
    if (data.soil != null)
      document.getElementById("soil-val").innerText = data.soil + "%";
    if (data.temp != null)
      document.getElementById("temp-val").innerText = data.temp + "°C";
    if (data.hum != null)
      document.getElementById("hum-val").innerText = data.hum + "%";

    if (!isUserInteracting) {
      updateStatusUI(data.pump, data.mode);
    }
  };
}

// ==========================================================
// PHẦN 3: LOGIC TRANG BIỂU ĐỒ (CHARTS.HTML)
// ==========================================================
if (isChartPage) {
  console.log("--- Đang chạy logic Biểu đồ ---");
  const ctx = document.getElementById("sensorsChart").getContext("2d");

  myChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        {
          label: "Độ ẩm đất (%)",
          borderColor: "#27ae60",
          backgroundColor: "rgba(39, 174, 96, 0.2)",
          data: [],
          yAxisID: "y-percent",
          tension: 0.4,
          fill: true,
        },
        {
          label: "Nhiệt độ (°C)",
          borderColor: "#e74c3c",
          backgroundColor: "transparent",
          data: [],
          yAxisID: "y-temp",
          tension: 0.4,
        },
        {
          label: "Độ ẩm KK (%)",
          borderColor: "#3498db",
          backgroundColor: "transparent",
          data: [],
          yAxisID: "y-percent",
          tension: 0.4,
        },
      ],
    },
    options: {
      responsive: true,
      scales: {
        "y-percent": { type: "linear", position: "left", min: 0, max: 100 },
        "y-temp": { type: "linear", position: "right", min: 0, max: 50 },
      },
    },
  });

  window.filterChart = function (type, btnElement) {
    const buttons = btnElement.parentElement.querySelectorAll(".btn-filter");
    buttons.forEach((btn) => btn.classList.remove("active"));
    btnElement.classList.add("active");

    myChart.setDatasetVisibility(0, type === "all" || type === "soil");
    myChart.setDatasetVisibility(1, type === "all" || type === "temp");
    myChart.setDatasetVisibility(2, type === "all" || type === "hum");
    myChart.update();
  };

  window.updateChartData = function (data) {
    if (data.soil != null && data.temp != null) {
      const now = new Date().toLocaleTimeString();
      myChart.data.labels.push(now);
      myChart.data.datasets[0].data.push(data.soil);
      myChart.data.datasets[1].data.push(data.temp);
      myChart.data.datasets[2].data.push(data.hum);

      if (myChart.data.labels.length > maxDataPoints) {
        myChart.data.labels.shift();
        myChart.data.datasets.forEach((d) => d.data.shift());
      }
      myChart.update();
    }
  };
}

// ==========================================================
// PHẦN 4: HÀM LOOP UPDATE DỮ LIỆU (CHẠY CHO CẢ DASHBOARD VÀ CHART)
// ==========================================================
if (isDashboardPage || isChartPage) {
  async function fetchDataLoop() {
    try {
      const res = await fetch(`${API_BASE}/api/sensors/current`);
      const data = await res.json();

      // Nếu đang ở trang Dashboard -> Cập nhật thẻ
      if (isDashboardPage) {
        window.updateDashboardCards(data);
      }
      // Nếu đang ở trang Biểu đồ -> Cập nhật Chart
      if (isChartPage) {
        window.updateChartData(data);
      }
    } catch (error) {
      console.error("Lỗi cập nhật dữ liệu:", error);
    }
  }

  // Chạy ngay và lặp lại mỗi 5 giây
  fetchDataLoop();
  setInterval(fetchDataLoop, 5000);
}

// ==========================================================
// PHẦN 5: LOGIC TRANG LỊCH SỬ (HISTORY.HTML)
// ==========================================================
if (isHistoryPage) {
  console.log("--- Đang chạy logic Lịch sử ---");
  let currentFilter = "all";

  async function fetchHistory() {
    try {
      const res = await fetch(`${API_BASE}/api/sensors/history`);
      const historyData = await res.json();
      renderHistoryTable(historyData);
    } catch (error) {
      console.error("Lỗi lấy lịch sử:", error);
    }
  }

  function renderHistoryTable(dataArray) {
    const tableBody = document.getElementById("sensor-table-body");
    tableBody.innerHTML = "";

    const sortedData = dataArray.sort(
      (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
    );

    sortedData.forEach((item) => {
      let label = "",
        value = "",
        type = "",
        badgeClass = "";

      if (item.topic.includes("soil") || item.topic === "iot/soil") {
        label = "Độ ẩm đất";
        value = item.soilMoisture + "%";
        type = "soil";
        badgeClass = "badge-soil";
      } else if (item.topic.includes("temp") || item.topic === "iot/temp") {
        label = "Nhiệt độ";
        value = item.temperature + "°C";
        type = "temp";
        badgeClass = "badge-temp";
      } else if (item.topic.includes("hum") || item.topic === "iot/hum") {
        label = "Độ ẩm KK";
        value = item.humidity + "%";
        type = "hum";
        badgeClass = "badge-hum";
      } else return;

      if (currentFilter === "all" || currentFilter === type) {
        const timeString = new Date(item.timestamp).toLocaleString("vi-VN");
        const row = `<tr>
                                <td><i class="far fa-clock" style="color:#aaa"></i> ${timeString}</td>
                                <td><span class="badge ${badgeClass}">${label}</span></td>
                                <td><b>${value}</b></td>
                            </tr>`;
        tableBody.innerHTML += row;
      }
    });
  }

  window.filterTable = function (type, btnElement) {
    const buttons = document.querySelectorAll(".btn-filter");
    buttons.forEach((btn) => btn.classList.remove("active"));
    btnElement.classList.add("active");
    currentFilter = type;
    fetchHistory();
  };

  fetchHistory();
  setInterval(fetchHistory, 5000);
}
