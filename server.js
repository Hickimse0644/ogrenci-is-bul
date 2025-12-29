const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
const multer = require("multer");
const fs = require("fs"); // Klasör kontrolü için gerekli

const app = express();
const db = new sqlite3.Database("./database.db");

// --- ÖNEMLİ: Uploads klasörü yoksa oluştur (Hata önleyici) ---
const uploadDir = './uploads';
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir);
}

// Resimlerin kaydedileceği ayarlar
const storage = multer.diskStorage({
  destination: "./uploads/",
  filename: function(req, file, cb){
    // Türkçe karakter sorununu önlemek ve benzersiz isim için:
    const uniqueName = "img-" + Date.now() + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

const upload = multer({ storage: storage });

app.use(cors());
app.use(bodyParser.json());
// Statik dosyaları sun (HTML, CSS, JS)
app.use(express.static(path.join(__dirname)));
// Yüklenen resimleri dışarıya aç
app.use("/uploads", express.static("uploads"));

// --- VERİTABANI YAPISI ---
db.serialize(() => {
  // Kullanıcılar Tablosu
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    user_type TEXT,
    age INTEGER,
    avatar TEXT
  )`);

  // İlanlar Tablosu
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

  // Mesajlar Tablosu
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
  // Varsayılan avatar
  const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`;
  
  db.run("INSERT INTO users (username, password, user_type, age, avatar) VALUES (?, ?, ?, ?, ?)",
    [username, password, user_type, age, avatar], (err) => {
      if (err) return res.status(400).json({ error: "Bu kullanıcı adı alınmış veya hata oluştu!" });
      res.json({ status: "success", avatar });
    });
});

app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  db.get("SELECT * FROM users WHERE username = ? AND password = ?", [username, password], (err, row) => {
    if (err || !row) return res.status(401).json({ error: "Kullanıcı adı veya şifre hatalı!" });
    res.json(row);
  });
});

// --- İLAN İŞLEMLERİ ---

// İlan Ekleme (Resim Yüklemeli - DÜZELTİLDİ)
app.post("/api/jobs", upload.single("job_image"), (req, res) => {
  const { owner_username, title, salary, location, phone, description, age_range } = req.body;
  // Eğer dosya yüklendiyse yolunu al, yüklenmediyse null yap
  const image_url = req.file ? `/uploads/${req.file.filename}` : null;

  db.run("INSERT INTO jobs (owner_username, title, salary, location, phone, description, age_range, image_url) VALUES (?,?,?,?,?,?,?,?)",
    [owner_username, title, salary, location, phone, description, age_range, image_url],
    function(err) { 
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID, image_url: image_url }); 
    });
});

// İlanları Getir
app.get("/api/jobs", (req, res) => {
  db.all("SELECT * FROM jobs ORDER BY id DESC", (err, rows) => {
      if(err) return res.json([]);
      res.json(rows);
  });
});

// İlan Silme (Ekstra Özellik)
app.delete("/api/jobs/:id", (req, res) => {
    const id = req.params.id;
    db.run("DELETE FROM jobs WHERE id = ?", id, function(err) {
        if (err) return res.status(500).json({ error: "Silinemedi" });
        res.json({ status: "ok" });
    });
});

// --- MESAJLAR ---
app.post("/api/messages", (req, res) => {
  const { job_id, sender_username, sender_age, message_text } = req.body;
  db.run("INSERT INTO messages (job_id, sender_username, sender_age, message_text) VALUES (?,?,?,?)",
    [job_id, sender_username, sender_age, message_text], (err) => res.json({status:"ok"}));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Sunucu ${PORT} portunda çalışıyor.`));