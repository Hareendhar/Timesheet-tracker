import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import employeesRouter from "./employees.js";
import clientsRouter from "./clients.js";
import projectsRouter from "./projects.js";
import activitiesRouter from "./activities.js";
import timesheetsRouter from "./timesheets.js";
import notificationsRouter from "./notifications.js";
import auditLogsRouter from "./audit-logs.js";
import dashboardRouter from "./dashboard.js";
import searchRouter from "./search.js";
import exportRouter from "./export.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(employeesRouter);
router.use(clientsRouter);
router.use(projectsRouter);
router.use(activitiesRouter);
router.use(timesheetsRouter);
router.use(notificationsRouter);
router.use(auditLogsRouter);
router.use(dashboardRouter);
router.use(searchRouter);
router.use(exportRouter);

export default router;
