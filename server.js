const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
const multer = require("multer");

const app = express();
const db = new sqlite3.Database("./jobs.db");

// --- RESİM YÜKLEME AYARLARI ---
const storage = multer.diskStorage({
  destination: "./uploads/",
  filename: function(req, file, cb){
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, "img-" + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname)));
app.use("/uploads", express.static("uploads"));

// --- VERİTABANI KURULUMU ---
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
    age_range TEXT,
    image_url TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER,
    sender_username TEXT,
    receiver_username TEXT,
    sender_age INTEGER,
    message_text TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

// --- KULLANICI İŞLEMLERİ ---

app.post("/api/register", (req, res) => {
  const { username, password, user_type, age } = req.body;
  const defaultAvatar = "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png";
  
  db.run("INSERT INTO users (username, password, user_type, age, avatar) VALUES (?,?,?,?,?)", 
    [username, password, user_type, age, defaultAvatar], 
    function(err) {
      if (err) return res.status(500).json({ error: "Kullanıcı adı alınmış veya hata oluştu." });
      res.json({ id: this.lastID, username, user_type, age, avatar: defaultAvatar });
    });
});

app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  db.get("SELECT * FROM users WHERE username = ? AND password = ?", [username, password], (err, row) => {
    if (err || !row) return res.status(401).json({ error: "Kullanıcı adı veya şifre hatalı!" });
    res.json(row);
  });
});

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

app.post("/api/jobs", upload.single("job_image"), (req, res) => {
  const { owner_username, title, salary, location, phone, description } = req.body;
  const image_url = req.file ? `/uploads/${req.file.filename}` : null;

  db.run("INSERT INTO jobs (owner_username, title, salary, location, phone, description, image_url) VALUES (?,?,?,?,?,?,?)",
    [owner_username, title, salary, location, phone, description, image_url],
    function(err) { 
        if(err) return res.status(500).json({error: err.message});
        res.json({ id: this.lastID }); 
    });
});

// İlan Güncelleme (Düzenleme)
app.put("/api/jobs/:id", upload.single("job_image"), (req, res) => {
    const { title, salary, location, phone, description } = req.body;
    const id = req.params.id;
    let query = "UPDATE jobs SET title=?, salary=?, location=?, phone=?, description=? WHERE id=?";
    let params = [title, salary, location, phone, description, id];

    if(req.file) {
        query = "UPDATE jobs SET title=?, salary=?, location=?, phone=?, description=?, image_url=? WHERE id=?";
        params = [title, salary, location, phone, description, `/uploads/${req.file.filename}`, id];
    }

    db.run(query, params, function(err) {
        if(err) return res.status(500).json({error: err.message});
        res.json({ success: true });
    });
});

app.get("/api/jobs", (req, res) => {
  db.all("SELECT * FROM jobs ORDER BY id DESC", (err, rows) => {
      if(err) return res.status(500).json([]);
      res.json(rows);
  });
});

app.delete("/api/jobs/:id", (req, res) => {
    db.run("DELETE FROM jobs WHERE id = ?", req.params.id, function(err) {
        if (err) return res.status(500).json({ error: "Silinemedi" });
        res.json({ message: "Silindi" });
    });
});

// --- MESAJ İŞLEMLERİ ---

app.post("/api/messages", (req, res) => {
  const { job_id, sender_username, sender_age, message_text } = req.body;
  
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

app.get("/api/my-messages", (req, res) => {
    const username = req.query.username;
    // Mesajları getirirken ilan başlığını da JOIN ile çekiyoruz ki kullanıcı hangi ilana mesaj geldiğini görsün
    const query = `
        SELECT m.*, j.title as job_title 
        FROM messages m 
        LEFT JOIN jobs j ON m.job_id = j.id 
        WHERE m.receiver_username = ? 
        ORDER BY m.id DESC`;

    db.all(query, [username], (err, rows) => {
        if(err) return res.status(500).json([]);
        res.json(rows);
    });
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Sunucu http://localhost:${PORT} adresinde çalışıyor.`);
});