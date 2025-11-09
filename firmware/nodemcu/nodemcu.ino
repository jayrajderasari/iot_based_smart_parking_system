// nodemcu.ino
#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClient.h>

const char *WIFI_SSID = "Hello World";
const char *WIFI_PASS = "Anupam@123";
const char *BACKEND_BASE = "http://192.168.0.7:3000/api"; // IMPORTANT: Change to your backend's IP address

String serialBuffer = "";
unsigned long lastStatusPost = 0;
unsigned long lastGateCheck = 0;
const long statusInterval = 2000;    // Post physical status every 2 seconds
const long gateCheckInterval = 1000; // Check for gate commands every 1 second

// Track previous gate states to detect changes
String prevEntranceState = "closed";
String prevExitState = "closed";

void setup()
{
    Serial.begin(9600); // To/From Mega and for Monitor
    delay(100);
    Serial.println("NodeMCU starting...");

    // Connect to WiFi
    Serial.print("Connecting to ");
    Serial.println(WIFI_SSID);
    WiFi.begin(WIFI_SSID, WIFI_PASS);

    int wifi_retries = 0;
    while (WiFi.status() != WL_CONNECTED && wifi_retries < 20)
    {
        delay(500);
        Serial.print(".");
        wifi_retries++;
    }
    if (WiFi.status() == WL_CONNECTED)
    {
        Serial.println("\nWiFi connected!");
        Serial.print("IP address: ");
        Serial.println(WiFi.localIP());
    }
    else
    {
        Serial.println("\nWiFi connection FAILED");
    }

    serialBuffer.reserve(64);
}

void loop()
{
    unsigned long currentMillis = millis();

    // 1. Read from Mega and process if a full line is received
    while (Serial.available() > 0)
    {
        char c = (char)Serial.read();
        if (c == '\n')
        {
            if (serialBuffer.length() > 0)
            {
                // Post status immediately on receiving data from Mega
                if (currentMillis - lastStatusPost >= statusInterval)
                {
                    postSlotStatus(serialBuffer);
                    lastStatusPost = currentMillis;
                }
            }
            serialBuffer = "";
        }
        else
        {
            serialBuffer += c;
        }
    }

    // 2. Periodically check for gate commands from the backend
    if (currentMillis - lastGateCheck >= gateCheckInterval)
    {
        checkGateStatus();
        lastGateCheck = currentMillis;
    }
}

void postSlotStatus(String line)
{
    line.trim();
    Serial.print("Received from Mega: ");
    Serial.println(line);

    // Expected format: S1:0,S2:1,S3:1
    int s1 = line.substring(line.indexOf("S1:") + 3, line.indexOf(",")).toInt();
    int s2 = line.substring(line.indexOf("S2:") + 3, line.lastIndexOf(",")).toInt();
    int s3 = line.substring(line.indexOf("S3:") + 3).toInt();

    String payload = "{\"S1\":" + String(s1) + ",\"S2\":" + String(s2) + ",\"S3\":" + String(s3) + "}";
    Serial.print("Posting to /updateSlots: ");
    Serial.println(payload);

    if (WiFi.status() == WL_CONNECTED)
    {
        WiFiClient client;
        HTTPClient http;
        String url = String(BACKEND_BASE) + "/updateSlots";

        http.begin(client, url);
        http.addHeader("Content-Type", "application/json");
        int httpCode = http.POST(payload);
        Serial.print("POST /updateSlots, response code: ");
        Serial.println(httpCode);
        http.end();
    }
    else
    {
        Serial.println("WiFi not connected, cannot post status.");
    }
}

void checkGateStatus()
{
    if (WiFi.status() == WL_CONNECTED)
    {
        WiFiClient client;
        HTTPClient http;
        String url = String(BACKEND_BASE) + "/gate/status";

        http.begin(client, url);
        int httpCode = http.GET();

        if (httpCode == 200)
        {
            String payload = http.getString();
            Serial.print("GET /gate/status, response: ");
            Serial.println(payload);

            // Extract entrance gate state
            String currentEntranceState = "closed";
            if (payload.indexOf("\"entrance\":\"open\"") > -1)
            {
                currentEntranceState = "open";
            }

            // Check if entrance gate state changed
            if (currentEntranceState != prevEntranceState)
            {
                if (currentEntranceState == "open")
                {
                    Serial.println("==> Command: OPEN_ENTRANCE");
                    Serial.println("OPEN_ENTRANCE"); // Send command to Mega
                }
                else
                {
                    Serial.println("==> Command: CLOSE_ENTRANCE");
                    Serial.println("CLOSE_ENTRANCE"); // Send command to Mega
                }
                prevEntranceState = currentEntranceState;
            }

            // Check lot status for LED indicator
            if (payload.indexOf("\"lotStatus\":\"full\"") > -1)
            {
                Serial.println("==> Lot Status: FULL");
                Serial.println("LOT_FULL"); // Send to Mega to turn on RED LED
            }
            else if (payload.indexOf("\"lotStatus\":\"available\"") > -1)
            {
                Serial.println("==> Lot Status: AVAILABLE");
                Serial.println("LOT_AVAILABLE"); // Send to Mega to turn on GREEN LED
            }
        }
        else
        {
            Serial.print("GET /gate/status, error code: ");
            Serial.println(httpCode);
        }
        http.end();
    }
    else
    {
        Serial.println("WiFi not connected, cannot check gate status.");
    }
}
