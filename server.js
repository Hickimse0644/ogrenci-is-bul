const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");

const app = express();
// Veritabanı dosyamızı bağlıyoruz
const db = new sqlite3.Database("./database.db");

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname)));

// --- VERİTABANI TABLOLARINI OLUŞTURMA ---
db.serialize(() => {
  // Kullanıcılar Tablosu (E-posta benzersiz olmalı)
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    password TEXT,
    user_type TEXT,
    age INTEGER
  )`);

  // İlanlar Tablosu
  db.run(`CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_email TEXT, 
    title TEXT,
    salary TEXT,
    location TEXT,
    phone TEXT,
    description TEXT,
    age_range TEXT
  )`);

  // Mesajlar Tablosu
  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER,
    sender_email TEXT,
    sender_age INTEGER,
    message_text TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

// --- KAYIT VE GİRİŞ SİSTEMİ ---

// Yeni Kullanıcı Kaydı
app.post("/api/register", (req, res) => {
  const { email, password, user_type, age } = req.body;
  db.run(
    "INSERT INTO users (email, password, user_type, age) VALUES (?, ?, ?, ?)",
    [email, password, user_type, age],
    function(err) {
      if (err) {
        // Eğer e-posta zaten varsa SQLite 'UNIQUE constraint' hatası verir
        return res.status(400).json({ error: "Bu e-posta adresi zaten kullanımda!" });
      }
      res.json({ id: this.lastID, status: "success" });
    }
  );
});

// Kullanıcı Girişi
app.post("/api/login", (req, res) => {
  const { email, password } = req.body;
  db.get("SELECT * FROM users WHERE email = ? AND password = ?", [email, password], (err, row) => {
    if (err || !row) {
      return res.status(401).json({ error: "E-posta veya şifre hatalı!" });
    }
    res.json(row); // Kullanıcı bilgilerini dön (Şifre dahil ama gerçek projede bu güvenli değil, şimdilik basit tutuyoruz)
  });
});

// --- İLAN İŞLEMLERİ ---

// Tüm ilanları getir
app.get("/api/jobs", (req, res) => {
  db.all("SELECT * FROM jobs ORDER BY id DESC", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Yeni ilan ekle
app.post("/api/jobs", (req, res) => {
  const { owner_email, title, salary, location, phone, description, age_range } = req.body;
  db.run(
    "INSERT INTO jobs (owner_email, title, salary, location, phone, description, age_range) VALUES (?,?,?,?,?,?,?)",
    [owner_email, title, salary, location, phone, description, age_range],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID });
    }
  );
});

// İlan Güncelleme (Düzenleme)
app.put("/api/jobs/:id", (req, res) => {
  const { title, salary, location, phone, description, age_range } = req.body;
  const jobId = req.params.id;
  db.run(
    "UPDATE jobs SET title=?, salary=?, location=?, phone=?, description=?, age_range=? WHERE id=?",
    [title, salary, location, phone, description, age_range, jobId],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ status: "updated" });
    }
  );
});

// --- MESAJ İŞLEMLERİ ---

app.post("/api/messages", (req, res) => {
  const { job_id, sender_email, sender_age, message_text } = req.body;
  db.run(
    "INSERT INTO messages (job_id, sender_email, sender_age, message_text) VALUES (?,?,?,?)",
    [job_id, sender_email, sender_age, message_text],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ status: "ok" });
    }
  );
});

app.get("/api/messages/:job_id", (req, res) => {
  db.all("SELECT * FROM messages WHERE job_id = ? ORDER BY timestamp DESC", [req.params.job_id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// SPA yönlendirmesi
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Sunucu http://localhost:${PORT} adresinde çalışıyor!`));