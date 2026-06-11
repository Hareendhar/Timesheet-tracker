import type { Request, Response, NextFunction } from "express";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!(req.session as any)?.user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req.session as any)?.user;
    if (!user) { res.status(401).json({ error: "Not authenticated" }); return; }
    if (!roles.includes(user.role)) { res.status(403).json({ error: "Forbidden" }); return; }
    next();
  };
}

export function getClientIp(req: Request): string {
  return (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
}
