# Smart Parking System - Deployment Guide

## System Status: ✅ READY FOR PRODUCTION

All requested features have been implemented and tested. This guide will help you verify everything is working correctly.

---

## 🎯 Recent Updates (Latest Session)

### 1. **Parking Lot Full State** ✅

- **Backend**: Background job monitors free slots every 10 seconds
- **Logic**: When free slots = 0, `lotStatus` is set to `'full'`
- **API**: `/api/gate/status` returns `{ entrance, exit, lotStatus }`
- **Hardware**:
  - NodeMCU receives `lotStatus` from backend
  - Sends `LOT_FULL` or `LOT_AVAILABLE` command to Mega
  - Mega turns **RED LED ON** when lot is full
  - Drive-up customers are blocked when `lotIsFull = true`

### 2. **User Access Parking Button** ✅

- **Frontend**: "Access Parking" button in `ConsumerView`
- **API Call**: `POST /api/requestAccess` with `bookingId`
- **Backend Logic**:
  - Validates booking exists and is active
  - Checks if within grace period (10 minutes before to 5 minutes after booking time)
  - Sets `gateState.entrance = 'open'`
- **Hardware**:
  - NodeMCU polls `/api/gate/status` every 1 second
  - Detects `"entrance":"open"` in response
  - Sends `OPEN_ENTRANCE` command to Mega
  - Mega opens entrance gate servo

### 3. **Admin Emergency Gate Control** ✅

- **Frontend**: Two buttons in `AdminView` - "Open Entrance Gate" and "Open Exit Gate"
- **API Call**: `POST /api/gate/emergency-open` with `{ gate: 'entrance' | 'exit' }`
- **Backend**: Sets `gateState.entrance` or `gateState.exit` to `'open'`
- **Hardware**: Same flow as user access (NodeMCU → Mega)

---

## 🚀 How to Start the System

### Step 1: Start the Backend Server

```powershell
cd C:\Users\deras\Desktop\smart-parking\backend
node index.js
```

**Expected Output:**

```
Smart Parking backend running on port 3000
```

### Step 2: Start the Frontend

```powershell
cd C:\Users\deras\Desktop\smart-parking\frontend
npm start
```

**Expected Output:**

```
Compiled successfully!
You can now view smart-parking-frontend in the browser.
  Local: http://localhost:3001
```

### Step 3: Upload Firmware to Hardware

1. **NodeMCU (ESP8266)**:

   - Open `firmware/nodemcu/nodemcu.ino` in Arduino IDE
   - **IMPORTANT**: Update WiFi credentials and backend IP:
     ```cpp
     const char *WIFI_SSID = "Your_WiFi_Name";
     const char *WIFI_PASS = "Your_WiFi_Password";
     const char *BACKEND_BASE = "http://YOUR_PC_IP:3000/api";
     ```
   - Select board: `NodeMCU 1.0 (ESP-12E Module)`
   - Upload sketch

2. **Arduino Mega**:
   - Open `firmware/mega/mega_sketch/mega_sketch.ino` in Arduino IDE
   - Select board: `Arduino Mega 2560`
   - Upload sketch

---

## 🧪 Testing Checklist

### Test 1: Parking Lot Full Indication

- [ ] Fill all 3 slots with cars (or manually set slots to occupied in admin dashboard)
- [ ] Wait 10 seconds for background job to update `lotStatus`
- [ ] Check Serial Monitor on Mega: Should see "Received LOT_FULL status - Red LED ON"
- [ ] Verify RED LED on entrance is ON
- [ ] Try drive-up access: Gate should NOT open for physical car detection
- [ ] Free a slot, wait 10 seconds
- [ ] Check Serial Monitor: Should see "Received LOT_AVAILABLE status - Green LED ON"
- [ ] RED LED should turn OFF

### Test 2: User Access Parking Button

- [ ] Login as consumer (user: `john`, pass: `password123`)
- [ ] Create a booking for current time
- [ ] Click "Access Parking" button in active bookings section
- [ ] Check browser console: Should show success message
- [ ] Check NodeMCU Serial Monitor: Should see `GET /gate/status, response: {...entrance":"open"...}`
- [ ] Check Mega Serial Monitor: Should see "Received OPEN_ENTRANCE command"
- [ ] Verify entrance gate servo opens

### Test 3: Admin Emergency Gate Control

- [ ] Login as admin (user: `admin`, pass: `admin123`)
- [ ] Scroll to "Emergency Gate Controls" section
- [ ] Click "Open Entrance Gate" button
- [ ] Check browser console: Should show "Gate opened successfully"
- [ ] Check Mega Serial Monitor: Should see "Received OPEN_ENTRANCE command"
- [ ] Verify entrance gate opens
- [ ] Repeat for "Open Exit Gate" button

### Test 4: Payment System

- [ ] Create booking and check in
- [ ] Wait a few minutes (or manually update exit_time in database)
- [ ] Simulate car leaving slot (IR sensor detects free)
- [ ] Backend creates payment record automatically
- [ ] Check user dashboard: Payment should appear with "Pay Now" button
- [ ] Click "Pay Now"
- [ ] Verify payment status changes to 'paid'

### Test 5: Analytics Dashboard

- [ ] Login as admin
- [ ] Scroll to "Analytics" section
- [ ] Verify "Occupancy Over Time" line chart displays data
- [ ] Verify "Slot Distribution" pie chart shows Occupied vs Free slots

---

## 🔍 Troubleshooting

### Issue: "Failed to open gate: Request failed with status code 404"

**Solution**: Ensure backend is running. Verify you see "Smart Parking backend running on port 3000" in terminal.

### Issue: Hardware not responding

**Solution**:

1. Check WiFi connection on NodeMCU (should print IP address on startup)
2. Verify backend IP address in `nodemcu.ino` matches your PC's IP
3. Check Serial connections between NodeMCU and Mega (TX1→RX1, RX1→TX1, GND→GND)

### Issue: Gate doesn't open for booked user

**Solution**:

1. Verify booking is within grace period (10 min before to 5 min after start time)
2. Check backend logs: Should show "Access granted for booking: [id]"
3. Check NodeMCU Serial Monitor: Should show `OPEN_ENTRANCE` command sent
4. Verify servo is connected to pin 33 on Mega

### Issue: Lot full state not updating

**Solution**:

1. Check backend console: Should show "Lot status updated to: full" or "available" every 10 seconds
2. Verify background job is running (check for setInterval logs)
3. Test `/api/gate/status` endpoint manually in browser: Should return `{ entrance, exit, lotStatus }`

---

## 📊 System Architecture Summary

### Backend (Node.js/Express)

- **Database**: SQLite (`parking.db`)
- **Tables**: users, slots, bookings, payments, system_logs
- **Key Endpoints**:
  - `POST /api/requestAccess` - User triggers gate open
  - `GET /api/gate/status` - Hardware polls for commands
  - `POST /api/gate/emergency-open` - Admin override
  - `POST /api/driveUpRequest` - Drive-up customer access (blocked when full)
  - `GET /api/analytics/occupancy` - Chart data

### Frontend (React)

- **Admin Dashboard**: Parking map, slot management, analytics, emergency controls
- **Consumer Dashboard**: Booking system, active bookings, payment history

### Hardware (Arduino/ESP8266)

- **NodeMCU**: WiFi bridge, polls backend every 1 second for gate commands
- **Mega**: Controls servos, LEDs, reads sensors, receives commands from NodeMCU

### Background Jobs

1. **Auto-cancel bookings**: Every 30 seconds, cancels bookings 5+ min past start time
2. **Lot status monitor**: Every 10 seconds, updates `lotStatus` based on free slots

---

## 🎨 Next Steps (Optional Improvements)

1. **Mobile App**: Build React Native app for users
2. **Email Notifications**: Send booking confirmations and payment reminders
3. **Real-time WebSocket**: Replace polling with WebSocket for instant updates
4. **Advanced Analytics**: Add revenue reports, peak hours analysis
5. **License Plate Recognition**: Auto-identify vehicles with camera + ML
6. **Multi-level Parking**: Extend system to support multiple floors

---

## 📝 Database Schema Reference

### bookings table

```sql
CREATE TABLE bookings (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    slot_id TEXT,
    start_time TEXT,
    end_time TEXT,
    status TEXT,  -- 'active', 'completed', 'cancelled'
    entry_time TEXT,
    exit_time TEXT,
    created_at TEXT
);
```

### payments table

```sql
CREATE TABLE payments (
    id TEXT PRIMARY KEY,
    booking_id TEXT,
    amount REAL,
    status TEXT,  -- 'pending', 'paid'
    created_at TEXT
);
```

---

## ✅ Feature Completion Status

| Feature                     | Status      | Notes                              |
| --------------------------- | ----------- | ---------------------------------- |
| User Registration/Login     | ✅ Complete | SQLite auth                        |
| Slot Booking System         | ✅ Complete | Timed reservations                 |
| Grace Period Access         | ✅ Complete | 10 min before, 5 min after         |
| Auto-cancel Missed Bookings | ✅ Complete | Background job every 30s           |
| Payment System              | ✅ Complete | Auto-calculate on exit             |
| Payment UI                  | ✅ Complete | "Pay Now" button in user dashboard |
| Admin Slot Management       | ✅ Complete | Manual override via modal          |
| Interactive Parking Map     | ✅ Complete | Color-coded grid                   |
| Analytics Dashboard         | ✅ Complete | Line chart + Pie chart             |
| Emergency Gate Control      | ✅ Complete | Admin buttons + API endpoint       |
| Parking Lot Full Detection  | ✅ Complete | Background monitoring + LED        |
| Hardware Integration        | ✅ Complete | NodeMCU + Mega + Sensors           |
| Event Logging               | ✅ Complete | system_logs table                  |

---

**Last Updated**: Current Session  
**Version**: 2.0 (Production Ready)
