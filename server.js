const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
const multer = require("multer");

const app = express();
const db = new sqlite3.Database("./jobs.db"); // Dosya adını jobs.db olarak güncelledik

// --- RESİM YÜKLEME AYARLARI ---
const storage = multer.diskStorage({
  destination: "./uploads/",
  filename: function(req, file, cb){
    // Türkçe karakter sorununu önlemek ve benzersiz isim yapmak için:
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, "img-" + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

app.use(cors());
app.use(bodyParser.json());
// Statik dosyaları sun (HTML, CSS, JS ve Yüklenen Resimler)
app.use(express.static(path.join(__dirname)));
app.use("/uploads", express.static("uploads"));

// --- VERİTABANI KURULUMU ---
db.serialize(() => {
  // Kullanıcılar Tablosu
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    user_type TEXT, -- 'employer' (İş Veren) veya 'employee' (İş Arayan)
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
    receiver_username TEXT, -- Mesajın kime gittiğini tutmak için
    sender_age INTEGER,
    message_text TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

// --- KULLANICI İŞLEMLERİ ---

// Kayıt Ol
app.post("/api/register", (req, res) => {
  const { username, password, user_type, age } = req.body;
  // Varsayılan nötr avatar (gri insan silüeti)
  const defaultAvatar = "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png";
  
  db.run("INSERT INTO users (username, password, user_type, age, avatar) VALUES (?,?,?,?,?)", 
    [username, password, user_type, age, defaultAvatar], 
    function(err) {
      if (err) return res.status(500).json({ error: "Kullanıcı adı alınmış veya hata oluştu." });
      res.json({ id: this.lastID, username, user_type, age, avatar: defaultAvatar });
    });
});

// Giriş Yap
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  db.get("SELECT * FROM users WHERE username = ? AND password = ?", [username, password], (err, row) => {
    if (err || !row) return res.status(401).json({ error: "Kullanıcı adı veya şifre hatalı!" });
    res.json(row);
  });
});

// Profil Resmi Güncelleme
app.post("/api/update-avatar", upload.single("avatar"), (req, res) => {
  const { username } = req.body;
  const avatarUrl = req.file ? `/uploads/${req.file.filename}` : null;

  if (!avatarUrl) return res.status(400).json({ error: "Dosya yüklenemedi." });

  db.run("UPDATE users SET avatar = ? WHERE username = ?", [avatarUrl, username], function(err) {
    if (err) return res.status(500).json({ error: "Veritabanı hatası" });
    res.json({ avatar: avatarUrl });
  });
});

// --- İLAN İŞLEMLERİ ---

// İlan Ekle
app.post("/api/jobs", upload.single("job_image"), (req, res) => {
  const { owner_username, title, salary, location, phone, description, age_range } = req.body;
  const image_url = req.file ? `/uploads/${req.file.filename}` : null;

  db.run("INSERT INTO jobs (owner_username, title, salary, location, phone, description, age_range, image_url) VALUES (?,?,?,?,?,?,?,?)",
    [owner_username, title, salary, location, phone, description, age_range, image_url],
    function(err) { 
        if(err) return res.status(500).json({error: err.message});
        res.json({ id: this.lastID }); 
    });
});

// İlanları Getir
app.get("/api/jobs", (req, res) => {
  db.all("SELECT * FROM jobs ORDER BY id DESC", (err, rows) => {
      if(err) return res.status(500).json([]);
      res.json(rows);
  });
});

// İlan Sil
app.delete("/api/jobs/:id", (req, res) => {
    const id = req.params.id;
    // Güvenlik: Gerçek hayatta burada kullanıcının bu ilanın sahibi olup olmadığını kontrol etmek gerekir.
    // Şimdilik basitçe ID'ye göre siliyoruz.
    db.run("DELETE FROM jobs WHERE id = ?", id, function(err) {
        if (err) return res.status(500).json({ error: "Silinemedi" });
        res.json({ message: "Silindi" });
    });
});

// --- MESAJ İŞLEMLERİ ---

// Mesaj Gönder
app.post("/api/messages", (req, res) => {
  // receiver_username (İlan sahibini) bulmamız lazım önce
  const { job_id, sender_username, sender_age, message_text } = req.body;
  
  // İlan sahibini bul
  db.get("SELECT owner_username FROM jobs WHERE id = ?", [job_id], (err, row) => {
      if(err || !row) return res.status(404).json({error: "İlan bulunamadı"});
      
      const receiver_username = row.owner_username;

      db.run("INSERT INTO messages (job_id, sender_username, receiver_username, sender_age, message_text) VALUES (?,?,?,?,?)",
        [job_id, sender_username, receiver_username, sender_age, message_text],
        function(err) {
            if(err) return res.status(500).json({error: err.message});
            res.json({ success: true });
        });
  });
});

// Bana Gelen Mesajları Getir
app.get("/api/my-messages", (req, res) => {
    const username = req.query.username;
    db.all("SELECT * FROM messages WHERE receiver_username = ? ORDER BY id DESC", [username], (err, rows) => {
        if(err) return res.status(500).json([]);
        res.json(rows);
    });
});

// Sunucuyu Başlat
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Sunucu http://localhost:${PORT} adresinde çalışıyor.`);
});