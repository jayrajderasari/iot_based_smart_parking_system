// App.js - Smart Parking Frontend (Enhanced Professional Version)
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, 
  PieChart, Pie, Cell, Legend, ResponsiveContainer,
  BarChart, Bar, AreaChart, Area
} from 'recharts';

const API_BASE = 'http://192.168.0.7:3000/api'; // IMPORTANT: Change to your backend's IP address

// --- NOTIFICATION SYSTEM ---
const NotificationCenter = ({ notifications, onDismiss }) => {
  return (
    <div style={styles.notificationContainer}>
      {notifications.map((notif, idx) => (
        <div key={idx} style={{...styles.notification, ...styles[`notification${notif.type}`]}}>
          <div style={styles.notificationContent}>
            <span style={styles.notificationIcon}>{notif.icon}</span>
            <span>{notif.message}</span>
          </div>
          <button onClick={() => onDismiss(idx)} style={styles.notificationClose}>×</button>
        </div>
      ))}
    </div>
  );
};

// --- QR CODE GENERATOR (Simple SVG-based) ---
const QRCodeDisplay = ({ data }) => {
  return (
    <div style={styles.qrContainer}>
      <svg width="150" height="150" viewBox="0 0 29 29">
        {/* Simplified QR pattern - in production use a real QR library */}
        <rect width="29" height="29" fill="white"/>
        <g fill="black">
          {/* Corner patterns */}
          <rect x="0" y="0" width="7" height="7"/>
          <rect x="22" y="0" width="7" height="7"/>
          <rect x="0" y="22" width="7" height="7"/>
          {/* Data pattern (simplified) */}
          {data.split('').map((char, i) => 
            char.charCodeAt(0) % 2 === 0 ? (
              <rect key={i} x={8 + (i % 13)} y={8 + Math.floor(i / 13)} width="1" height="1"/>
            ) : null
          )}
        </g>
      </svg>
      <p style={styles.qrText}>Booking: {data.substring(0, 8)}</p>
    </div>
  );
};


// --- ENHANCED BOOKING MODAL WITH QR CODE ---
function BookingModal({ slot, onClose, onBook }) {
  const [startTime, setStartTime] = useState(new Date().toISOString().slice(0, 16));
  const [duration, setDuration] = useState(60); // Default duration 60 minutes
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  const handleBook = () => {
    if (new Date(startTime) < new Date()) {
      alert("Booking time cannot be in the past.");
      return;
    }
    if (!vehicleNumber.trim()) {
      alert("Please enter vehicle number.");
      return;
    }
    onBook({ startTime, duration: Number(duration), vehicleNumber, phoneNumber });
  };

  const estimatedCost = (duration / 60) * 4; // $4 per hour

  return (
    <div style={styles.modalBackdrop} onClick={onClose}>
      <div style={styles.modalContentEnhanced} onClick={e => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h2 style={styles.modalTitle}>🅿️ Book Slot {slot.id}</h2>
          <button onClick={onClose} style={styles.closeBtn}>×</button>
        </div>
        
        <div style={styles.modalBody}>
          <div style={styles.formGroup}>
            <label style={styles.label}>🚗 Vehicle Number *</label>
            <input 
              type="text" 
              value={vehicleNumber} 
              onChange={e => setVehicleNumber(e.target.value.toUpperCase())}
              placeholder="e.g., ABC-1234"
              style={styles.inputEnhanced}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>📱 Phone Number</label>
            <input 
              type="tel" 
              value={phoneNumber} 
              onChange={e => setPhoneNumber(e.target.value)}
              placeholder="e.g., +1 234 567 8900"
              style={styles.inputEnhanced}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>📅 Start Time *</label>
            <input 
              type="datetime-local" 
              value={startTime} 
              onChange={e => setStartTime(e.target.value)}
              style={styles.inputEnhanced}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>⏱️ Duration</label>
            <select 
              value={duration} 
              onChange={e => setDuration(Number(e.target.value))}
              style={styles.inputEnhanced}
            >
              <option value={30}>30 minutes</option>
              <option value={60}>1 hour</option>
              <option value={90}>1.5 hours</option>
              <option value={120}>2 hours</option>
              <option value={180}>3 hours</option>
              <option value={240}>4 hours</option>
              <option value={480}>8 hours (Full day)</option>
            </select>
          </div>

          <div style={styles.costEstimate}>
            <span style={styles.costLabel}>Estimated Cost:</span>
            <span style={styles.costValue}>${estimatedCost.toFixed(2)}</span>
          </div>
        </div>

        <div style={styles.modalActions}>
          <button onClick={onClose} style={styles.btnSecondary}>Cancel</button>
          <button onClick={handleBook} style={styles.btnPrimary}>
            ✓ Confirm Booking
          </button>
        </div>
      </div>
    </div>
  );
}

function AdminSlotModal({ slot, bookings, onClose, onUpdate }) {
    if (!slot) return null;
  
    const relevantBooking = bookings.find(b => (b.slot_id === slot.id) && (b.status === 'active' || b.status === 'entered'));
  
    const handleStatusChange = (newStatus) => {
      // This would call a new API endpoint to manually update a slot
      // For now, we just log it and close
      console.log(`Request to change slot ${slot.id} to ${newStatus}`);
      onUpdate(slot.id, newStatus);
      onClose();
    };
  
    return (
      <div style={styles.modalBackdrop}>
        <div style={styles.modalContent}>
          <h3>Manage Slot {slot.id}</h3>
          <p>Current Status: <strong>{slot.status.toUpperCase()}</strong></p>
          {relevantBooking && (
            <div>
              <h4>Active Booking</h4>
              <p>User ID: {relevantBooking.user_id}</p>
              <p>Start: {new Date(relevantBooking.start_time).toLocaleString()}</p>
              <p>End: {new Date(relevantBooking.end_time).toLocaleString()}</p>
            </div>
          )}
          <hr />
          <h4>Manual Override</h4>
          <div style={{display: 'flex', gap: '10px', justifyContent: 'center'}}>
            <button onClick={() => handleStatusChange('free')}>Set to Free</button>
            <button onClick={() => handleStatusChange('occupied')}>Set to Occupied</button>
            <button onClick={() => handleStatusChange('maintenance')}>Set to Maintenance</button>
          </div>
          <div style={styles.modalActions}>
            <button onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    );
  }


// --- ENHANCED LOGIN PAGE WITH MODERN UI ---
function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDemo, setShowDemo] = useState(false);

  const submit = async () => {
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/auth`, { username, password });
      onLogin(res.data);
    } catch (e) {
      alert('Login failed: ' + (e.response?.data?.error || e.message));
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') submit();
  };

  return (
    <div style={styles.loginContainer}>
      <div style={styles.loginBoxEnhanced}>
        <div style={styles.loginHeader}>
          <div style={styles.logoCircle}>🅿️</div>
          <h1 style={styles.loginTitle}>Smart Parking System</h1>
          <p style={styles.loginSubtitle}>IoT-Powered Parking Management</p>
        </div>

        <div style={styles.loginForm}>
          <div style={styles.inputGroup}>
            <span style={styles.inputIcon}>👤</span>
            <input 
              placeholder="Username" 
              value={username} 
              onChange={e=>setUsername(e.target.value)}
              onKeyPress={handleKeyPress}
              style={styles.inputEnhanced}
              autoFocus
            />
          </div>

          <div style={styles.inputGroup}>
            <span style={styles.inputIcon}>🔒</span>
            <input 
              placeholder="Password" 
              type="password" 
              value={password} 
              onChange={e=>setPassword(e.target.value)}
              onKeyPress={handleKeyPress}
              style={styles.inputEnhanced}
            />
          </div>

          <button 
            onClick={submit} 
            disabled={loading}
            style={{...styles.loginButton, opacity: loading ? 0.6 : 1}}
          >
            {loading ? '⏳ Logging in...' : '🚀 Login'}
          </button>

          <div style={styles.demoAccountsToggle} onClick={() => setShowDemo(!showDemo)}>
            {showDemo ? '▼' : '▶'} Demo Accounts
          </div>

          {showDemo && (
            <div style={styles.demoAccounts}>
              <div style={styles.demoAccount} onClick={() => {setUsername('admin'); setPassword('admin123');}}>
                <strong>👨‍💼 Admin:</strong> admin / admin123
              </div>
              <div style={styles.demoAccount} onClick={() => {setUsername('user1'); setPassword('user123');}}>
                <strong>👤 User:</strong> user1 / user123
              </div>
            </div>
          )}
        </div>

        <div style={styles.loginFooter}>
          <div style={styles.feature}>✓ Real-time Monitoring</div>
          <div style={styles.feature}>✓ Smart Booking</div>
          <div style={styles.feature}>✓ Automated Payments</div>
        </div>
      </div>
    </div>
  );
}

function ConsumerView({ user, onLogout }) {
  const [slots, setSlots] = useState([]);
  const [activeBookings, setActiveBookings] = useState([]);
  const [bookingHistory, setBookingHistory] = useState([]);
  const [isModalOpen, setModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [now, setNow] = useState(new Date());
  const [notifications, setNotifications] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [stats, setStats] = useState({ totalBookings: 0, totalSpent: 0, activeCount: 0 });

  const addNotification = (message, type = 'success', icon = '✓') => {
    const notif = { message, type, icon, id: Date.now() };
    setNotifications(prev => [notif, ...prev].slice(0, 5)); // Keep max 5 notifications
    setTimeout(() => dismissNotification(notif.id), 5000); // Auto-dismiss after 5s
  };

  const dismissNotification = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const fetchAllForUser = async () => {
    try {
      const [slotsRes, historyRes] = await Promise.all([
        axios.get(`${API_BASE}/slots`),
        axios.get(`${API_BASE}/users/${user.id}/booking-history`)
      ]);
      
      setSlots(slotsRes.data);
      setBookingHistory(historyRes.data);

      const active = historyRes.data.filter(b => b.status === 'active' || b.status === 'entered');
      setActiveBookings(active);
      
      // Calculate stats
      const totalBookings = historyRes.data.length;
      const totalSpent = historyRes.data.reduce((sum, b) => sum + (b.amount || 0), 0);
      setStats({ totalBookings, totalSpent, activeCount: active.length });
      
      setNow(new Date());
    } catch (error) {
      console.error("Failed to fetch user data:", error);
      addNotification('Failed to refresh data', 'error', '⚠️');
    }
  };

  useEffect(() => {
    fetchAllForUser();
    const t = setInterval(fetchAllForUser, 5000); // Fetch every 5 seconds
    return () => clearInterval(t);
  }, [user.id]);

  const handleBookClick = (slot) => {
    setSelectedSlot(slot);
    setModalOpen(true);
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setSelectedSlot(null);
  };

  const handleBookingSubmit = async ({ startTime, duration, vehicleNumber, phoneNumber }) => {
    if (!selectedSlot) return;
    try {
      await axios.post(`${API_BASE}/book`, { 
        userId: user.id, 
        slotId: selectedSlot.id,
        startTime,
        duration,
        vehicleNumber,
        phoneNumber
      });
      addNotification(`✓ Slot ${selectedSlot.id} booked successfully!`, 'success', '🎉');
      fetchAllForUser(); 
      handleModalClose();
    } catch (e) {
      addNotification('Booking failed: ' + (e.response?.data?.error || e.message), 'error', '⚠️');
    }
  };

  const cancel = async (bookingId) => {
    if (!window.confirm('Are you sure you want to cancel this booking?')) return;
    try {
      await axios.post(`${API_BASE}/cancel`, { bookingId });
      addNotification('Booking cancelled successfully', 'warning', 'ℹ️');
      fetchAllForUser();
    } catch (e) {
      addNotification('Cancellation failed: ' + (e.response?.data?.error || e.message), 'error', '⚠️');
    }
  };

  const requestAccess = async (bookingId) => {
    try {
      const res = await axios.post(`${API_BASE}/requestAccess`, { bookingId });
      addNotification(res.data.message + ' 🚗 Gate opening...', 'success', '🚪');
      fetchAllForUser();
    } catch (e) {
      addNotification('Access request failed: ' + (e.response?.data?.error || e.message), 'error', '⚠️');
    }
  };

  const isWithinGracePeriod = (startTime) => {
    const start = new Date(startTime);
    const graceStart = new Date(start.getTime() - 5 * 60 * 1000); // 5 mins before
    const graceEnd = new Date(start.getTime() + 5 * 60 * 1000); // 5 mins after
    return now >= graceStart && now <= graceEnd;
  };

  const handlePay = async (paymentId) => {
    try {
      const res = await axios.post(`${API_BASE}/payments/pay`, {
        paymentId,
        userId: user.id
      });
      addNotification(res.data.message, 'success', '💳');
      fetchAllForUser();
    } catch (e) {
      addNotification('Payment failed: ' + (e.response?.data?.error || e.message), 'error', '⚠️');
    }
  };

  // Filtering logic
  const filteredHistory = bookingHistory.filter(b => {
    const matchesSearch = b.slot_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         b.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'all' || b.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const freeSlots = slots.filter(s => s.status === 'free');
  const occupiedSlots = slots.filter(s => s.status === 'occupied');

  return (
    <div style={styles.dashboardContainer}>
      <NotificationCenter notifications={notifications} onDismiss={dismissNotification} />
      
      {isModalOpen && <BookingModal slot={selectedSlot} onClose={handleModalClose} onBook={handleBookingSubmit} />}
      
      {/* Enhanced Header */}
      <div style={styles.headerEnhanced}>
        <div style={styles.headerLeft}>
          <h1 style={styles.dashboardTitle}>🅿️ My Parking</h1>
          <p style={styles.dashboardSubtitle}>Welcome back, {user.username}!</p>
        </div>
        <button onClick={onLogout} style={styles.logoutBtn}>
          🚪 Logout
        </button>
      </div>

      {/* Statistics Cards */}
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={styles.statIcon}>📊</div>
          <div style={styles.statContent}>
            <div style={styles.statValue}>{stats.totalBookings}</div>
            <div style={styles.statLabel}>Total Bookings</div>
          </div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statIcon}>💰</div>
          <div style={styles.statContent}>
            <div style={styles.statValue}>${stats.totalSpent.toFixed(2)}</div>
            <div style={styles.statLabel}>Total Spent</div>
          </div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statIcon}>🚗</div>
          <div style={styles.statContent}>
            <div style={styles.statValue}>{stats.activeCount}</div>
            <div style={styles.statLabel}>Active Bookings</div>
          </div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statIcon}>🟢</div>
          <div style={styles.statContent}>
            <div style={styles.statValue}>{freeSlots.length}/{slots.length}</div>
            <div style={styles.statLabel}>Available Slots</div>
          </div>
        </div>
      </div>

      {/* Available Slots Section */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>🅿️ Available Parking Slots</h2>
        <div style={styles.slotGridEnhanced}>
          {slots.map(s => (
            <div 
              key={s.id} 
              style={{...styles.slotEnhanced, ...getSlotStyleEnhanced(s.status)}}
              onClick={() => s.status === 'free' && handleBookClick(s)}
            >
              <div style={styles.slotHeader}>
                <span style={styles.slotIdEnhanced}>{s.id}</span>
                <span style={styles.slotBadge}>{getStatusIcon(s.status)}</span>
              </div>
              <div style={styles.slotStatus}>{s.status.toUpperCase()}</div>
              {s.status === 'free' && (
                <div style={styles.slotAction}>
                  <button style={styles.bookBtn}>📅 Book Now</button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Active Bookings Section */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>⚡ Active Bookings</h2>
        {activeBookings.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>📭</div>
            <p>No active bookings</p>
            <p style={styles.emptyHint}>Book a slot above to get started!</p>
          </div>
        ) : (
          <div style={styles.activeBookingsGrid}>
            {activeBookings.map(b => (
              <div key={b.id} style={styles.activeBookingCard}>
                <div style={styles.bookingCardHeader}>
                  <span style={styles.bookingSlot}>🅿️ Slot {b.slot_id}</span>
                  <span style={{...styles.statusBadge, ...getStatusBadgeStyle(b.status)}}>{b.status}</span>
                </div>
                <div style={styles.bookingCardBody}>
                  <div style={styles.bookingTime}>
                    <span style={styles.timeIcon}>🕒</span>
                    <span>{new Date(b.start_time).toLocaleString()}</span>
                  </div>
                  {b.end_time && (
                    <div style={styles.bookingTime}>
                      <span style={styles.timeIcon}>🏁</span>
                      <span>{new Date(b.end_time).toLocaleString()}</span>
                    </div>
                  )}
                </div>
                <div style={styles.bookingCardActions}>
                  <button onClick={() => cancel(b.id)} style={styles.btnDanger}>
                    ❌ Cancel
                  </button>
                  {isWithinGracePeriod(b.start_time) && b.status === 'active' && (
                    <button onClick={() => requestAccess(b.id)} style={styles.btnSuccess}>
                      🚪 Access Parking
                    </button>
                  )}
                  {b.status === 'entered' && (
                    <div style={styles.parkedIndicator}>✓ Currently Parked</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Booking History Section */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>📜 Booking History</h2>
        
        {/* Search and Filter Controls */}
        <div style={styles.controls}>
          <input 
            type="text"
            placeholder="🔍 Search by Slot ID or Booking ID..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={styles.searchInput}
          />
          <select 
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            style={styles.filterSelect}
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="entered">Entered</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div style={styles.tableContainer}>
          <table style={styles.tableEnhanced}>
            <thead>
              <tr>
                <th>Booking ID</th>
                <th>Slot</th>
                <th>Start Time</th>
                <th>End Time</th>
                <th>Status</th>
                <th>Charge</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredHistory.length === 0 ? (
                <tr><td colSpan="7" style={styles.noData}>No bookings found</td></tr>
              ) : (
                filteredHistory.map(b => (
                  <tr key={b.id} style={styles.tableRow}>
                    <td style={styles.tableCell}>{b.id.substring(0, 8)}...</td>
                    <td style={styles.tableCell}><strong>{b.slot_id}</strong></td>
                    <td style={styles.tableCell}>{new Date(b.start_time).toLocaleString()}</td>
                    <td style={styles.tableCell}>{b.exit_time ? new Date(b.exit_time).toLocaleString() : 'N/A'}</td>
                    <td style={styles.tableCell}>
                      <span style={{...styles.statusBadge, ...getStatusBadgeStyle(b.status)}}>{b.status}</span>
                    </td>
                    <td style={styles.tableCell}>{b.amount ? `$${b.amount.toFixed(2)}` : '-'}</td>
                    <td style={styles.tableCell}>
                      {b.payment_status === 'pending' && (
                        <button onClick={() => handlePay(b.payment_id)} style={styles.btnPay}>
                          💳 Pay Now
                        </button>
                      )}
                      {b.payment_status === 'paid' && (
                        <span style={styles.paidIndicator}>✓ Paid</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function AdminView({ user, onLogout }) {
  const [slots, setSlots] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [isModalOpen, setModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [occupancyData, setOccupancyData] = useState([]);

  const fetchAll = async () => {
    const [sRes, bRes, aRes] = await Promise.all([
      axios.get(`${API_BASE}/slots`),
      axios.get(`${API_BASE}/bookings`),
      axios.get(`${API_BASE}/analytics/occupancy`).catch(() => ({ data: [] }))
    ]);
    setSlots(sRes.data);
    setBookings(bRes.data);
    setOccupancyData(aRes.data);
  };

  useEffect(() => {
    fetchAll();
    const t = setInterval(fetchAll, 5000);
    return () => clearInterval(t);
  }, []);

  const handleSlotClick = (slot) => {
    setSelectedSlot(slot);
    setModalOpen(true);
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setSelectedSlot(null);
  };

  const handleUpdateSlot = async (slotId, newStatus) => {
    try {
        const res = await axios.post(`${API_BASE}/slots/updateStatus`, { slotId, status: newStatus });
        alert(res.data.message || 'Slot updated successfully');
        fetchAll();
    } catch (e) {
        alert('Failed to update slot status: ' + (e.response?.data?.error || e.message));
    }
  };

  const handleEmergencyGateOpen = async (gate) => {
    try {
        await axios.post(`${API_BASE}/gate/emergency-open`, { gate });
        alert(`${gate.charAt(0).toUpperCase() + gate.slice(1)} gate opened successfully!`);
    } catch (e) {
        alert('Failed to open gate: ' + (e.response?.data?.error || e.message));
    }
  };

  const freeSlots = slots.filter(s => s.status === 'free').length;
  const occupiedSlots = slots.filter(s => s.status === 'occupied').length;
  const bookedSlots = slots.filter(s => s.status === 'booked').length;
  const maintenanceSlots = slots.filter(s => s.status === 'maintenance').length;

  const pieData = [
    { name: 'Free', value: freeSlots },
    { name: 'Occupied', value: occupiedSlots },
    { name: 'Reserved', value: bookedSlots },
    { name: 'Maintenance', value: maintenanceSlots }
  ];
  const COLORS = ['#28a745', '#dc3545', '#ffc107', '#6c757d'];

  return (
    <div style={{padding:20}}>
      <AdminSlotModal slot={selectedSlot} bookings={bookings} onClose={handleModalClose} onUpdate={handleUpdateSlot} />
      <div style={styles.header}>
        <h2>Admin Dashboard</h2>
        <div>
          <strong>{user.username} (admin)</strong>
          <button onClick={onLogout} style={{marginLeft:10}}>Logout</button>
        </div>
      </div>

      {/* Stats Bar */}
      <div style={styles.statsContainer}>
        <div style={{...styles.statBox, color: '#28a745'}}><strong>Available:</strong> {freeSlots}</div>
        <div style={{...styles.statBox, color: '#dc3545'}}><strong>Occupied:</strong> {occupiedSlots}</div>
        <div style={{...styles.statBox, color: '#ffc107'}}><strong>Reserved:</strong> {bookedSlots}</div>
        <div style={{...styles.statBox, color: '#6c757d'}}><strong>Maintenance:</strong> {maintenanceSlots}</div>
      </div>

      {/* Emergency Controls */}
      <div style={styles.emergencyControls}>
        <h3>Emergency Controls</h3>
        <button onClick={() => handleEmergencyGateOpen('entrance')} style={styles.emergencyBtn}>
          🚨 Open Entrance Gate
        </button>
        <button onClick={() => handleEmergencyGateOpen('exit')} style={styles.emergencyBtn}>
          🚨 Open Exit Gate
        </button>
      </div>

      {/* Analytics Charts */}
      <div style={{display:'flex', gap:20, marginTop:30, marginBottom:30}}>
        <div style={{flex:2}}>
          <h3>Occupancy Over Time</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={occupancyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="occupied" stroke="#dc3545" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div style={{flex:1}}>
          <h3>Slot Distribution</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                {pieData.map((entry, idx) => <Cell key={idx} fill={COLORS[idx]} />)}
              </Pie>
              <Legend />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Interactive Parking Map */}
      <h3>Parking Lot Overview</h3>
      <div style={styles.slotGrid}>
        {slots.map(s => (
          <div key={s.id} style={{...styles.slot, ...getSlotStyle(s.status)}} onClick={() => handleSlotClick(s)}>
            <div style={styles.slotId}>{s.id}</div>
            <div>{s.status.toUpperCase()}</div>
          </div>
        ))}
      </div>

      {/* Bookings List */}
      <h3 style={{marginTop: 40}}>All Bookings</h3>
      <table style={styles.table}>
        <thead>
            <tr>
                <th>ID</th>
                <th>Slot</th>
                <th>User</th>
                <th>Time</th>
                <th>Status</th>
            </tr>
        </thead>
        <tbody>
            {bookings.length === 0 ? (
                <tr><td colSpan="5">No bookings found.</td></tr>
            ) : (
                bookings.map(b => (
                    <tr key={b.id}>
                        <td>{b.id.substring(0, 8)}...</td>
                        <td>{b.slot_id}</td>
                        <td>{b.user_id.substring(0, 8)}...</td>
                        <td>{new Date(b.start_time).toLocaleString()}</td>
                        <td style={{color: getStatusColor(b.status), textTransform: 'capitalize'}}>{b.status}</td>
                    </tr>
                ))
            )}
        </tbody>
      </table>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);

  const handleLogin = (userObj) => setUser(userObj);
  const handleLogout = () => setUser(null);

  if (!user) return <Login onLogin={handleLogin} />;
  if (user.role === 'consumer') return <ConsumerView user={user} onLogout={handleLogout} />;
  return <AdminView user={user} onLogout={handleLogout} />;
}

// --- HELPER FUNCTIONS ---

const getSlotStyle = (status) => {
    switch (status) {
      case 'free': return { backgroundColor: '#d4edda', borderColor: '#c3e6cb', color: '#155724' };
      case 'occupied': return { backgroundColor: '#f8d7da', borderColor: '#f5c6cb', color: '#721c24' };
      case 'booked': return { backgroundColor: '#fff3cd', borderColor: '#ffeeba', color: '#856404' };
      case 'maintenance': return { backgroundColor: '#e2e3e5', borderColor: '#d6d8db', color: '#383d41', cursor: 'not-allowed' };
      default: return {};
    }
};

const getSlotStyleEnhanced = (status) => {
    const baseStyle = {
      background: '#fff',
      borderLeft: '4px solid'
    };
    switch (status) {
      case 'free': return { ...baseStyle, borderLeftColor: '#28a745', boxShadow: '0 2px 8px rgba(40,167,69,0.2)' };
      case 'occupied': return { ...baseStyle, borderLeftColor: '#dc3545', boxShadow: '0 2px 8px rgba(220,53,69,0.2)' };
      case 'booked': return { ...baseStyle, borderLeftColor: '#ffc107', boxShadow: '0 2px 8px rgba(255,193,7,0.2)' };
      case 'maintenance': return { ...baseStyle, borderLeftColor: '#6c757d', boxShadow: '0 2px 8px rgba(108,117,125,0.2)', opacity: 0.6 };
      default: return baseStyle;
    }
};

const getStatusIcon = (status) => {
  switch (status) {
    case 'free': return '🟢';
    case 'occupied': return '🔴';
    case 'booked': return '🟡';
    case 'maintenance': return '🔧';
    default: return '⚪';
  }
};

const getStatusColor = (status) => {
    switch (status) {
        case 'active': return '#ffc107';
        case 'entered': return '#007bff';
        case 'completed': return '#28a745';
        case 'cancelled': return '#dc3545';
        default: return '#6c757d';
    }
};

const getStatusBadgeStyle = (status) => {
  switch (status) {
    case 'active': return { background: '#fff3cd', color: '#856404', borderColor: '#ffc107' };
    case 'entered': return { background: '#cce5ff', color: '#004085', borderColor: '#007bff' };
    case 'completed': return { background: '#d4edda', color: '#155724', borderColor: '#28a745' };
    case 'cancelled': return { background: '#f8d7da', color: '#721c24', borderColor: '#dc3545' };
    default: return { background: '#e2e3e5', color: '#383d41', borderColor: '#6c757d' };
  }
};

// --- ENHANCED STYLES ---

const styles = {
  // Login Page
  loginContainer: {
    display: 'flex',
    height: '100vh',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
  },
  loginBoxEnhanced: {
    background: '#fff',
    borderRadius: '20px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
    width: '420px',
    overflow: 'hidden',
    animation: 'slideIn 0.3s ease-out'
  },
  loginHeader: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: '#fff',
    padding: '40px 30px',
    textAlign: 'center'
  },
  logoCircle: {
    width: '80px',
    height: '80px',
    background: 'rgba(255,255,255,0.2)',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '40px',
    margin: '0 auto 20px',
    backdropFilter: 'blur(10px)'
  },
  loginTitle: {
    margin: 0,
    fontSize: '28px',
    fontWeight: 'bold'
  },
  loginSubtitle: {
    margin: '10px 0 0',
    fontSize: '14px',
    opacity: 0.9
  },
  loginForm: {
    padding: '30px'
  },
  inputGroup: {
    position: 'relative',
    marginBottom: '20px'
  },
  inputIcon: {
    position: 'absolute',
    left: '15px',
    top: '50%',
    transform: 'translateY(-50%)',
    fontSize: '18px',
    zIndex: 1
  },
  inputEnhanced: {
    width: '100%',
    padding: '12px 15px 12px 45px',
    border: '2px solid #e1e8ed',
    borderRadius: '10px',
    fontSize: '15px',
    transition: 'all 0.3s',
    boxSizing: 'border-box',
    outline: 'none'
  },
  loginButton: {
    width: '100%',
    padding: '14px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    fontSize: '16px',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'transform 0.2s',
    boxShadow: '0 4px 15px rgba(102,126,234,0.4)'
  },
  demoAccountsToggle: {
    textAlign: 'center',
    marginTop: '20px',
    color: '#667eea',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500'
  },
  demoAccounts: {
    marginTop: '15px',
    padding: '15px',
    background: '#f8f9fa',
    borderRadius: '10px',
    fontSize: '13px'
  },
  demoAccount: {
    padding: '10px',
    marginBottom: '8px',
    background: '#fff',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    border: '1px solid #e1e8ed'
  },
  loginFooter: {
    background: '#f8f9fa',
    padding: '20px 30px',
    display: 'flex',
    justifyContent: 'space-around',
    fontSize: '12px',
    color: '#6c757d'
  },
  feature: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px'
  },

  // Dashboard
  dashboardContainer: {
    minHeight: '100vh',
    background: '#f5f7fa',
    padding: '0',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
  },
  headerEnhanced: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: '#fff',
    padding: '30px 40px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
  },
  headerLeft: {
    flex: 1
  },
  dashboardTitle: {
    margin: 0,
    fontSize: '32px',
    fontWeight: 'bold'
  },
  dashboardSubtitle: {
    margin: '5px 0 0',
    fontSize: '16px',
    opacity: 0.9
  },
  logoutBtn: {
    padding: '10px 20px',
    background: 'rgba(255,255,255,0.2)',
    color: '#fff',
    border: '2px solid rgba(255,255,255,0.3)',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    transition: 'all 0.3s',
    backdropFilter: 'blur(10px)'
  },

  // Statistics Cards
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '20px',
    padding: '30px 40px',
    marginTop: '-30px'
  },
  statCard: {
    background: '#fff',
    borderRadius: '15px',
    padding: '25px',
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    transition: 'transform 0.3s, box-shadow 0.3s',
    cursor: 'pointer'
  },
  statIcon: {
    fontSize: '48px',
    width: '70px',
    height: '70px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    borderRadius: '50%',
    boxShadow: '0 4px 12px rgba(102,126,234,0.3)'
  },
  statContent: {
    flex: 1
  },
  statValue: {
    fontSize: '32px',
    fontWeight: 'bold',
    color: '#2c3e50',
    lineHeight: 1
  },
  statLabel: {
    fontSize: '14px',
    color: '#7f8c8d',
    marginTop: '5px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },

  // Sections
  section: {
    padding: '0 40px 30px'
  },
  sectionTitle: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: '20px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },

  // Slot Grid
  slotGridEnhanced: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '20px'
  },
  slotEnhanced: {
    padding: '20px',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'all 0.3s',
    border: '1px solid #e1e8ed'
  },
  slotHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px'
  },
  slotIdEnhanced: {
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#2c3e50'
  },
  slotBadge: {
    fontSize: '24px'
  },
  slotStatus: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#7f8c8d',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '15px'
  },
  slotAction: {
    marginTop: '10px'
  },
  bookBtn: {
    width: '100%',
    padding: '10px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    transition: 'transform 0.2s'
  },

  // Active Bookings
  activeBookingsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
    gap: '20px'
  },
  activeBookingCard: {
    background: '#fff',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    border: '1px solid #e1e8ed',
    transition: 'transform 0.3s, box-shadow 0.3s'
  },
  bookingCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '15px',
    paddingBottom: '15px',
    borderBottom: '1px solid #f0f0f0'
  },
  bookingSlot: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#2c3e50'
  },
  statusBadge: {
    padding: '5px 12px',
    borderRadius: '20px',
    fontSize: '11px',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    border: '1px solid'
  },
  bookingCardBody: {
    marginBottom: '15px'
  },
  bookingTime: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '8px',
    fontSize: '14px',
    color: '#5a6c7d'
  },
  timeIcon: {
    fontSize: '16px'
  },
  bookingCardActions: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap'
  },
  btnDanger: {
    flex: 1,
    padding: '10px',
    background: '#fff',
    color: '#dc3545',
    border: '2px solid #dc3545',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '600',
    transition: 'all 0.3s'
  },
  btnSuccess: {
    flex: 1,
    padding: '10px',
    background: '#28a745',
    color: '#fff',
    border: '2px solid #28a745',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '600',
    transition: 'all 0.3s',
    boxShadow: '0 2px 8px rgba(40,167,69,0.3)'
  },
  parkedIndicator: {
    flex: 1,
    padding: '10px',
    background: '#cce5ff',
    color: '#004085',
    borderRadius: '8px',
    textAlign: 'center',
    fontSize: '13px',
    fontWeight: '600'
  },

  // Controls
  controls: {
    display: 'flex',
    gap: '15px',
    marginBottom: '20px'
  },
  searchInput: {
    flex: 1,
    padding: '12px 15px',
    border: '2px solid #e1e8ed',
    borderRadius: '10px',
    fontSize: '14px',
    outline: 'none',
    transition: 'border-color 0.3s'
  },
  filterSelect: {
    padding: '12px 15px',
    border: '2px solid #e1e8ed',
    borderRadius: '10px',
    fontSize: '14px',
    outline: 'none',
    background: '#fff',
    cursor: 'pointer',
    minWidth: '150px'
  },

  // Table
  tableContainer: {
    background: '#fff',
    borderRadius: '12px',
    overflow: 'hidden',
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
  },
  tableEnhanced: {
    width: '100%',
    borderCollapse: 'collapse'
  },
  tableRow: {
    transition: 'background 0.2s'
  },
  tableCell: {
    padding: '15px',
    borderBottom: '1px solid #f0f0f0',
    fontSize: '14px',
    color: '#2c3e50'
  },
  noData: {
    textAlign: 'center',
    padding: '40px',
    color: '#7f8c8d',
    fontSize: '14px'
  },
  btnPay: {
    padding: '8px 16px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '600',
    transition: 'transform 0.2s'
  },
  paidIndicator: {
    color: '#28a745',
    fontWeight: 'bold',
    fontSize: '13px'
  },

  // Empty State
  emptyState: {
    textAlign: 'center',
    padding: '60px 20px',
    background: '#fff',
    borderRadius: '12px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
  },
  emptyIcon: {
    fontSize: '64px',
    marginBottom: '20px'
  },
  emptyHint: {
    color: '#7f8c8d',
    fontSize: '14px',
    marginTop: '10px'
  },

  // Notification System
  notificationContainer: {
    position: 'fixed',
    top: '20px',
    right: '20px',
    zIndex: 9999,
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    maxWidth: '400px'
  },
  notification: {
    padding: '15px 20px',
    borderRadius: '10px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    animation: 'slideInRight 0.3s ease-out',
    border: '1px solid'
  },
  notificationsuccess: {
    background: '#d4edda',
    borderColor: '#c3e6cb',
    color: '#155724'
  },
  notificationerror: {
    background: '#f8d7da',
    borderColor: '#f5c6cb',
    color: '#721c24'
  },
  notificationwarning: {
    background: '#fff3cd',
    borderColor: '#ffeeba',
    color: '#856404'
  },
  notificationContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flex: 1
  },
  notificationIcon: {
    fontSize: '20px'
  },
  notificationClose: {
    background: 'transparent',
    border: 'none',
    fontSize: '24px',
    cursor: 'pointer',
    opacity: 0.5,
    transition: 'opacity 0.2s',
    padding: '0 5px'
  },

  // Modal Enhancement
  modalBackdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    backdropFilter: 'blur(5px)'
  },
  modalContentEnhanced: {
    background: '#fff',
    borderRadius: '20px',
    width: '500px',
    maxWidth: '90vw',
    maxHeight: '90vh',
    overflow: 'auto',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
    animation: 'scaleIn 0.3s ease-out'
  },
  modalHeader: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: '#fff',
    padding: '25px 30px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: '20px 20px 0 0'
  },
  modalTitle: {
    margin: 0,
    fontSize: '22px',
    fontWeight: 'bold'
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    color: '#fff',
    fontSize: '32px',
    cursor: 'pointer',
    lineHeight: 1,
    padding: 0,
    width: '30px',
    height: '30px'
  },
  modalBody: {
    padding: '30px'
  },
  formGroup: {
    marginBottom: '20px'
  },
  label: {
    display: 'block',
    marginBottom: '8px',
    fontSize: '14px',
    fontWeight: '600',
    color: '#2c3e50'
  },
  costEstimate: {
    marginTop: '25px',
    padding: '15px',
    background: 'linear-gradient(135deg, #667eea15 0%, #764ba215 100%)',
    borderRadius: '10px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  costLabel: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#2c3e50'
  },
  costValue: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#667eea'
  },
  modalActions: {
    padding: '20px 30px',
    borderTop: '1px solid #f0f0f0',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px'
  },
  btnSecondary: {
    padding: '12px 24px',
    background: '#fff',
    color: '#6c757d',
    border: '2px solid #e1e8ed',
    borderRadius: '10px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    transition: 'all 0.3s'
  },
  btnPrimary: {
    padding: '12px 24px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    transition: 'all 0.3s',
    boxShadow: '0 4px 15px rgba(102,126,234,0.4)'
  },

  // QR Code
  qrContainer: {
    textAlign: 'center',
    padding: '20px'
  },
  qrText: {
    marginTop: '10px',
    fontSize: '12px',
    color: '#7f8c8d'
  },

  // Legacy styles (for backward compatibility)
  loginBox: {padding:20,background:'#fff',boxShadow:'0 2px 8px rgba(0,0,0,0.1)',borderRadius:8,width:320},
  input: {width:'100%',margin:'6px 0', padding: '8px', boxSizing: 'border-box'},
  header: {display:'flex',justifyContent:'space-between',alignItems:'center', marginBottom: '20px'},
  slotGrid: {display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '15px'},
  slot: {padding:12,border:'1px solid #ddd',borderRadius:8,textAlign:'center', fontWeight: 'bold', cursor: 'pointer', transition: 'transform 0.2s'},
  slotId: {fontSize:18,fontWeight:700, marginBottom: '8px'},
  modalContent: {background:'white', padding:'20px 30px', borderRadius:8, width: 400, boxShadow: '0 4px 15px rgba(0,0,0,0.2)'},
  statsContainer: {display: 'flex', gap: '20px', marginBottom: '25px', padding: '15px', background: '#f8f9fa', borderRadius: '8px'},
  statBox: {fontSize: '1.1em'},
  table: {width: '100%', borderCollapse: 'collapse', marginTop: '10px'},
  activeBookingsContainer: { display: 'flex', gap: '15px', flexWrap: 'wrap'},
  activeBooking: { padding: '15px', border: '1px solid #007bff', borderRadius: '8px', background: '#e7f3ff', minWidth: '300px'},
  emergencyControls: { padding: '20px', background: '#fff3cd', borderRadius: '8px', marginBottom: '20px', border: '2px solid #ffc107' },
  emergencyBtn: { background: '#dc3545', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '5px', marginRight: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }
};
