require("dotenv").config();

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const app = express();
const pool = require("./src/db.js");
const crypto = require("crypto");
const session = require("express-session");
app.use(express.json());

app.use(
  cors({
    origin: "http://localhost:5173", // frontendisi osoite
    credentials: true,
  })
);

app.use(
  session({
    secret: "luokkavaraus-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false, // true tuotannossa HTTPS:n kanssa
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24 // 24h
    }
  })
);

const API_URL =
  process.env.API_URL ||
  "https://virtserver.swaggerhub.com/savonammattiopisto/Luokkavaraus/1.0.0";

/*
====================================
AUTH
====================================
*/

// POST /api/user/login
app.post("/user/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const [users] = await pool.query(
      "SELECT * FROM user WHERE email = ?",
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Virheellinen sähköposti tai salasana"
      });
    }

    const user = users[0];

    const passwordMatch = await bcrypt.compare(
      password,
      user.password
    );

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: "Virheellinen sähköposti tai salasana"
      });
    }

    // Tallennetaan käyttäjä sessioniin
    req.session.user = {
      id: user.id,
      name: user.name,
      email: user.email
    };

    res.json({
      success: true,
      message: "Login successful"
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Login failed"
    });
  }
});


// POST /api/user/register
app.post("/user/register", async (req, res) => {
    try {
        console.log("Register request body:", req.body);
         
        const { name, email, password } = req.body;
         
        if (!name || !email || !password) {
        return res.status(400).json({
        success: false,
        message: "Kaikki kentät ovat pakollisia"
        });
        }
         
        // Tarkista löytyykö käyttäjä jo
        const [existingUsers] = await pool.query(
        "SELECT id FROM user WHERE email = ?",
        [email]
        );
         
        if (existingUsers.length > 0) {
        return res.status(409).json({
        success: false,
        message: "Sähköposti on jo käytössä"
        });
        }
         
        // Salasanan hashays
        const hashedPassword = await bcrypt.hash(password, 10);
         
        // Lisää käyttäjä tietokantaan
        const [result] = await pool.query(
        `
        INSERT INTO user
        (name, email, password)
        VALUES (?, ?, ?)
        `,
        [name, email, hashedPassword]
        );
         
        res.status(201).json({
            success: true,
            message: "Käyttäjä luotu onnistuneesti",
            user: {
            id: result.insertId,
            name,
            email
            }
        });
         
    } catch (error) {
        console.error("REGISTER ERROR:", error);
         
        res.status(500).json({
            success: false,
            message: "Registration failed"
        });
    }
});

// GET /api/user
app.get("/user", (req, res) => {

  if (!req.session.user) {
    return res.status(401).json({
      success: false,
      message: "Not logged in"
    });
  }

  res.json(req.session.user);
});

app.post("/user/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");

    res.json({
      success: true,
      message: "Logged out"
    });
  });
});

/*
====================================
CLASSROOM
====================================
*/

// GET /api/classroom/list
app.get("/classroom/list", async (req, res) => {
  try {
    const {
      people,
      equipment,
      startTime,
      finishTime,
    } = req.query;

    let sql = `
      SELECT *
      FROM classroom
      WHERE 1=1
    `;

    const params = [];

    if (people && people > 0) {
      sql += " AND capacity >= ?";
      params.push(people);
    }

    if (equipment && equipment.length > 0) {
      sql += " AND equipment LIKE ?";
      params.push(`%${equipment}%`);
    }

    const [classrooms] = await pool.query(sql, params);

    res.status(200).json(classrooms);

  } catch (error) {
    console.error("CLASSROOM ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch classrooms"
    });
  }
});

/*
====================================
RESERVATION
====================================
*/

// GET /api/reservation
app.get("/reservation", async (req, res) => {
  try {

    res.status(200).json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({
      success: false,
      message:
        error.response?.data?.message ||
        "Failed to fetch reservations",
    });
  }
});

/*
====================================
HEALTH CHECK
====================================
*/

app.get("/", (req, res) => {
  res.json({
    success: true,
    service: "Luokkavaraus API",
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
``