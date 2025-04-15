#include <WiFi.h>
#include <HTTPClient.h>
#include <Wire.h>
#include "MAX30105.h"               // MAX30102 Sensor
#include "spo2_algorithm.h"         // SpO2 Algorithm for MAX30102
#include "Adafruit_MLX90614.h"      // MLX90614 Sensor
#include <Adafruit_BMP085.h>        // BMP180 Sensor

// WiFi credentials
const char* ssid = "Rajeshwar";
const char* password = "123456789";

// MATLAB API (ThingSpeak) details
const char* server = "http://api.thingspeak.com/update";
const char* apiKey = "QM1LGLBB8JRMNZDJ";

// Sensor objects
MAX30105 particleSensor;
Adafruit_MLX90614 mlx = Adafruit_MLX90614();
Adafruit_BMP085 bmp;

// Variables for SpO2 and Heart Rate
#define BUFFER_SIZE 100
uint32_t irBuffer[BUFFER_SIZE];
uint32_t redBuffer[BUFFER_SIZE];
int32_t spo2;
int8_t validSPO2;
int32_t heartRate;
int8_t validHeartRate;

void setup() {
    Serial.begin(115200);
    Wire.begin(21, 22); // ESP32 I2C pins: SDA=21, SCL=22

    // Connect to WiFi
    WiFi.begin(ssid, password);
    Serial.print("Connecting to WiFi");
    while (WiFi.status() != WL_CONNECTED) {
        delay(1000);
        Serial.print(".");
    }
    Serial.println("\nConnected to WiFi!");

    // Initialize MAX30102
    if (!particleSensor.begin(Wire, I2C_SPEED_STANDARD)) {
        Serial.println("MAX30102 not found!");
        while (1);
    }
    particleSensor.setup();
    particleSensor.setPulseAmplitudeRed(0x0A);
    particleSensor.setPulseAmplitudeIR(0x0A);

    // Initialize MLX90614
    if (!mlx.begin()) {
        Serial.println("MLX90614 not found!");
        while (1);
    }

    // Initialize BMP180
    if (!bmp.begin()) {
        Serial.println("BMP180 not found!");
        while (1);
    }

    Serial.println("All sensors initialized successfully!");
}

void loop() {
    // Read Heart Rate & SpO2
    for (int i = 0; i < BUFFER_SIZE; i++) {
        while (!particleSensor.check()); // Wait for new data
        redBuffer[i] = particleSensor.getRed();
        irBuffer[i] = particleSensor.getIR();
    }

    // Calculate Heart Rate & SpO2
    maxim_heart_rate_and_oxygen_saturation(irBuffer, BUFFER_SIZE, redBuffer, &spo2, &validSPO2, &heartRate, &validHeartRate);

    float ambientTemp = mlx.readAmbientTempC();
    float objectTemp = mlx.readObjectTempC();
    float pressure = bmp.readPressure() / 100.0;

    Serial.print("Heart Rate: ");
    Serial.print(validHeartRate ? heartRate : -1);
    Serial.print(" | SpO2: ");
    Serial.print(validSPO2 ? spo2 : -1);
    Serial.print("% | Ambient Temp: ");
    Serial.print(ambientTemp);
    Serial.print("°C | Object Temp: ");
    Serial.print(objectTemp);
    Serial.print("°C | Pressure: ");
    Serial.print(pressure);
    Serial.println(" hPa");

    // Send data to MATLAB API (ThingSpeak)
    if (WiFi.status() == WL_CONNECTED) {
        HTTPClient http;
        String url = String(server) + "?api_key=" + apiKey + "&field1=" + heartRate + "&field2=" + spo2 + "&field3=" + ambientTemp + "&field4=" + objectTemp + "&field5=" + pressure;

        http.begin(url);
        int httpResponseCode = http.GET();
        if (httpResponseCode > 0) {
            Serial.print("Data sent to MATLAB API. Response code: ");
            Serial.println(httpResponseCode);
        } else {
            Serial.print("Error in HTTP request: ");
            Serial.println(httpResponseCode);
        }
        http.end();
    } else {
        Serial.println("WiFi Disconnected!");
    }

    delay(5000);  // Wait before the next reading
}