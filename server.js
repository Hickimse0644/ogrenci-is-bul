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

db.serialize(() => {
  // İlanlar tablosu
  db.run(`CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    salary TEXT,
    location TEXT,
    phone TEXT,
    description TEXT,
    age_range TEXT
  )`);

  // MESAJLAR TABLOSU (Yeni eklendi)
  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER,
    sender_age INTEGER,
    message_text TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

// İLANLARI GETİR
app.get("/api/jobs", (req, res) => {
  db.all("SELECT * FROM jobs ORDER BY id DESC", (err, rows) => {
    res.json(rows);
  });
});

// İLAN EKLE
app.post("/api/jobs", (req, res) => {
  const { title, salary, location, phone, description, age_range } = req.body;
  db.run(
    "INSERT INTO jobs (title, salary, location, phone, description, age_range) VALUES (?,?,?,?,?,?)",
    [title, salary, location, phone, description, age_range],
    function(err) { res.json({ id: this.lastID }); }
  );
});

// MESAJ GÖNDER
app.post("/api/messages", (req, res) => {
  const { job_id, sender_age, message_text } = req.body;
  db.run(
    "INSERT INTO messages (job_id, sender_age, message_text) VALUES (?,?,?)",
    [job_id, sender_age, message_text],
    function(err) { res.json({ status: "Mesaj gönderildi!" }); }
  );
});

// MESAJLARI GETİR (İşveren için)
app.get("/api/messages/:job_id", (req, res) => {
  const jobId = req.params.job_id;
  db.all("SELECT * FROM messages WHERE job_id = ? ORDER BY timestamp DESC", [jobId], (err, rows) => {
    res.json(rows);
  });
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server aktif: ${PORT}`));