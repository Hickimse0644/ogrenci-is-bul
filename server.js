const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
const multer = require("multer"); // Dosya yükleme için

const app = express();
const db = new sqlite3.Database("./database.db");

// Resimlerin kaydedileceği klasörü ayarla
const storage = multer.diskStorage({
  destination: "./uploads/",
  filename: function(req, file, cb){
    cb(null, "img-" + Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname)));
app.use("/uploads", express.static("uploads")); // Yüklenen resimlere erişim

// --- VERİTABANI YAPISI ---
db.serialize(() => {
  // Kullanıcılar
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    user_type TEXT,
    age INTEGER,
    avatar TEXT
  )`);

  // İlanlar (image_url eklendi)
  db.run(`CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_username TEXT, 
    title TEXT,
    salary TEXT,
    location TEXT,
    phone TEXT,
    description TEXT,
    age_range TEXT,
    image_url TEXT
  )`);

  // Mesajlar
  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER,
    sender_username TEXT,
    sender_age INTEGER,
    message_text TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

// --- AUTH İŞLEMLERİ ---
app.post("/api/register", (req, res) => {
  const { username, password, user_type, age } = req.body;
  const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`;
  db.run("INSERT INTO users (username, password, user_type, age, avatar) VALUES (?, ?, ?, ?, ?)",
    [username, password, user_type, age, avatar], (err) => {
      if (err) return res.status(400).json({ error: "Bu kullanıcı adı alınmış!" });
      res.json({ status: "success", avatar });
    });
});

app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  db.get("SELECT * FROM users WHERE username = ? AND password = ?", [username, password], (err, row) => {
    if (err || !row) return res.status(401).json({ error: "Hatalı bilgiler!" });
    res.json(row);
  });
});

// --- İLAN İŞLEMLERİ (Resim Yüklemeli) ---
app.post("/api/jobs", upload.single("job_image"), (req, res) => {
  const { owner_username, title, salary, location, phone, description, age_range } = req.body;
  const image_url = req.file ? `/uploads/${req.file.filename}` : null;

  db.run("INSERT INTO jobs (owner_username, title, salary, location, phone, description, age_range, image_url) VALUES (?,?,?,?,?,?,?,?)",
    [owner_username, title, salary, location, phone, description, age_range, image_url],
    function(err) { res.json({ id: this.lastID }); });
});

app.get("/api/jobs", (req, res) => {
  db.all("SELECT * FROM jobs ORDER BY id DESC", (err, rows) => res.json(rows));
});

// --- MESAJLAR ---
app.post("/api/messages", (req, res) => {
  const { job_id, sender_username, sender_age, message_text } = req.body;
  db.run("INSERT INTO messages (job_id, sender_username, sender_age, message_text) VALUES (?,?,?,?)",
    [job_id, sender_username, sender_age, message_text], (err) => res.json({status:"ok"}));
});

app.get("/api/messages/:job_id", (req, res) => {
  db.all("SELECT * FROM messages WHERE job_id = ? ORDER BY timestamp DESC", [req.params.job_id], (err, rows) => res.json(rows));
});

app.listen(3000, () => console.log("Sunucu 3000 portunda aktif."));