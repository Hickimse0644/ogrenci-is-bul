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
    description TEXT,
    location TEXT,
    image TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
    db.run("INSERT INTO users (username, password, user_type, age) VALUES (?, ?, ?, ?)", 
    [username, password, user_type, age], (err) => {
        if (err) return res.status(400).json({ error: "Kullanıcı adı alınmış" });
        res.json({ message: "Kayıt başarılı" });
    });
});

app.post("/api/login", (req, res) => {
    const { username, password } = req.body;
    db.get("SELECT * FROM users WHERE username = ? AND password = ?", [username, password], (err, row) => {
        if (err || !row) return res.status(401).json({ error: "Hatalı giriş" });
        res.json(row);
    });
});

// --- İLAN İŞLEMLERİ ---
app.post("/api/jobs", upload.single('image'), (req, res) => {
    const { owner_username, title, salary, description, location } = req.body;
    const imagePath = req.file ? "/uploads/" + req.file.filename : "";
    
    db.run("INSERT INTO jobs (owner_username, title, salary, description, location, image) VALUES (?, ?, ?, ?, ?, ?)",
    [owner_username, title, salary, description, location, imagePath], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID, message: "İlan yayınlandı" });
    });
});

app.get("/api/jobs", (req, res) => {
    db.all("SELECT * FROM jobs ORDER BY created_at DESC", [], (err, rows) => {
        res.json(rows);
    });
});

app.delete("/api/jobs/:id", (req, res) => {
    const { id } = req.params;
    const { username } = req.body;
    db.run("DELETE FROM jobs WHERE id = ? AND owner_username = ?", [id, username], function(err) {
        if (err) return res.status(500).json({ error: "Silinemedi" });
        res.json({ message: "İlan silindi" });
    });
});

app.put("/api/jobs/:id", (req, res) => {
    const { title, salary, description, location } = req.body;
    const { id } = req.params;
    db.run("UPDATE jobs SET title=?, salary=?, description=?, location=? WHERE id=?", 
    [title, salary, description, location, id], (err) => {
        if(err) return res.status(500).json({error: "Güncellenemedi"});
        res.json({message: "Güncellendi"});
    });
});

// --- MESAJ İŞLEMLERİ ---
app.post("/api/messages", (req, res) => {
  const { job_id, sender_username, sender_age, message_text } = req.body;
  db.get("SELECT owner_username FROM jobs WHERE id = ?", [job_id], (err, row) => {
      if(err || !row) return res.status(404).json({error: "İlan bulunamadı"});
      const receiver_username = row.owner_username;
      db.run("INSERT INTO messages (job_id, sender_username, receiver_username, sender_age, message_text) VALUES (?,?,?,?,?)",
        [job_id, sender_username, receiver_username, sender_age, message_text], (err) => {
            if(err) return res.status(500).json({error: err.message});
            res.json({ success: true });
        });
  });
});

app.get("/api/my-messages", (req, res) => {
    const username = req.query.username;
    const query = `
        SELECT m.*, j.title as job_title 
        FROM messages m 
        LEFT JOIN jobs j ON m.job_id = j.id 
        WHERE m.receiver_username = ? OR m.sender_username = ? 
        ORDER BY m.created_at DESC`;
    db.all(query, [username, username], (err, rows) => {
        if(err) return res.status(500).json({error: err.message});
        res.json(rows);
    });
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));