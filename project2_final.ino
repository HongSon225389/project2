#include <ESP8266WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <DHT.h> 

// --- CẤU HÌNH WIFI & MQTT ---
const char* ssid = "MIGHTZZ";
const char* password = "tu1den10";
const char* mqtt_server = "dff8f7471d7745a6907092c74b9267e6.s1.eu.hivemq.cloud"; 
const int mqtt_port = 8883; 
const char* mqtt_user = "Project220251";
const char* mqtt_pass = "Project220251";

WiFiClientSecure espClient;
PubSubClient client(espClient);

// --- CẤU HÌNH CHÂN ---
#define SOIL_PIN A0
#define RELAY_PIN D1
#define DHTPIN D2     
#define DHTTYPE DHT22 

DHT dht(DHTPIN, DHTTYPE); 

// --- CẤU HÌNH NGƯỠNG BƠM ---
int DRY = 1023;     
int WET = 300;      
const int START = 20; 
const int STOP = 45;  

bool isAuto = true;      
bool active = false;       
bool manual = false;  
unsigned long lastPublish = 0;
const unsigned long publishInterval = 5000; 
String clientId;

void callback(char* topic, byte* payload, unsigned int length) {
  String message = "";
  for (int i = 0; i < length; i++) message += (char)payload[i];
  Serial.print("Nhan lenh: "); Serial.println(message); // Debug

  if (String(topic) == "iot/cmd/mode") {
    if (message == "AUTO") isAuto = true;
    else if (message == "MANUAL") { isAuto = false; manual = active; }
    client.publish("iot/mode", isAuto ? "AUTO" : "MANUAL");
  }
  if (String(topic) == "iot/cmd/pump" && !isAuto) {
    if (message == "ON") manual = true; else if (message == "OFF") manual = false;
  }
}

void setup_wifi() {
  delay(10);
  Serial.println();
  Serial.print("Dang ket noi WiFi: "); Serial.println(ssid);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }
  Serial.println("\nWiFi connected");
  Serial.print("IP address: "); Serial.println(WiFi.localIP());
}

void reconnect() {
  while (!client.connected()) {
    Serial.print("Dang ket noi MQTT...");
    // Thử kết nối
    if (client.connect(clientId.c_str(), mqtt_user, mqtt_pass)) {
      Serial.println("THANH CONG!");
      client.subscribe("iot/cmd/mode");
      client.subscribe("iot/cmd/pump");
    } else {
      Serial.print("THAT BAI, loi rc=");
      Serial.print(client.state());
      Serial.println(" (Thu lai sau 3s)");
      delay(3000);
    }
  }
}

int readSoilPercent() {
  int raw = analogRead(SOIL_PIN);  
  int pct = map(raw, DRY, WET, 0, 100); 
  return constrain(pct, 0, 100);
}

void setup() {
  Serial.begin(115200); 
  pinMode(RELAY_PIN, OUTPUT); digitalWrite(RELAY_PIN, LOW); 
  
  Serial.println("Khoi dong DHT...");
  dht.begin();
  
  clientId = "ESPSoil-" + String(ESP.getChipId(), HEX);
  setup_wifi();
  
  Serial.println("Cau hinh SSL & MQTT...");
  espClient.setInsecure();
  espClient.setBufferSizes(512, 512); // QUAN TRỌNG: Giảm bộ nhớ đệm để tránh treo

  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback);
  client.setBufferSize(512); // Tăng bộ đệm nhận tin nhắn MQTT một chút
  
  Serial.println("Setup xong. Vao Loop!");
}

void loop() {
  if (!client.connected()) reconnect();
  client.loop(); 

  unsigned long now = millis();
  int soilPct = readSoilPercent();
  
  if (isAuto) {
    if (soilPct < START) active = true; else if (soilPct > STOP) active = false;
  } else active = manual;
  
  digitalWrite(RELAY_PIN, active ? HIGH : LOW);

  if (now - lastPublish >= publishInterval) {
    lastPublish = now;
    float h = dht.readHumidity();
    float t = dht.readTemperature();
    if (isnan(h) || isnan(t)) { h = 0; t = 0; Serial.println("Loi doc DHT!"); }

    char buf[10];
    // In ra Serial để kiểm tra cảm biến có chạy không
    Serial.print("Soil: "); Serial.print(soilPct);
    Serial.print("% | Temp: "); Serial.print(t);
    Serial.print("C | Hum: "); Serial.print(h); Serial.println("%");

    sprintf(buf, "%d", soilPct); client.publish("iot/soil", buf);
    sprintf(buf, "%.1f", t); client.publish("iot/temp", buf);
    sprintf(buf, "%.1f", h); client.publish("iot/hum", buf);
    client.publish("iot/pump", active ? "ON" : "OFF");
    client.publish("iot/mode", isAuto ? "AUTO" : "MANUAL");
  }
}