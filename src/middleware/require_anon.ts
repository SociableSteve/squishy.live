import { Request, Response } from "express";

function require_anon(req: Request, res: Response, next: Function) {
  if (req.cookies.session) {
    return res.redirect("/dashboard");
  }
  next();
}

export default require_anon;
