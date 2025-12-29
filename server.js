const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
const multer = require("multer");

const app = express();
const db = new sqlite3.Database("./database.db");

// Dosya yükleme konfigürasyonu
const storage = multer.diskStorage({
  destination: "./uploads/",
  filename: (req, file, cb) => {
    cb(null, "img-" + Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname)));
app.use("/uploads", express.static("uploads"));

// VERİTABANI BAŞLATMA
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    user_type TEXT,
    age INTEGER,
    avatar TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_username TEXT, 
    title TEXT,
    salary TEXT,
    location TEXT,
    phone TEXT,
    description TEXT,
    image_url TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER,
    sender_username TEXT,
    sender_age INTEGER,
    message_text TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

// GİRİŞ & KAYIT
app.post("/api/register", (req, res) => {
  const { username, password, user_type, age } = req.body;
  const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`;
  db.run("INSERT INTO users (username, password, user_type, age, avatar) VALUES (?,?,?,?,?)",
    [username, password, user_type, age, avatar], (err) => {
      if (err) return res.status(400).json({ error: "Bu isim zaten alınmış!" });
      res.json({ status: "ok", avatar });
    });
});

app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  db.get("SELECT * FROM users WHERE username = ? AND password = ?", [username, password], (err, row) => {
    if (err || !row) return res.status(401).json({ error: "Hatalı giriş!" });
    res.json(row);
  });
});

// PROFİL GÜNCELLEME
app.post("/api/update-profile", upload.single("new_avatar"), (req, res) => {
  const { old_username, new_username, new_age, current_avatar } = req.body;
  let avatarUrl = req.file ? `/uploads/${req.file.filename}` : current_avatar;
  
  db.run("UPDATE users SET username = ?, age = ?, avatar = ? WHERE username = ?",
    [new_username, new_age, avatarUrl, old_username], function(err) {
      if (err) return res.status(400).json({ error: "İsim kullanımda!" });
      res.json({ status: "success", newAvatar: avatarUrl });
    });
});

// İLAN İŞLEMLERİ (Silme Dahil)
app.get("/api/jobs", (req, res) => {
  db.all("SELECT * FROM jobs ORDER BY id DESC", (err, rows) => res.json(rows));
});

app.post("/api/jobs", upload.single("job_image"), (req, res) => {
  const { owner_username, title, salary, location, phone, description } = req.body;
  const img = req.file ? `/uploads/${req.file.filename}` : null;
  db.run("INSERT INTO jobs (owner_username, title, salary, location, phone, description) VALUES (?,?,?,?,?,?)",
    [owner_username, title, salary, location, phone, description], () => res.json({status:"ok"}));
});

app.delete("/api/jobs/:id", (req, res) => {
  db.run("DELETE FROM jobs WHERE id = ?", [req.params.id], () => res.json({status:"ok"}));
});

// MESAJLAŞMA SİSTEMİ
app.post("/api/messages", (req, res) => {
  const { job_id, sender_username, sender_age, message_text } = req.body;
  db.run("INSERT INTO messages (job_id, sender_username, sender_age, message_text) VALUES (?,?,?,?)",
    [job_id, sender_username, sender_age, message_text], () => res.json({status:"ok"}));
});

app.get("/api/messages/:job_id", (req, res) => {
  db.all("SELECT * FROM messages WHERE job_id = ? ORDER BY timestamp DESC", [req.params.job_id], (err, rows) => res.json(rows));
});

app.listen(3000, () => console.log("Sunucu 3000 portunda hazır."));