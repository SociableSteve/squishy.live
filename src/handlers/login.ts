import axios from "axios";
import * as pg from "pg";
import * as express from "express";
import * as uuid from "uuid";

async function login(req: express.Request, res: express.Response) {
  try {
    const response = await axios.post(
      "https://id.twitch.tv/oauth2/token",
      {},
      {
        params: {
          client_id: process.env.TWITCH_CLIENT_ID,
          client_secret: process.env.TWITCH_CLIENT_SECRET,
          code: req.query.code,
          grant_type: "authorization_code",
          redirect_uri: `https://${req.hostname}/login`,
        },
      }
    );

    // Fetch user details here
    const user = await axios.get("https://api.twitch.tv/helix/users", {
      headers: {
        Authorization: `Bearer ${response.data.access_token}`,
        "Client-Id": process.env.TWITCH_CLIENT_ID,
      },
    });
    const user_details = user.data.data[0];

    // Add user to database is not already existing
    const db = req.app.get("db") as pg.Pool;
    // UUID | channel_id
    await db.query(
      "insert into pets values ($1, $2, $3) on conflict do nothing",
      [uuid.v4(), user_details.id, user_details.login]
    );
    const id_results = await db.query("select id from pets where channel=$1", [
      user_details.id,
    ]);

    // Cache user details here
    // Session ID | user details
    user_details.pet_id = id_results.rows[0].id;
    db.query("insert into sessions values ($1, $2)", [
      response.data.access_token,
      JSON.stringify(user_details),
    ]);

    res.cookie("session", response.data.access_token, {
      secure: true,
      httpOnly: true,
      sameSite: true,
    });
  } catch (e) {
    console.log(e);
    return res.redirect("/");
  }

  res.redirect("/dashboard");
}

export default login;

// TODO: Add weight!
// TODO: Styling - front end
