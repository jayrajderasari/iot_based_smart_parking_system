// index.js -- REST API for Smart Parking (SQLite)
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const db = require('./database'); // Import the new database module

const app = express();
app.use(cors());
app.use(bodyParser.json());

// --- In-memory state for gate commands ---
let gateState = { entrance: 'closed', exit: 'closed' };
let gateTimers = { entrance: null, exit: null }; // Auto-close timers
let lotStatus = 'available'; // 'available' or 'full'

// Helper function to open gate with auto-close
const openGate = (gate, duration = 10000) => {
    const wasOpen = gateState[gate] === 'open';
    gateState[gate] = 'open';
    
    console.log(`🚪 ${gate.toUpperCase()} gate: ${wasOpen ? 'ALREADY OPEN' : 'OPENING'} (will auto-close in ${duration}ms)`);
    
    // Clear existing timer if any
    if (gateTimers[gate]) {
        clearTimeout(gateTimers[gate]);
        console.log(`⏱️  Cleared existing ${gate} gate timer`);
    }
    
    // Set auto-close timer (10 seconds default)
    gateTimers[gate] = setTimeout(() => {
        gateState[gate] = 'closed';
        gateTimers[gate] = null;
        console.log(`🚪 ${gate.toUpperCase()} gate: AUTO-CLOSED after ${duration}ms`);
    }, duration);
};

// ---------- Helpers ----------
const nowISO = () => new Date().toISOString();

const logEvent = (level, event, details = '') => {
    const detailsString = typeof details === 'object' ? JSON.stringify(details) : details;
    db.run("INSERT INTO system_logs (level, event, details, timestamp) VALUES (?, ?, ?, ?)", 
           [level, event, detailsString, nowISO()]);
};

const PARKING_RATE_PER_HOUR = 4; // $4 per hour
const calculateCost = (startTime, endTime) => {
    if (!startTime || !endTime) return 2.00; // Default minimum if times are invalid
    const start = new Date(startTime);
    const end = new Date(endTime);
    const durationMs = end - start;
    if (durationMs <= 0) return 2.00; // Minimum charge
    const durationHours = durationMs / (1000 * 60 * 60);
    const cost = durationHours * PARKING_RATE_PER_HOUR;
    return Math.max(cost, 2.00).toFixed(2); // Minimum charge $2, formatted to 2 decimal places
};

// ---------- Auth ----------
app.post('/api/auth', (req, res) => {
  const { username, password } = req.body;
  db.get("SELECT * FROM users WHERE username = ? AND password = ?", [username, password], (err, user) => {
    if (err) {
        logEvent('ERROR', 'AUTH_FAILURE', { username, error: err.message });
        return res.status(500).json({ error: err.message });
    }
    if (!user) {
        logEvent('WARN', 'AUTH_FAILURE', { username, reason: 'Invalid credentials' });
        return res.status(401).json({ error: 'Invalid credentials' });
    }
    logEvent('INFO', 'AUTH_SUCCESS', { userId: user.id, username: user.username });
    res.json({ id: user.id, username: user.username, role: user.role });
  });
});

// ---------- Slots ----------
app.get('/api/slots', (req, res) => {
  db.all("SELECT * FROM slots ORDER BY id", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// ---------- Bookings ----------
app.get('/api/bookings', (req, res) => {
    db.all("SELECT * FROM bookings ORDER BY start_time DESC", [], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
});

app.get('/api/users/:userId/booking-history', (req, res) => {
    const { userId } = req.params;
    const sql = `
        SELECT b.*, p.id as payment_id, p.amount, p.status as payment_status 
        FROM bookings b 
        LEFT JOIN payments p ON b.id = p.booking_id 
        WHERE b.user_id = ? 
        ORDER BY b.start_time DESC`;
    db.all(sql, [userId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/book', (req, res) => {
    const { userId, slotId, startTime, duration, vehicleNumber, phoneNumber } = req.body;
    if (!startTime || !duration) {
        return res.status(400).json({ error: 'Start time and duration are required.' });
    }

    const endTime = new Date(new Date(startTime).getTime() + duration * 60000).toISOString();
    const bookingId = uuidv4();

    const checkSql = `SELECT id FROM bookings WHERE slot_id = ? AND status = 'active' AND 
                      ( (start_time < ? AND end_time > ?) OR (start_time >= ? AND start_time < ?) )`;
    db.get(checkSql, [slotId, endTime, startTime, startTime, endTime], (err, existing) => {
        if (err) return res.status(500).json({ error: err.message });
        if (existing) return res.status(400).json({ error: 'Slot is already booked for this period' });

        db.serialize(() => {
            const bookingSql = `INSERT INTO bookings (id, user_id, slot_id, start_time, end_time, status, vehicle_number, phone_number, created_at) 
                                VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?)`;
            db.run(bookingSql, [bookingId, userId, slotId, startTime, endTime, vehicleNumber || null, phoneNumber || null, nowISO()]);

            const slotSql = "UPDATE slots SET status = 'booked' WHERE id = ?";
            db.run(slotSql, [slotId], (err) => {
                if (err) {
                    logEvent('ERROR', 'BOOKING_FAILURE', { userId, slotId, error: err.message });
                    return res.status(500).json({ error: err.message });
                }
                logEvent('INFO', 'BOOKING_SUCCESS', { bookingId, userId, slotId, vehicleNumber });
                res.status(201).json({ id: bookingId, status: 'booked' });
            });
        });
    });
});

app.post('/api/cancel', (req, res) => {
    const { bookingId } = req.body;
    db.get("SELECT * FROM bookings WHERE id = ?", [bookingId], (err, booking) => {
        if (err || !booking) return res.status(404).json({ok: false, error: 'Booking not found'});
        
        db.serialize(() => {
            const bookingSql = "UPDATE bookings SET status = 'cancelled' WHERE id = ?";
            db.run(bookingSql, [bookingId]);

            const slotSql = "UPDATE slots SET status = 'free' WHERE id = ?";
            db.run(slotSql, [booking.slot_id], (err) => {
                if (err) return res.status(500).json({ error: err.message });
                logEvent('INFO', 'BOOKING_CANCELLED', { bookingId, userId: booking.user_id, slotId: booking.slot_id });
                res.json({ ok: true });
            });
        });
    });
});

// ---------- Access Control ----------
app.post('/api/requestAccess', (req, res) => {
    const { bookingId } = req.body;
    db.get("SELECT * FROM bookings WHERE id = ?", [bookingId], (err, booking) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!booking) return res.status(404).json({ error: 'Booking not found.' });

        const now = new Date();
        const startTime = new Date(booking.start_time);
        const gracePeriodStart = new Date(startTime.getTime() - 5 * 60000);
        const gracePeriodEnd = new Date(startTime.getTime() + 5 * 60000);

        if (now < gracePeriodStart) return res.status(403).json({ error: `Too early. Access available from ${gracePeriodStart.toLocaleTimeString()}` });
        if (now > gracePeriodEnd) return res.status(403).json({ error: `Access window closed at ${gracePeriodEnd.toLocaleTimeString()}` });

        // Open entrance gate for 10 seconds
        openGate('entrance', 10000);
        
        db.run("UPDATE bookings SET status = 'entered', entry_time = ? WHERE id = ?", [nowISO(), bookingId]);
        logEvent('INFO', 'ACCESS_GRANTED', { bookingId, userId: booking.user_id, vehicleNumber: booking.vehicle_number });
        
        console.log(`✅ Gate opened for booking ${bookingId} - Vehicle: ${booking.vehicle_number || 'N/A'}`);
        
        res.json({ 
            ok: true, 
            message: '🚪 Gate opening! Welcome to parking!',
            gateOpenDuration: 10,
            slot: booking.slot_id
        });
    });
});

app.post('/api/driveUpRequest', (req, res) => {
    db.get("SELECT COUNT(*) as count FROM slots WHERE status = 'free'", [], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (row.count > 0) {
            openGate('entrance', 10000);
            logEvent('INFO', 'DRIVE_UP_ACCESS', { result: 'Gate opened for drive-up customer' });
            console.log('🚗 Gate opened for drive-up customer');
            res.json({ ok: true, gateOpened: true, message: 'Gate opening! Welcome!' });
        } else {
            logEvent('WARN', 'DRIVE_UP_REJECTED', { result: 'No free slots - Parking lot full' });
            res.json({ ok: false, gateOpened: false, message: 'Parking lot is full' });
        }
    });
});

app.get('/api/gate/status', (req, res) => {
    // Return current gate state and lot status for hardware
    const status = { ...gateState, lotStatus };
    // Log periodically (every 10th request to avoid spam)
    if (Math.random() < 0.1) {
        console.log('📡 Gate status polled:', JSON.stringify(status));
    }
    res.json(status);
    // Note: Gate will auto-close after timer expires (10 seconds)
});

app.post('/api/gate/emergency-open', (req, res) => {
    const { gate } = req.body; // 'entrance' or 'exit'
    // TODO: Add admin role check
    if (gate === 'entrance' || gate === 'exit') {
        openGate(gate, 15000); // Keep open for 15 seconds for emergency access
        logEvent('WARN', 'EMERGENCY_GATE_OPEN', { gate, admin: 'admin' });
        console.log(`🚨 EMERGENCY: ${gate} gate opened by admin`);
        res.json({ ok: true, message: `${gate} gate opened for 15 seconds.` });
    } else {
        res.status(400).json({ error: 'Invalid gate specified.' });
    }
});

// Test endpoint to manually trigger gate (for debugging)
app.post('/api/gate/test', (req, res) => {
    const { gate, duration } = req.body;
    if (gate === 'entrance' || gate === 'exit') {
        const openDuration = duration || 10000;
        openGate(gate, openDuration);
        console.log(`🧪 TEST: ${gate} gate opened for ${openDuration}ms`);
        res.json({ 
            ok: true, 
            message: `${gate} gate opened for testing (${openDuration}ms)`,
            currentState: gateState
        });
    } else {
        res.status(400).json({ error: 'Invalid gate. Use "entrance" or "exit".' });
    }
});

// ---------- Analytics ----------
app.get('/api/analytics/occupancy', (req, res) => {
    // Get current snapshot of slot occupancy
    db.get("SELECT COUNT(*) as total, SUM(CASE WHEN status = 'occupied' THEN 1 ELSE 0 END) as occupied FROM slots", [], (err, current) => {
        if (err) return res.status(500).json({ error: err.message });
        
        // Fetch recent system logs to build historical occupancy trend
        db.all(`SELECT timestamp, event, details FROM system_logs 
                WHERE event IN ('SLOT_STATUS_CHANGE', 'VEHICLE_ENTRY', 'VEHICLE_EXIT') 
                ORDER BY timestamp DESC LIMIT 100`, [], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            
            // Build time-series data
            const timePoints = new Map();
            let runningOccupied = current.occupied || 0;
            
            // Add current time point first
            const now = new Date();
            const currentTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
            timePoints.set(currentTime, runningOccupied);
            
            // Process historical logs in reverse chronological order
            rows.forEach(log => {
                try {
                    const logTime = new Date(log.timestamp);
                    const timeKey = logTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                    
                    if (log.event === 'SLOT_STATUS_CHANGE') {
                        const details = JSON.parse(log.details);
                        // Going back in time, so reverse the change
                        if (details.new === 'occupied' && details.old === 'free') {
                            runningOccupied--;
                        } else if (details.new === 'free' && details.old === 'occupied') {
                            runningOccupied++;
                        }
                    }
                    
                    if (!timePoints.has(timeKey)) {
                        timePoints.set(timeKey, Math.max(0, runningOccupied));
                    }
                } catch (e) {
                    // Skip invalid log entries
                }
            });
            
            // Convert to array and sort by time
            const result = Array.from(timePoints.entries())
                .map(([time, occupied]) => ({ time, occupied }))
                .reverse()
                .slice(-20); // Keep last 20 time points
            
            res.json(result);
        });
    });
});

// ---------- IoT Sensor Updates ----------
app.post('/api/updateSlots', (req, res) => {
    const data = req.body; // e.g., { "S1": 1, "S2": 0, "S3": 0 }
    db.serialize(() => {
        for (const slotId in data) {
            const isOccupied = data[slotId] === 1;
            
            db.get("SELECT status FROM slots WHERE id = ?", [slotId], (err, slot) => {
                if (slot) {
                    let newStatus = slot.status;
                    if (isOccupied && (slot.status === 'booked' || slot.status === 'free')) {
                        newStatus = 'occupied';
                    } else if (!isOccupied && slot.status === 'occupied') {
                        handleVehicleExit(slotId);
                        newStatus = 'free';
                    }

                    if (newStatus !== slot.status) {
                        db.run("UPDATE slots SET status = ?, last_sensor_update = ? WHERE id = ?", [newStatus, nowISO(), slotId]);
                        logEvent('INFO', 'SLOT_STATUS_CHANGE', { slotId, old: slot.status, new: newStatus, cause: 'sensor' });
                    }
                }
            });
        }
        res.json({ ok: true });
    });
});

const handleVehicleExit = (slotId) => {
    const findBookingSql = `SELECT * FROM bookings WHERE slot_id = ? AND status = 'entered' ORDER BY start_time DESC LIMIT 1`;
    db.get(findBookingSql, [slotId], (err, booking) => {
        if (err || !booking) {
            logEvent('WARN', 'EXIT_NO_BOOKING', { slotId, details: 'A vehicle left a slot without a corresponding "entered" booking.' });
            return;
        }

        const exitTime = nowISO();
        const cost = calculateCost(booking.entry_time, exitTime);
        const paymentId = uuidv4();

        db.serialize(() => {
            db.run("UPDATE bookings SET status = 'completed', exit_time = ? WHERE id = ?", [exitTime, booking.id]);
            const paymentSql = `INSERT INTO payments (id, booking_id, user_id, amount, status, created_at) VALUES (?, ?, ?, ?, 'pending', ?)`;
            db.run(paymentSql, [paymentId, booking.id, booking.user_id, cost, nowISO()]);
            logEvent('INFO', 'VEHICLE_EXIT', { slotId, bookingId: booking.id, userId: booking.user_id, cost });
        });
    });
};

// ---------- Admin Manual Override ----------
app.post('/api/slots/updateStatus', (req, res) => {
    const { slotId, status } = req.body;
    if (!slotId || !status) {
        return res.status(400).json({ error: 'Slot ID and new status are required.' });
    }

    if (status === 'free') {
        db.serialize(() => {
            const bookingSql = "UPDATE bookings SET status = 'cancelled' WHERE slot_id = ? AND (status = 'active' OR status = 'entered')";
            db.run(bookingSql, [slotId]);

            const slotSql = "UPDATE slots SET status = 'free' WHERE id = ?";
            db.run(slotSql, [slotId], function(err) {
                if (err) return res.status(500).json({ error: err.message });
                logEvent('WARN', 'ADMIN_OVERRIDE', { slotId, newStatus: status, details: 'Active booking may have been cancelled.' });
                res.json({ ok: true, message: `Slot ${slotId} is now free and any active booking was cancelled.` });
            });
        });
    } else {
        const sql = "UPDATE slots SET status = ? WHERE id = ?";
        db.run(sql, [status, slotId], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            if (this.changes === 0) return res.status(404).json({ error: 'Slot not found' });
            logEvent('WARN', 'ADMIN_OVERRIDE', { slotId, newStatus: status });
            res.json({ ok: true, message: `Slot ${slotId} updated to ${status}` });
        });
    }
});

// ---------- Payments ----------
app.post('/api/payments/pay', (req, res) => {
    const { paymentId, userId } = req.body;
    const sql = "UPDATE payments SET status = 'paid' WHERE id = ? AND user_id = ?";
    db.run(sql, [paymentId, userId], function(err) {
        if (err) {
            logEvent('ERROR', 'PAYMENT_FAILURE', { paymentId, userId, error: err.message });
            return res.status(500).json({ error: err.message });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Payment not found or access denied.' });
        }
        logEvent('INFO', 'PAYMENT_SUCCESS', { paymentId, userId });
        res.json({ ok: true, message: 'Payment successful!' });
    });
});

// --- ADVANCED ANALYTICS ENDPOINTS ---

// Revenue Analytics
app.get('/api/analytics/revenue', (req, res) => {
    const sql = `SELECT 
                    DATE(created_at) as date,
                    SUM(amount) as revenue,
                    COUNT(*) as transactions
                FROM payments 
                WHERE status = 'paid'
                GROUP BY DATE(created_at)
                ORDER BY date DESC
                LIMIT 30`;
    
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        
        // Calculate totals
        const totalRevenue = rows.reduce((sum, r) => sum + (r.revenue || 0), 0);
        const totalTransactions = rows.reduce((sum, r) => sum + (r.transactions || 0), 0);
        
        res.json({
            dailyRevenue: rows,
            totalRevenue,
            totalTransactions,
            averagePerTransaction: totalTransactions > 0 ? totalRevenue / totalTransactions : 0
        });
    });
});

// Peak Hours Analysis
app.get('/api/analytics/peak-hours', (req, res) => {
    const sql = `SELECT 
                    CAST(strftime('%H', start_time) AS INTEGER) as hour,
                    COUNT(*) as bookings
                FROM bookings 
                WHERE status != 'cancelled'
                GROUP BY hour
                ORDER BY hour`;
    
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        
        // Fill in missing hours with 0
        const hourlyData = Array(24).fill(0).map((_, i) => ({
            hour: i,
            bookings: 0,
            label: `${i.toString().padStart(2, '0')}:00`
        }));
        
        rows.forEach(row => {
            if (row.hour >= 0 && row.hour < 24) {
                hourlyData[row.hour].bookings = row.bookings;
            }
        });
        
        res.json(hourlyData);
    });
});

// User Statistics
app.get('/api/analytics/users/:userId/stats', (req, res) => {
    const { userId } = req.params;
    
    const queries = {
        totalBookings: `SELECT COUNT(*) as count FROM bookings WHERE user_id = ?`,
        completedBookings: `SELECT COUNT(*) as count FROM bookings WHERE user_id = ? AND status = 'completed'`,
        totalSpent: `SELECT SUM(amount) as total FROM payments WHERE user_id = ? AND status = 'paid'`,
        averageStay: `SELECT AVG(CAST((julianday(exit_time) - julianday(entry_time)) * 24 * 60 AS INTEGER)) as avgMinutes 
                      FROM bookings WHERE user_id = ? AND exit_time IS NOT NULL`
    };
    
    const results = {};
    let completed = 0;
    
    Object.entries(queries).forEach(([key, sql]) => {
        db.get(sql, [userId], (err, row) => {
            if (!err) {
                results[key] = row[Object.keys(row)[0]] || 0;
            }
            completed++;
            if (completed === Object.keys(queries).length) {
                res.json(results);
            }
        });
    });
});

// Slot Utilization Report
app.get('/api/analytics/slot-utilization', (req, res) => {
    const sql = `SELECT 
                    s.id as slot_id,
                    COUNT(b.id) as total_bookings,
                    SUM(CASE WHEN b.status = 'completed' THEN 1 ELSE 0 END) as completed_bookings,
                    SUM(CASE WHEN b.status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_bookings,
                    ROUND(AVG(CASE WHEN b.exit_time IS NOT NULL 
                        THEN CAST((julianday(b.exit_time) - julianday(b.entry_time)) * 24 * 60 AS INTEGER)
                        ELSE NULL END), 2) as avg_duration_minutes
                FROM slots s
                LEFT JOIN bookings b ON s.id = b.slot_id
                GROUP BY s.id
                ORDER BY total_bookings DESC`;
    
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// System Health Check
app.get('/api/health', (req, res) => {
    const health = {
        status: 'healthy',
        timestamp: nowISO(),
        uptime: process.uptime(),
        gateStatus: gateState,
        lotStatus: lotStatus,
        database: 'connected'
    };
    
    // Quick DB check
    db.get('SELECT COUNT(*) as count FROM slots', [], (err, row) => {
        if (err) {
            health.status = 'degraded';
            health.database = 'error';
        } else {
            health.totalSlots = row.count;
        }
        
        db.get('SELECT COUNT(*) as count FROM bookings WHERE status = "active" OR status = "entered"', [], (err, row) => {
            if (!err) {
                health.activeBookings = row.count;
            }
            res.json(health);
        });
    });
});

// Export Data (CSV simulation)
app.get('/api/export/bookings', (req, res) => {
    const { startDate, endDate } = req.query;
    let sql = `SELECT 
                b.id, b.user_id, b.slot_id, b.start_time, b.end_time, 
                b.entry_time, b.exit_time, b.status, b.vehicle_number, 
                b.phone_number, p.amount, p.status as payment_status
              FROM bookings b
              LEFT JOIN payments p ON b.id = p.booking_id`;
    
    const params = [];
    if (startDate && endDate) {
        sql += ` WHERE b.created_at BETWEEN ? AND ?`;
        params.push(startDate, endDate);
    }
    
    sql += ` ORDER BY b.created_at DESC LIMIT 1000`;
    
    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        
        // Convert to CSV format
        if (rows.length === 0) {
            return res.send('No data available');
        }
        
        const headers = Object.keys(rows[0]).join(',');
        const csvRows = rows.map(row => Object.values(row).join(','));
        const csv = [headers, ...csvRows].join('\n');
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=bookings_export.csv');
        res.send(csv);
    });
});

// --- Background Job for Auto-Cancelling Bookings ---
// Only cancel bookings that are past the grace period (5 min after start time) and user never checked in
setInterval(() => {
    const now = nowISO();
    // Cancel bookings where:
    // 1. Status is still 'active' (user never checked in/entered)
    // 2. Current time is more than 5 minutes past the start_time (grace period expired)
    // 3. entry_time is NULL (user never accessed the parking)
    const findSql = `SELECT id, slot_id, start_time FROM bookings 
                     WHERE status = 'active' 
                     AND entry_time IS NULL 
                     AND ? > datetime(start_time, '+5 minutes')`;
    db.all(findSql, [now], (err, rows) => {
        if (err) { console.error("Error in auto-cancel job:", err); return; }
        
        if (rows.length > 0) {
            console.log(`Auto-cancelling ${rows.length} expired booking(s)...`);
            db.serialize(() => {
                rows.forEach(booking => {
                    logEvent('INFO', 'AUTO_CANCEL', { bookingId: booking.id, slotId: booking.slot_id, reason: 'Grace period expired - user did not check in.' });
                    db.run("UPDATE bookings SET status = 'cancelled' WHERE id = ?", [booking.id]);
                    // Free the slot
                    db.run("UPDATE slots SET status = 'free' WHERE id = ?", [booking.slot_id]);
                });
            });
        }
    });
}, 30000); // Check every 30 seconds

// --- Background Job for Lot Status Monitoring ---
setInterval(() => {
    db.get("SELECT COUNT(*) as freeCount FROM slots WHERE status = 'free'", [], (err, row) => {
        if (err) { console.error("Error in lot status job:", err); return; }
        lotStatus = (row.freeCount > 0) ? 'available' : 'full';
    });
}, 10000); // Check every 10 seconds

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Smart Parking backend running on port ${PORT}`));
