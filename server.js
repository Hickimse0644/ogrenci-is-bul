const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");

const app = express();
const db = new sqlite3.Database("./database.db");

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname)));

// --- VERİTABANI TABLOLARINI OLUŞTURMA ---
db.serialize(() => {
  // Kullanıcılar Tablosuna username eklendi
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    email TEXT UNIQUE,
    password TEXT,
    user_type TEXT,
    age INTEGER
  )`);

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

app.post("/api/register", (req, res) => {
  const { username, email, password, user_type, age } = req.body;
  
  // Basit bir sunucu tarafı kontrolü
  if (age < 18) return res.status(400).json({ error: "Yaş 18'den küçük olamaz!" });

  db.run(
    "INSERT INTO users (username, email, password, user_type, age) VALUES (?, ?, ?, ?, ?)",
    [username, email, password, user_type, age],
    function(err) {
      if (err) {
        if (err.message.includes("users.email")) return res.status(400).json({ error: "Bu e-posta zaten kullanımda!" });
        if (err.message.includes("users.username")) return res.status(400).json({ error: "Bu kullanıcı adı zaten alınmış!" });
        return res.status(400).json({ error: "Kayıt sırasında bir hata oluştu." });
      }
      res.json({ id: this.lastID, status: "success" });
    }
  );
});

app.post("/api/login", (req, res) => {
  const { identifier, password } = req.body; // identifier: e-posta veya kullanıcı adı olabilir
  db.get(
    "SELECT * FROM users WHERE (email = ? OR username = ?) AND password = ?", 
    [identifier, identifier, password], 
    (err, row) => {
      if (err || !row) {
        return res.status(401).json({ error: "Bilgiler hatalı!" });
      }
      res.json(row);
    }
  );
});

// --- İLAN İŞLEMLERİ ---
app.get("/api/jobs", (req, res) => {
  db.all("SELECT * FROM jobs ORDER BY id DESC", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

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

app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Sunucu http://localhost:${PORT} adresinde çalışıyor!`));