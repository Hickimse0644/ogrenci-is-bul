// BASIT MVP – Öğrenci & İşveren İş Bulma Web Uygulaması
// Backend: Node.js + Express + SQLite
// Frontend: HTML (ayrı dosya olarak düşün)

/* =========================
   1) KURULUM
   =========================
   1. Bilgisayarına Node.js kur
   2. Proje klasörü oluştur
   3. Terminalde:
      npm init -y
      npm install express sqlite3 cors body-parser
   4. Bu dosyayı server.js olarak kaydet
   5. node server.js ile çalıştır
*/

const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const bodyParser = require("body-parser");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// =========================
// VERİTABANI
// =========================
const db = new sqlite3.Database("jobs.db");

db.run(`CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT,
  salary TEXT,
  location TEXT,
  phone TEXT,
  email TEXT,
  description TEXT
)`);

// =========================
// API ENDPOINTS
// =========================

// İş ilanı ekle
app.post("/jobs", (req, res) => {
  const { title, salary, location, phone, email, description } = req.body;
  db.run(
    "INSERT INTO jobs (title, salary, location, phone, email, description) VALUES (?,?,?,?,?,?)",
    [title, salary, location, phone, email, description],
    () => res.json({ status: "ok" })
  );
});

// İş ilanlarını getir
app.get("/jobs", (req, res) => {
  db.all("SELECT * FROM jobs ORDER BY id DESC", (err, rows) => {
    res.json(rows);
  });
});

// =========================
// SERVER
// =========================
app.listen(3000, () => {
  console.log("Server çalışıyor: http://localhost:3000");
});

