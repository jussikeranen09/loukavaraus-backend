require("dotenv").config();

const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();

app.use(express.json());

app.use(
  cors({
    origin: "http://localhost:5173", // frontendisi osoite
    credentials: true,
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
    const response = await axios.post(
      `${API_URL}/user/login`,
      req.body,
      {
        withCredentials: true,
      }
    );

    res.status(200).json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({
      success: false,
      message: error.response?.data?.message || "Login failed",
    });
  }
});

// POST /api/user/register
app.post("/user/register", async (req, res) => {
  try {
    console.log("Register request body:", req.body); // Log the request body for debugging

    res.status(201).json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({
      success: false,
      message: error.response?.data?.message || "Registration failed",
    });
  }
});

// GET /api/user
app.get("/user", async (req, res) => {
  try {
    const response = await axios.get(
      `${API_URL}/user`,
      {
        withCredentials: true,
        headers: {
          cookie: req.headers.cookie || "",
        },
      }
    );

    res.status(200).json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({
      success: false,
      message: error.response?.data?.message || "Failed to fetch user",
    });
  }
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

    const response = await axios.get(
      `${API_URL}/classroom/list`,
      {
        params: {
          people,
          equipment,
          startTime,
          finishTime,
        },
      }
    );

    res.status(200).json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({
      success: false,
      message: error.response?.data?.message || "Failed to fetch classrooms",
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
    const response = await axios.get(
      `${API_URL}/reservation`,
      {
        withCredentials: true,
        headers: {
          cookie: req.headers.cookie || "",
        },
      }
    );

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