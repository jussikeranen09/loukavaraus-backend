require("dotenv").config();

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const app = express();
const pool = require("./src/db.js");
const crypto = require("crypto");
const session = require("express-session");
app.use(express.json());

app.use(cors({
    origin: [
        'http://localhost:5173',
        'http://185.176.94.192:30010'
    ],
    credentials: true
}));

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

        if (people && Number(people) > 0) {
            sql += " AND maxPeople >= ?";
            params.push(Number(people));
        }

        if (equipment) {
            sql += " AND equipment LIKE ?";
            params.push(`%${equipment}%`);
        }

        const [classrooms] = await pool.query(sql, params);

        const result = classrooms.map((classroom) => ({
            ...classroom,
            equipment: classroom.equipment
                ? classroom.equipment.split(",").map((item) => item.trim())
                : [],
        }));

        res.status(200).json(result);
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

// GET /reservation
app.get("/reservation/my", async (req, res) => {

  try{

    if (!req.session.user) {
      res.status(401).json({
        success: false,
        message: "Not logged in"
      });
      return;
    }

    const [result] = await pool.query(
      `
          SELECT
              varaus.*,
              classroom.id AS joined_classroom_id,
              classroom.name AS classroom_name,
              classroom.maxPeople AS classroom_maxPeople,
              classroom.equipment AS classroom_equipment
          FROM varaus
          JOIN classroom
              ON classroom.id = varaus.classroom_id
          WHERE varaus.user_id = ?
      `,
      [req.session.user.id]
  );

  const reservations = result.map(({
      joined_classroom_id,
      classroom_name,
      classroom_maxPeople,
      classroom_equipment,
      ...reservation
  }) => ({
      ...reservation,
      startAt: reservation.startDateTime,
      finishAt: reservation.finishDateTime,
      peopleCount: reservation.people,
      classroom: {
          id: joined_classroom_id,
          name: classroom_name,
          maxPeople: classroom_maxPeople,
          equipment: classroom_equipment
      }
  }));


    console.log(reservations)

    res.status(200).json(reservations);
  } catch (e) {
    res.status(500).json({ error: e })
  }
});

app.post("/reservation", async (req, res) => {

  try{
    const reservation = req.body;

    if (!req.session.user) {
      res.status(401).json({
        success: false,
        message: "Not logged in"
      });
      return;
    }

    const [result] = await pool.query(
      `
        INSERT INTO varaus 
        (user_id, classroom_id, people, startDateTime, finishDateTime)
        VALUES (?, ?, ?, ?, ?)
      `,
      [
        req.session.user.id, 
        reservation.classroomId,
        reservation.peopleCount, 
        new Date(reservation.startAt)
          .toISOString()
          .slice(0, 19)
          .replace("T", " "),

        new Date(reservation.finishAt)
          .toISOString()
          .slice(0, 19)
          .replace("T", " ")
      ]
    );
    
    res.status(201).json({
      success: true,
      message: "Käyttäjä luotu onnistuneesti",
      reservation: {
        id: result.insertId
      }
    });
  } catch (e) {
    console.log(e)
    res.status(500).json({ error: e })
  }
});

app.put("/reservation/:id", async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({
                success: false,
                message: "Not logged in"
            });
        }

        const { id } = req.params;
        const { classroomId, startAt, finishAt, peopleCount } = req.body;

        if (!classroomId || !startAt || !finishAt || peopleCount == null) {
            return res.status(400).json({
                success: false,
                message: "All fields are required"
            });
        }

        const startDate = new Date(startAt);
        const finishDate = new Date(finishAt);

        if (
            Number.isNaN(startDate.getTime()) ||
            Number.isNaN(finishDate.getTime()) ||
            finishDate <= startDate
        ) {

            console.error("Invalid reservation dates");
            return res.status(400).json({
                success: false,
                message: "Invalid reservation dates"
            });
        }

        const [result] = await pool.query(
            `
                UPDATE varaus
                SET
                    classroom_id = ?,
                    startDateTime = ?,
                    finishDateTime = ?,
                    people = ?
                WHERE id = ? AND user_id = ?
            `,
            [
                classroomId,
                startDate.toISOString().slice(0, 19).replace("T", " "),
                finishDate.toISOString().slice(0, 19).replace("T", " "),
                peopleCount,
                id,
                req.session.user.id
            ]
        );

        if (result.affectedRows === 0) {

            console.error("Reservation not found");

            return res.status(404).json({
                success: false,
                message: "Reservation not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Reservation updated successfully"
        });
    } catch (e) {
        console.error(e);

        return res.status(500).json({
            success: false,
            message: "Failed to update reservation"
        });
    }
});

app.get("/reservation/:id", async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({
                success: false,
                message: "Not logged in"
            });
        }

        const [result] = await pool.query(
            `
                SELECT
                    varaus.*,
                    classroom.id AS joined_classroom_id,
                    classroom.name AS classroom_name,
                    classroom.maxPeople AS classroom_maxPeople,
                    classroom.equipment AS classroom_equipment
                FROM varaus
                JOIN classroom
                    ON classroom.id = varaus.classroom_id
                WHERE varaus.id = ? AND varaus.user_id = ?
            `,
            [req.params.id, req.session.user.id]
        );

        if (result.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Reservation not found"
            });
        }

        const {
            joined_classroom_id,
            classroom_name,
            classroom_maxPeople,
            classroom_equipment,
            ...reservation
        } = result[0];

        return res.status(200).json({
            ...reservation,
            startAt: reservation.startDateTime,
            finishAt: reservation.finishDateTime,
            peopleCount: reservation.people,
            classroom: {
                id: joined_classroom_id,
                name: classroom_name,
                maxPeople: classroom_maxPeople,
                equipment: classroom_equipment
            }
        });
    } catch (e) {
        console.error(e);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch reservation"
        });
    }
});

// DELETE /reservation/:id
app.delete("/reservation/:id", async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({
                success: false,
                message: "Not logged in"
            });
        }

        const { id } = req.params;

        const [result] = await pool.query(
            `
                DELETE FROM varaus
                WHERE id = ? AND user_id = ?
            `,
            [id, req.session.user.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Reservation not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Reservation deleted successfully"
        });
    } catch (e) {
        console.error(e);

        return res.status(500).json({
            success: false,
            message: "Failed to delete reservation"
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