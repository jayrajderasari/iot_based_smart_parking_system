// mega_sketch.ino
#include <Servo.h>

// ----- Pin Definitions -----
#define TRIG_IN 22
#define ECHO_IN 23
#define TRIG_OUT 24
#define ECHO_OUT 25
#define SLOT1 30
#define SLOT2 31
#define SLOT3 32
#define SERVO_ENTRANCE 33
#define SERVO_EXIT 34
#define LED_GREEN_ENT 40
#define LED_YELLOW_ENT 41
#define LED_RED_ENT 42
#define LED_GREEN_EXIT 43
#define LED_RED_EXIT 44

// ----- Constants -----
#define DIST_THRESHOLD 10.0 // cm for car detection
#define OPEN_ANGLE 0
#define CLOSED_ANGLE 80
#define SERVO_DELAY 15
#define ULTRASONIC_DELAY 100

Servo gateEntrance;
Servo gateExit;

// --- State variables ---
bool physicalCarAtEntrance = false;
bool physicalCarAtExit = false;
bool remoteGateOpenCommand = false; // New: command from NodeMCU
unsigned long gateOpenTime = 0;     // Timestamp when gate was opened remotely
const unsigned long GATE_OPEN_DURATION = 10000; // Keep gate open for 10 seconds
bool lotIsFull = false;             // New: lot full status from backend

// --- Function Prototypes ---
float getDistance(int trigPin, int echoPin);
bool isSlotFree(int pin);
void moveServoSmooth(Servo &motor, int toAngle);
void handleSerialCommands();
void sendStatusToNodeMCU();

void setup()
{
    Serial.begin(9600);  // PC debug
    Serial1.begin(9600); // NodeMCU connection

    pinMode(TRIG_IN, OUTPUT);
    pinMode(ECHO_IN, INPUT);
    pinMode(TRIG_OUT, OUTPUT);
    pinMode(ECHO_OUT, INPUT);
    pinMode(SLOT1, INPUT);
    pinMode(SLOT2, INPUT);
    pinMode(SLOT3, INPUT);
    pinMode(LED_GREEN_ENT, OUTPUT);
    pinMode(LED_YELLOW_ENT, OUTPUT);
    pinMode(LED_RED_ENT, OUTPUT);
    pinMode(LED_GREEN_EXIT, OUTPUT);
    pinMode(LED_RED_EXIT, OUTPUT);

    gateEntrance.attach(SERVO_ENTRANCE);
    gateExit.attach(SERVO_EXIT);
    gateEntrance.write(CLOSED_ANGLE);
    gateExit.write(CLOSED_ANGLE);

    digitalWrite(LED_YELLOW_ENT, HIGH);
    digitalWrite(LED_RED_EXIT, HIGH);

    Serial.println("Mega Smart Parking Ready");
    Serial1.println("MEGA_READY");
}

void loop()
{
    // 1. Check for commands from NodeMCU (e.g., "OPEN_ENTRANCE")
    handleSerialCommands();

    // 2. Read all sensors
    float distIn = getDistance(TRIG_IN, ECHO_IN);
    physicalCarAtEntrance = (distIn > 0 && distIn < DIST_THRESHOLD);

    float distOut = getDistance(TRIG_OUT, ECHO_OUT);
    physicalCarAtExit = (distOut > 0 && distOut < DIST_THRESHOLD);

    bool s1_free = isSlotFree(SLOT1);
    bool s2_free = isSlotFree(SLOT2);
    bool s3_free = isSlotFree(SLOT3);
    int freeSlots = s1_free + s2_free + s3_free;

    // 3. Control gates based on logic
    // Entrance Gate Logic: 
    // Priority 1: Remote command (booked user) - open for 10 seconds
    // Priority 2: Physical car detected AND slots available AND lot not full
    
    bool shouldOpenEntrance = false;
    
    // Check if remote command timer is still active
    if (remoteGateOpenCommand && (millis() - gateOpenTime < GATE_OPEN_DURATION))
    {
        shouldOpenEntrance = true;
    }
    else if (remoteGateOpenCommand)
    {
        // Timer expired, reset the command
        remoteGateOpenCommand = false;
        Serial.println("Remote gate command expired, closing gate");
    }
    
    // Physical car detection (drive-up customers)
    if (!shouldOpenEntrance && physicalCarAtEntrance && freeSlots > 0 && !lotIsFull)
    {
        shouldOpenEntrance = true;
    }
    
    // Apply entrance gate control
    if (shouldOpenEntrance)
    {
        moveServoSmooth(gateEntrance, OPEN_ANGLE);
        digitalWrite(LED_GREEN_ENT, HIGH);
        digitalWrite(LED_YELLOW_ENT, LOW);
        digitalWrite(LED_RED_ENT, LOW);
    }
    else
    {
        moveServoSmooth(gateEntrance, CLOSED_ANGLE);
        digitalWrite(LED_GREEN_ENT, LOW);
        digitalWrite(LED_YELLOW_ENT, HIGH);
        digitalWrite(LED_RED_ENT, lotIsFull ? HIGH : LOW);
    }

    // Exit Gate Logic: Open if a car is at the exit
    if (physicalCarAtExit)
    {
        moveServoSmooth(gateExit, OPEN_ANGLE);
        digitalWrite(LED_GREEN_EXIT, HIGH);
        digitalWrite(LED_RED_EXIT, LOW);
    }
    else
    {
        moveServoSmooth(gateExit, CLOSED_ANGLE);
        digitalWrite(LED_GREEN_EXIT, LOW);
        digitalWrite(LED_RED_EXIT, HIGH);
    }

    // 4. Send status to NodeMCU every loop
    sendStatusToNodeMCU();

    delay(500); // Main loop delay
}

void handleSerialCommands()
{
    if (Serial1.available())
    {
        String cmd = Serial1.readStringUntil('\n');
        cmd.trim();
        if (cmd == "OPEN_ENTRANCE")
        {
            remoteGateOpenCommand = true;
            gateOpenTime = millis(); // Record the time when gate was opened
            Serial.println("Received OPEN_ENTRANCE command - Gate will open for 10 seconds");
        }
        else if (cmd == "CLOSE_ENTRANCE")
        {
            remoteGateOpenCommand = false;
            Serial.println("Received CLOSE_ENTRANCE command - Forcing gate close");
        }
        else if (cmd == "LOT_FULL")
        {
            lotIsFull = true;
            Serial.println("Received LOT_FULL status - Red LED ON");
        }
        else if (cmd == "LOT_AVAILABLE")
        {
            lotIsFull = false;
            Serial.println("Received LOT_AVAILABLE status - Green LED ON");
        }
    }
}

void sendStatusToNodeMCU()
{
    bool s1 = !isSlotFree(SLOT1); // 1 for occupied
    bool s2 = !isSlotFree(SLOT2);
    bool s3 = !isSlotFree(SLOT3);

    String statusString = "S1:" + String(s1) + ",S2:" + String(s2) + ",S3:" + String(s3);
    Serial1.println(statusString);
    Serial.print("Sent to NodeMCU: ");
    Serial.println(statusString);
}

float getDistance(int trigPin, int echoPin)
{
    digitalWrite(trigPin, LOW);
    delayMicroseconds(2);
    digitalWrite(trigPin, HIGH);
    delayMicroseconds(10);
    digitalWrite(trigPin, LOW);
    unsigned long duration = pulseIn(echoPin, HIGH, 25000);
    return (duration == 0) ? -1.0 : duration * 0.0343 / 2.0;
}

bool isSlotFree(int pin)
{
    return digitalRead(pin) == HIGH;
}

void moveServoSmooth(Servo &motor, int toAngle)
{
    int fromAngle = motor.read();
    if (fromAngle == toAngle)
        return; // Already at target

    int step = (toAngle > fromAngle) ? 1 : -1;
    for (int pos = fromAngle; pos != toAngle; pos += step)
    {
        motor.write(pos);
        delay(SERVO_DELAY);
    }
    motor.write(toAngle);
}
