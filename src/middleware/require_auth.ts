import { Request, Response } from "express";
import * as pg from "pg";

async function require_auth(req: Request, res: Response, next: Function) {
  if (!req.cookies.session) {
    return res.redirect("/");
  }

  // TODO: Get user details from cache here
  const db = req.app.get("db") as pg.Pool;
  const details = await db.query("select * from sessions where id=$1", [
    req.cookies.session,
  ]);
  if (details.rowCount !== 1) {
    res.clearCookie("session");
    return res.redirect("/");
  }

  (req as any).user = JSON.parse(details.rows[0].content);
  next();
}

export default require_auth;
