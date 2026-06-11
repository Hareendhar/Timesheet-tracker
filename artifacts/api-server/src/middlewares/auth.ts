import type { Request, Response, NextFunction } from "express";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!(req.session as any)?.user) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  next();
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req.session as any)?.user;
    if (!user) return res.status(401).json({ error: "Not authenticated" });
    if (!roles.includes(user.role)) return res.status(403).json({ error: "Forbidden" });
    next();
  };
}

export function getClientIp(req: Request): string {
  return (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
}
