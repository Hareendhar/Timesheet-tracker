import { PostgresEmployeeRepository } from "./postgres/employee-repository.js";
import { PostgresClientRepository } from "./postgres/client-repository.js";
import { PostgresProjectRepository } from "./postgres/project-repository.js";
import { PostgresActivityRepository } from "./postgres/activity-repository.js";
import { PostgresTimesheetRepository } from "./postgres/timesheet-repository.js";
import { PostgresNotificationRepository } from "./postgres/notification-repository.js";
import { PostgresAuditRepository } from "./postgres/audit-repository.js";

export const employeeRepo = new PostgresEmployeeRepository();
export const clientRepo = new PostgresClientRepository();
export const projectRepo = new PostgresProjectRepository();
export const activityRepo = new PostgresActivityRepository();
export const timesheetRepo = new PostgresTimesheetRepository();
export const notificationRepo = new PostgresNotificationRepository();
export const auditRepo = new PostgresAuditRepository();
