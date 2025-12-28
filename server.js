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

// Veritabanına 'age_range' sütununu ekledik
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
});

// Güvenlik: Basit bir koruma katmanı (Sadece JSON bekler)
app.use((req, res, next) => {
  if (req.method === 'POST' && !req.is('json')) {
    return res.status(400).send('Sadece JSON kabul edilir.');
  }
  next();
});

app.get("/api/jobs", (req, res) => {
  db.all("SELECT * FROM jobs ORDER BY id DESC", (err, rows) => {
    res.json(rows);
  });
});

app.post("/api/jobs", (req, res) => {
  const { title, salary, location, phone, description, age_range } = req.body;
  // Güvenlik: Basit boş veri kontrolü
  if(!title || !phone) return res.status(400).json({error: "Eksik alan!"});

  db.run(
    "INSERT INTO jobs (title, salary, location, phone, description, age_range) VALUES (?,?,?,?,?,?)",
    [title, salary, location, phone, description, age_range],
    function(err) {
      res.json({ id: this.lastID });
    }
  );
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server aktif: ${PORT}`));