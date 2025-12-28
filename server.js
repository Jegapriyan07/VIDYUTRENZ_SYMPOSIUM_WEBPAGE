require('dotenv').config();
require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// Serve static UI files from src
app.use(express.static(path.join(__dirname, 'src')));

const DATA_DIR = path.join(__dirname, 'data');
const EVENTS_FILE = path.join(DATA_DIR, 'events.json');
const REG_FILE = path.join(DATA_DIR, 'registrations.json');
const DB_FILE = path.join(DATA_DIR, 'app.db');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(EVENTS_FILE)) fs.writeFileSync(EVENTS_FILE, JSON.stringify({}, null, 2));
if (!fs.existsSync(REG_FILE)) fs.writeFileSync(REG_FILE, JSON.stringify([], null, 2));

// Initialize SQLite DB
const db = new sqlite3.Database(DB_FILE);
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS registrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT,
    phone TEXT,
    subject TEXT,
    message TEXT,
    eventId TEXT,
    createdAt TEXT
  )`);

  // Migrate any existing JSON registrations into DB (runs once if entries exist)
  try {
    const existing = JSON.parse(fs.readFileSync(REG_FILE, 'utf8')) || [];
    if (existing.length > 0) {
      const insert = db.prepare(`INSERT INTO registrations (name,email,phone,subject,message,eventId,createdAt) VALUES (?,?,?,?,?,?,?)`);
      existing.forEach(r => {
        insert.run(r.name || null, r.email || null, r.phone || null, r.subject || null, r.message || null, r.eventId || null, r.createdAt || new Date().toISOString());
      });
      insert.finalize();
      // clear the JSON file after migration to avoid duplicate imports
      fs.writeFileSync(REG_FILE, JSON.stringify([], null, 2));
      console.log('Migrated', existing.length, 'registrations into SQLite DB');
    }
  } catch (err) {
    console.warn('No existing registrations to migrate or failed to read file');
  }
});

// Configure email transporter once if SMTP is available
let transporter = null;
const smtpHost = process.env.SMTP_HOST;
const fromAddress = process.env.EMAIL_FROM;
if (smtpHost && fromAddress) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
  });
  transporter.verify().then(() => console.log('SMTP transporter ready')).catch(err => console.warn('SMTP verify failed:', err.message || err));
} else {
  console.log('SMTP not configured - confirmation and admin emails will be skipped');
}

console.log('Loaded ENV:', { SMTP_HOST: !!process.env.SMTP_HOST, ADMIN_SECRET: !!process.env.ADMIN_SECRET });

function buildConfirmationHtml(row) {
  return `
  <html>
  <body style="font-family: Arial, sans-serif; color:#222;">
    <h2>Registration Received</h2>
    <p>Hi ${row.name || ''},</p>
    <p>Thank you for registering for <strong>Vidyutrenz</strong>. We have received your registration details:</p>
    <table cellspacing="0" cellpadding="6" border="0">
      <tr><td><strong>Event</strong></td><td>${row.eventId || 'N/A'}</td></tr>
      <tr><td><strong>Phone</strong></td><td>${row.phone || 'N/A'}</td></tr>
      <tr><td><strong>Message</strong></td><td>${row.message || 'N/A'}</td></tr>
      <tr><td><strong>Registered At</strong></td><td>${row.createdAt || ''}</td></tr>
    </table>
    <p>We will contact you with further details.</p>
    <p>Regards,<br/>Vidyutrenz Team</p>
  </body>
  </html>
  `;
}

function buildAdminHtml(row) {
  return `
  <html><body style="font-family: Arial, sans-serif; color:#222;">
    <h2>New Registration Received</h2>
    <p>A new registration was submitted:</p>
    <ul>
      <li><strong>ID:</strong> ${row.id}</li>
      <li><strong>Name:</strong> ${row.name}</li>
      <li><strong>Email:</strong> ${row.email}</li>
      <li><strong>Phone:</strong> ${row.phone}</li>
      <li><strong>Event:</strong> ${row.eventId}</li>
      <li><strong>Message:</strong> ${row.message}</li>
      <li><strong>At:</strong> ${row.createdAt}</li>
    </ul>
  </body></html>
  `;
}

function sendConfirmationEmail(row) {
  if (!transporter) return Promise.resolve(null);
  const mailOptions = {
    from: fromAddress,
    to: row.email,
    subject: `Registration received - ${row.name}`,
    text: `Hi ${row.name || ''},\n\nThank you for registering for Vidyutrenz. Event: ${row.eventId || 'N/A'}.\n\nRegards,\nVidyutrenz Team`,
    html: buildConfirmationHtml(row)
  };
  return transporter.sendMail(mailOptions);
}

function sendAdminNotification(row) {
  if (!transporter) return Promise.resolve(null);
  const adminEmail = process.env.EMAIL_ADMIN;
  if (!adminEmail) return Promise.resolve(null);
  const mailOptions = {
    from: fromAddress,
    to: adminEmail,
    subject: `New registration: ${row.name || 'Unknown'}`,
    html: buildAdminHtml(row)
  };
  return transporter.sendMail(mailOptions);
}

// GET /api/events -> list all events (object map)
app.get('/api/events', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(EVENTS_FILE, 'utf8'));
    res.json({ success: true, events: data });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to read events' });
  }
});

// GET /api/events/:id -> single event
app.get('/api/events/:id', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(EVENTS_FILE, 'utf8'));
    const ev = data[req.params.id];
    if (!ev) return res.status(404).json({ success: false, error: 'Event not found' });
    res.json({ success: true, event: ev });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to read events' });
  }
});

// POST /api/register -> store registration (simple append)
app.post('/api/register', (req, res) => {
  const payload = req.body || {};
  console.log('Incoming registration payload:', payload);
  if (!payload.name || !payload.email) {
    console.warn('Validation failed - missing name or email', payload);
    return res.status(400).json({ success: false, error: 'name and email required' });
  }

  const now = new Date().toISOString();
  const stmt = `INSERT INTO registrations (name,email,phone,subject,message,eventId,createdAt) VALUES (?,?,?,?,?,?,?)`;
  db.run(stmt, [payload.name, payload.email, payload.phone || null, payload.subject || null, payload.message || null, payload.eventId || null, now], function(err) {
    if (err) {
      console.error('DB insert error:', err);
      return res.status(500).json({ success: false, error: 'Failed to save registration' });
    }
    const insertedId = this.lastID;
    db.get('SELECT * FROM registrations WHERE id = ?', [insertedId], (err, row) => {
      if (err) {
        console.error('DB readback error:', err);
        return res.status(500).json({ success: false, error: 'Failed to read back registration' });
      }
      console.log('Registration saved, id=', insertedId);
      res.json({ success: true, registration: row });
      // send confirmation email and admin notification (async)
      if (row.email) sendConfirmationEmail(row).then(r => console.log('Confirmation email sent')).catch(e => console.warn('Confirm email failed', e.message || e));
      sendAdminNotification(row).then(r => console.log('Admin notification sent')).catch(e => console.warn('Admin email failed', e.message || e));
    });
  });
});

// Admin: list registrations
app.get('/api/registrations', (req, res) => {
  // Admin protection: require matching secret if ADMIN_SECRET is set
  const adminSecret = process.env.ADMIN_SECRET;
  if (adminSecret) {
    const provided = req.query.secret || req.get('x-admin-secret');
    if (!provided || provided !== adminSecret) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
  }
  db.all('SELECT * FROM registrations ORDER BY createdAt DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ success: false, error: 'Failed to fetch registrations' });
    res.json({ success: true, registrations: rows });
  });
});

// Resend confirmation email for a registration (admin only)
app.post('/api/registrations/:id/resend', (req, res) => {
  const adminSecret = process.env.ADMIN_SECRET;
  if (adminSecret) {
    const provided = req.query.secret || req.get('x-admin-secret');
    if (!provided || provided !== adminSecret) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
  }
  const id = req.params.id;
  db.get('SELECT * FROM registrations WHERE id = ?', [id], (err, row) => {
    if (err || !row) return res.status(404).json({ success: false, error: 'Not found' });
    sendConfirmationEmail(row).then(info => res.json({ success: true, info })).catch(e => res.status(500).json({ success: false, error: e.message || e }));
  });
});

// Fallback to index.html for SPA-like behavior
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'src', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
