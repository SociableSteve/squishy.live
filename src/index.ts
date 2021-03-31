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
    id: string;
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
  let last_message_time = Date.now();
  const social_decay = [600, 300, 60, 30];
  const ticker = setInterval(() => {
    if (pet_info) {
      if (Math.random() < 0.05)
        pet_info.happiness = Math.max(1, pet_info.happiness - 1);

      if (
        (Date.now() - last_message_time) / 1000 >
        social_decay[pet_info.social - 2]
      ) {
        pet_info.social = Math.max(1, pet_info.social - 1);
        last_message_time = Date.now();
      }
      pet_info.hunger = 5; // Math.floor(Math.random() * 4) + 1;

      if (
        pet_info.hunger > 3 &&
        pet_info.social > 3 &&
        pet_info.happiness > 3
      ) {
        pet_info.health = Math.min(pet_info.health + 1, 5);
      } else if (
        pet_info.hunger === 1 ||
        pet_info.social === 1 ||
        pet_info.happiness === 1
      ) {
        pet_info.health = Math.max(pet_info.health - 1, 1);
      }
      saveStats();
    }
  }, 5000);

  function saveStats() {
    db.query(
      "update pets set happiness=$1, health=$2, social=$3, hunger=$4 where id=$5",
      [
        pet_info.happiness,
        pet_info.health,
        pet_info.social,
        pet_info.hunger,
        pet_info.id,
      ]
    );
    sendStats();
  }

  const users_seen = new Set();

  socket.on("message", async (data) => {
    pet_info = (await db.query("select * from pets where id=$1", [data]))
      .rows[0];

    let c = new tmi.Client({ channels: [pet_info.name] });
    c.on("message", (_channel, userstate) => {
      if (!users_seen.has(userstate["user-id"])) {
        users_seen.add(userstate["user-id"]);
        socket.send(
          JSON.stringify({ type: "seen", username: userstate["display-name"] })
        );
      }
      pet_info.social = Math.min(pet_info.social + 1, 5);
      pet_info.happiness = Math.min(pet_info.happiness + 1, 5);
      last_message_time = Date.now();
      saveStats();
    });
    c.on("cheer", (_channel, userstate) => {
      socket.send(
        JSON.stringify({
          type: "bits",
          username: userstate["display-name"],
          amount: userstate.bits,
        })
      );
      pet_info.happiness = Math.min(pet_info.happiness + 1, 5);
      saveStats();
    });
    c.on("ban", (_channel, username) => {
      socket.send(JSON.stringify({ type: "ban", username }));
      pet_info.happiness = Math.max(pet_info.happiness - 2, 1);
      saveStats();
    });
    c.connect();
    sendStats();
  });
  socket.on("close", () => {
    clearInterval(ticker);
  });
});
