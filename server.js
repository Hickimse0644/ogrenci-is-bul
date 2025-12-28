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

// Veritabanı tablolarını oluşturma
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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
    sender_age INTEGER,
    message_text TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

// İlanları getir
app.get("/api/jobs", (req, res) => {
  db.all("SELECT * FROM jobs ORDER BY id DESC", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// İlan ekle
app.post("/api/jobs", (req, res) => {
  const { title, salary, location, phone, description, age_range } = req.body;
  db.run(
    "INSERT INTO jobs (title, salary, location, phone, description, age_range) VALUES (?,?,?,?,?,?)",
    [title, salary, location, phone, description, age_range],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID });
    }
  );
});

// Mesaj gönder
app.post("/api/messages", (req, res) => {
  const { job_id, sender_age, message_text } = req.body;
  db.run(
    "INSERT INTO messages (job_id, sender_age, message_text) VALUES (?,?,?)",
    [job_id, sender_age, message_text],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ status: "ok" });
    }
  );
});

// Belirli bir ilana gelen mesajları getir
app.get("/api/messages/:job_id", (req, res) => {
  db.all("SELECT * FROM messages WHERE job_id = ? ORDER BY timestamp DESC", [req.params.job_id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// !!! DÜZELTİLEN KISIM BURASI !!!
// "*" yerine /.*/ kullandık. Bu "ne gelirse gelsin" demenin daha güvenli yoludur.
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server ${PORT} portunda hazir!`));