#include <ESP8266WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <DHT.h>

// --- CẤU HÌNH WIFI & MQTT ---
const char *ssid = "MIGHTZZ";
const char *password = "tu1den10";
const char *mqtt_server = "dff8f7471d7745a6907092c74b9267e6.s1.eu.hivemq.cloud";
const int mqtt_port = 8883;
const char *mqtt_user = "Project220251";
const char *mqtt_pass = "Project220251";

WiFiClientSecure espClient;
PubSubClient client(espClient);

// --- CẤU HÌNH CHÂN ---
#define SOIL_PIN A0
#define RELAY_PIN D1
#define DHTPIN D2
#define DHTTYPE DHT22

// RELAY_ON là HIGH (Bật), RELAY_OFF là LOW (Tắt)
#define RELAY_ON HIGH
#define RELAY_OFF LOW

DHT dht(DHTPIN, DHTTYPE);

// --- CẤU HÌNH NGƯỠNG BƠM ---
int DRY = 1023;
int WET = 300;
const int START = 30;
const int STOP = 35;

bool isAuto = true;
bool active = false;
bool manual = false;
unsigned long lastPublish = 0;
const unsigned long publishInterval = 5000;

// Biến cho non-blocking reconnect
unsigned long lastReconnectAttempt = 0;

String clientId;

void callback(char *topic, byte *payload, unsigned int length)
{
  String message = "";
  for (int i = 0; i < length; i++)
    message += (char)payload[i];
  Serial.print("Nhan lenh: ");
  Serial.println(message);

  if (String(topic) == "iot/cmd/mode")
  {
    if (message == "AUTO")
      isAuto = true;
    else if (message == "MANUAL")
    {
      isAuto = false;
      manual = active;
    }
  }
  if (String(topic) == "iot/cmd/pump" && !isAuto)
  {
    if (message == "ON")
      manual = true;
    else if (message == "OFF")
      manual = false;
  }
}

void setup_wifi()
{
  delay(10);
  Serial.print("Dang ket noi WiFi: ");
  Serial.println(ssid);
  WiFi.begin(ssid, password);

  // Chỉ chờ tối đa 20 lần (10s) rồi bỏ qua để vào loop chạy bơm
  int retries = 0;
  while (WiFi.status() != WL_CONNECTED && retries < 20)
  {
    delay(500);
    Serial.print(".");
    retries++;
  }
  if (WiFi.status() == WL_CONNECTED)
  {
    Serial.println("\nWiFi connected");
  }
  else
  {
    Serial.println("\nWiFi mat ket noi! Che do Offline.");
  }
}

// Hàm kết nối lại KHÔNG CHẶN (Non-blocking)
void reconnect()
{
  if (client.connected())
    return;

  unsigned long now = millis();
  if (now - lastReconnectAttempt > 5000)
  {
    lastReconnectAttempt = now;
    Serial.print("Dang thu ket noi MQTT...");
    if (client.connect(clientId.c_str(), mqtt_user, mqtt_pass))
    {
      Serial.println("THANH CONG!");
      client.subscribe("iot/cmd/mode");
      client.subscribe("iot/cmd/pump");
    }
    else
    {
      Serial.print("THAT BAI, rc=");
      Serial.print(client.state());
    }
  }
}

int readSoilPercent()
{
  long total = 0;
  for (int i = 0; i < 10; i++)
  {
    total += analogRead(SOIL_PIN);
    delay(10);
  }
  int avg = total / 10;
  int pct = map(avg, DRY, WET, 0, 100);
  return constrain(pct, 0, 100);
}

void setup()
{
  Serial.begin(115200);
  pinMode(RELAY_PIN, OUTPUT);

  // Khi khởi động, đảm bảo tắt bơm ngay lập tức
  digitalWrite(RELAY_PIN, RELAY_OFF);

  dht.begin();

  clientId = "ESPSoil-" + String(ESP.getChipId(), HEX);
  setup_wifi();

  espClient.setInsecure();
  espClient.setBufferSizes(512, 512);

  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback);
}

// Thêm 2 biến toàn cục để lưu giá trị cũ (đặt trên đầu file, dưới các biến khác)
float lastTemp = 0;
float lastHum = 0;

void loop()
{
  // 1. Logic mạng
  if (WiFi.status() == WL_CONNECTED)
  {
    if (!client.connected())
      reconnect();
    else
      client.loop();
  }

  // 2. Logic Bơm
  int soilPct = readSoilPercent();

  if (isAuto)
  {
    if (soilPct < START)
      active = true;
    else if (soilPct > STOP)
      active = false;
  }
  else
  {
    active = manual;
  }

  digitalWrite(RELAY_PIN, active ? RELAY_ON : RELAY_OFF);

  // 3. Gửi dữ liệu
  unsigned long now = millis();
  if (now - lastPublish >= publishInterval)
  {
    lastPublish = now;

    float h = dht.readHumidity();
    float t = dht.readTemperature();

    // --- KHẮC PHỤC LỖI MẤT DỮ LIỆU KHI BƠM CHẠY ---
    if (isnan(h) || isnan(t))
    {
      h = lastHum; // Lấy lại giá trị cũ
      t = lastTemp;
    }
    else
    {
      // Nếu đọc tốt, cập nhật giá trị mới
      lastHum = h;
      lastTemp = t;
    }

    // Chỉ gửi nếu dữ liệu hợp lệ (khác 0)
    if (lastHum != 0 && lastTemp != 0 && client.connected())
    {
      char buf[10];
      sprintf(buf, "%d", soilPct);
      client.publish("iot/soil", buf);
      sprintf(buf, "%.1f", t);
      client.publish("iot/temp", buf);
      sprintf(buf, "%.1f", h);
      client.publish("iot/hum", buf);
      client.publish("iot/pump", active ? "ON" : "OFF");
      client.publish("iot/mode", isAuto ? "AUTO" : "MANUAL");

      Serial.printf("Soil: %d%% | Temp: %.1fC | Pump: %s\n", soilPct, t, active ? "ON" : "OFF");
    }
  }
}