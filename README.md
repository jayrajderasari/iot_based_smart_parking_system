# IoT-Based Smart Parking System

A comprehensive IoT-based smart parking management system with real-time slot monitoring, automated gate control, booking system, and advanced analytics.

## 🚀 Features

### Core Features
- **Real-time Slot Monitoring**: Live occupancy detection using IR sensors
- **Automated Gate Control**: Servo-controlled entrance/exit gates with auto-close timers
- **Smart Booking System**: Pre-book parking slots with time windows
- **User Authentication**: Secure login for consumers and administrators
- **Payment Processing**: Automated billing based on parking duration
- **Analytics Dashboard**: Revenue tracking, peak hours analysis, and slot utilization reports

### Advanced Features
- **Modern UI/UX**: Material Design with purple gradient theme and glassmorphism effects
- **Real-time Notifications**: Toast notifications for all user actions
- **Access Control**: QR code-based/booking-based gate access with 5-minute grace period
- **Drive-up Support**: Walk-in customers can access parking if slots are available
- **Emergency Override**: Admin can manually control gates
- **Auto-close Gates**: Gates automatically close after 10 seconds (15 seconds for emergency)
- **Lot Status Monitoring**: Full/Available status with LED indicators
- **Export Functionality**: CSV export of booking data with date filtering
- **Statistics Cards**: Real-time metrics on dashboard

## 🏗️ System Architecture

```
┌─────────────────┐
│   Frontend      │  React (Material Design)
│   Port: 3001    │  → User Interface
└────────┬────────┘
         │
         ↓ HTTP/REST
┌─────────────────┐
│   Backend       │  Node.js + Express
│   Port: 3000    │  → Business Logic & API
└────────┬────────┘
         │
         ├→ SQLite Database (Bookings, Users, Payments, Logs)
         │
         ↓ HTTP Polling
┌─────────────────┐
│   NodeMCU       │  ESP8266 WiFi Bridge
│   (WiFi)        │  → Hardware Communication
└────────┬────────┘
         │
         ↓ Serial (9600 baud)
┌─────────────────┐
│   Arduino Mega  │  Hardware Controller
│                 │  → Sensors & Actuators
└────────┬────────┘
         │
         ├→ IR Sensors (3 slots)
         ├→ Ultrasonic Sensors (Entry/Exit detection)
         ├→ Servo Motors (Gate control)
         └→ LEDs (Status indicators)
```

## 📋 Hardware Components

### Arduino Mega 2560
- **Sensors**:
  - 3x IR Sensors (Slot occupancy detection - Pins 30, 31, 32)
  - 2x Ultrasonic Sensors (Vehicle detection at entry/exit - Pins 22-25)
- **Actuators**:
  - 2x Servo Motors (Gate control - Pins 33, 34)
  - 5x LEDs (Status indicators - Pins 40-44)

### NodeMCU ESP8266
- WiFi bridge between backend and Arduino Mega
- Serial communication with Mega (9600 baud)
- Polls backend every 1 second for gate commands
- Sends sensor data every 2 seconds

## 🛠️ Installation & Setup

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn
- Arduino IDE (for firmware upload)
- Git

### Backend Setup
```bash
cd backend
npm install
node index.js
```
Backend will run on `http://localhost:3000`

### Frontend Setup
```bash
cd frontend
npm install
npm start
```
Frontend will run on `http://localhost:3001`

### Hardware Setup

#### 1. Arduino Mega Configuration
- Open `firmware/mega/mega_sketch/mega_sketch.ino` in Arduino IDE
- Connect Arduino Mega via USB
- Select correct board and port
- Upload the sketch

#### 2. NodeMCU Configuration
- Open `firmware/nodemcu/nodemcu.ino` in Arduino IDE
- **Important**: Update WiFi credentials and backend IP:
  ```cpp
  const char *WIFI_SSID = "Your_WiFi_SSID";
  const char *WIFI_PASS = "Your_WiFi_Password";
  const char *BACKEND_BASE = "http://YOUR_BACKEND_IP:3000/api";
  ```
- Connect NodeMCU via USB
- Select board: "NodeMCU 1.0 (ESP-12E Module)"
- Upload the sketch

#### 3. Hardware Connections
Connect NodeMCU TX → Mega RX1 (Pin 19)
Connect NodeMCU RX → Mega TX1 (Pin 18)
Connect GND of both boards together

## 📱 Usage

### Default Login Credentials

**Admin Account**:
- Username: `admin`
- Password: `admin123`

**Consumer Account**:
- Username: `user1`
- Password: `user123`

### Booking a Slot
1. Login with consumer credentials
2. View available slots on the dashboard
3. Click "Book Now" on a free slot
4. Enter vehicle number, phone number, and select duration
5. Confirm booking
6. Access parking using "Access Parking" button during grace period

### Access Control
- **Booked Users**: Click "Access Parking" within 5 minutes of booking start time
- **Drive-up Customers**: Gate opens automatically when vehicle detected (if slots available)
- **Emergency Access**: Admin can manually open gates for 15 seconds

### Gate Behavior
- **Auto-close**: Gates automatically close after 10 seconds
- **Emergency**: Admin override keeps gate open for 15 seconds
- **Timer-based**: Mega firmware maintains 10-second open duration
- **Status Polling**: NodeMCU checks gate status every 1 second

## 🗂️ Project Structure

```
smart-parking/
├── backend/
│   ├── database.js          # SQLite database setup
│   ├── index.js             # Main Express server
│   ├── package.json         # Backend dependencies
│   └── db.json              # (Optional) backup data
├── frontend/
│   ├── public/              # Static files
│   ├── src/
│   │   ├── App.js          # Main React application
│   │   ├── App.css         # Styles
│   │   └── index.js        # Entry point
│   └── package.json         # Frontend dependencies
├── firmware/
│   ├── mega/
│   │   └── mega_sketch/
│   │       └── mega_sketch.ino  # Arduino Mega code
│   └── nodemcu/
│       └── nodemcu.ino      # ESP8266 NodeMCU code
├── DEPLOYMENT_GUIDE.md      # Deployment instructions
├── ENHANCED_FEATURES.md     # Feature documentation
├── IMPLEMENTATION_COMPLETE.md
├── TESTING_RESULTS.md       # Test reports
└── README.md                # This file
```

## 🔧 API Endpoints

### Authentication
- `POST /api/auth` - User login

### Slots
- `GET /api/slots` - Get all parking slots
- `POST /api/slots/updateStatus` - Admin: Update slot status

### Bookings
- `GET /api/bookings` - Get all bookings
- `POST /api/book` - Create new booking
- `POST /api/cancel` - Cancel booking
- `GET /api/users/:userId/booking-history` - User's booking history

### Access Control
- `POST /api/requestAccess` - Request gate access (booked users)
- `POST /api/driveUpRequest` - Drive-up customer access
- `GET /api/gate/status` - Get current gate status (polled by hardware)
- `POST /api/gate/emergency-open` - Admin emergency override
- `POST /api/gate/test` - Test gate control (debugging)

### Analytics
- `GET /api/analytics/revenue` - Daily revenue reports
- `GET /api/analytics/peak-hours` - Hourly booking patterns
- `GET /api/analytics/users/:userId/stats` - User statistics
- `GET /api/analytics/slot-utilization` - Per-slot performance
- `GET /api/analytics/occupancy` - Real-time occupancy trends

### System
- `GET /api/health` - System health check
- `GET /api/export/bookings` - Export bookings as CSV
- `POST /api/updateSlots` - IoT sensor updates (from hardware)

### Payments
- `POST /api/payments/pay` - Process payment

## 💡 Key Improvements

### Gate Control System
- **Timer-based Auto-close**: Both backend and firmware implement 10-second timers
- **State Tracking**: NodeMCU tracks previous gate states to detect changes
- **Immediate Response**: Gates open within 1 second of command
- **Force Close**: CLOSE_ENTRANCE command for immediate gate closure
- **Dual Control**: Backend timer + Firmware timer for reliability

### Enhanced Logging
- Emoji-based console logging for easy debugging
- Gate state changes logged with timestamps
- Vehicle number tracking in all operations
- Periodic status polling logs (10% sampling to reduce spam)

## 🎨 UI/UX Features

- **Purple Gradient Theme**: Modern gradient (#667eea → #764ba2)
- **Glassmorphism Effects**: Translucent cards with backdrop blur
- **Responsive Design**: Mobile-friendly layout
- **Real-time Updates**: Live slot status and notifications
- **Statistics Cards**: 4 real-time metrics on dashboard
- **Enhanced Tables**: Sortable, filterable booking history
- **Cost Estimator**: Live pricing calculation in booking modal
- **Search & Filter**: Quick access to booking records

## 🔐 Security Features

- Password-based authentication
- Role-based access control (Admin/Consumer)
- Booking validation with grace periods
- Auto-cancellation of expired bookings
- System health monitoring

## 📊 Database Schema

### Tables
- **users**: User accounts and authentication
- **slots**: Parking slot information
- **bookings**: Reservation records
- **payments**: Transaction history
- **system_logs**: Activity logging

## 🐛 Troubleshooting

### Gate Not Opening/Closing
1. Check backend console for gate status logs
2. Verify NodeMCU is connected to WiFi and polling backend
3. Check Mega serial monitor for OPEN_ENTRANCE/CLOSE_ENTRANCE commands
4. Use `/api/gate/test` endpoint to manually test gates

### Network Connectivity
1. Ensure backend is running on correct IP address
2. Update `BACKEND_BASE` in `nodemcu.ino` with your network IP
3. Check firewall settings allow port 3000

### Sensor Issues
1. Verify IR sensor wiring (pins 30, 31, 32)
2. Check serial output from Mega for sensor readings
3. Review `sendStatusToNodeMCU()` function output

## 📝 License

This project is open source and available for educational purposes.

## 👨‍💻 Author

Jayraj Derasari

## 🙏 Acknowledgments

Built with modern IoT practices and industry-standard features for smart parking management.
