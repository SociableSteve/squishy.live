import * as dotenv from "dotenv";
dotenv.config();

import * as http from "http";
import * as pg from "pg";
const db = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

import * as express from "express";

const app = express();
app.set("view engine", "ejs");
app.set("db", db);
app.use(express.static("public"));

import * as cookieParser from "cookie-parser";
app.use(cookieParser());

import login from "./handlers/login";
import require_anon from "./middleware/require_anon";

app.get("/", require_anon, (req, res) =>
  res.render("index", {
    client_id: process.env.TWITCH_CLIENT_ID,
    redirect_uri: `https://${req.hostname}/login`,
  })
);
app.get("/login", require_anon, login);

import require_auth from "./middleware/require_auth";
app.get("/dashboard", require_auth, (req, res) => {
  const user = (req as any).user;
  res.render("dashboard", {
    base_url: `https://${req.hostname}`,
    pet_id: user.pet_id,
    display_name: user.display_name,
  });
});

app.get("/overlay/:pet_id", async (req, res) => {
  // Check if this pet actually exists!
  const db = req.app.get("db") as pg.Pool;
  const pet_data = await db.query("select * from pets where id=$1", [
    req.params.pet_id,
  ]);

  if (pet_data.rowCount !== 1) {
    return res.sendStatus(404);
  }

  res.render("pet", { pet_id: req.params.pet_id });
});

const server = http.createServer(app);
server.listen(process.env.PORT || 3000);

import * as tmi from "tmi.js";
import * as ws from "ws";
const wss = new ws.Server({ server });
wss.on("connection", (socket) => {
  let pet_info: {
    name: string;
    happiness: number;
    health: number;
    social: number;
    hunger: number;
  };
  function sendStats() {
    socket.send(
      JSON.stringify({
        type: "stats",
        stats: {
          Happiness: pet_info.happiness,
          Health: pet_info.health,
          Social: pet_info.social,
          Hunger: pet_info.hunger,
        },
      })
    );
  }
  const ticker = setInterval(() => {
    if (pet_info) {
      pet_info.happiness = Math.floor(Math.random() * 4) + 1;
      pet_info.health = Math.floor(Math.random() * 4) + 1;
      pet_info.social = Math.floor(Math.random() * 4) + 1;
      pet_info.hunger = Math.floor(Math.random() * 4) + 1;
      sendStats();
    }
  }, 5000);

  const users_seen = new Set();

  socket.on("message", async (data) => {
    pet_info = (await db.query("select * from pets where id=$1", [data]))
      .rows[0];

    let c = new tmi.Client({ channels: [pet_info.name] });
    c.on("message", (channel, userstate, message) => {
      if (!users_seen.has(userstate.id)) {
        users_seen.add(userstate.id);
        socket.send(
          JSON.stringify({ type: "seen", username: userstate["display-name"] })
        );
      }
    });
    c.connect();
    sendStats();
  });
  socket.on("close", () => {
    clearInterval(ticker);
  });
});
