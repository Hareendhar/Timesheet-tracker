export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface IEmployeeRepository {
  findAll(params: {
    page?: number;
    pageSize?: number;
    search?: string;
    role?: string;
    status?: string;
    department?: string;
    managerId?: string;
  }): Promise<PaginatedResult<any>>;
  findById(id: string): Promise<any | null>;
  findByEmail(email: string): Promise<any | null>;
  findByEmployeeId(employeeId: string): Promise<any | null>;
  create(data: any): Promise<any>;
  update(id: string, data: any): Promise<any | null>;
  delete(id: string): Promise<boolean>;
  bulkCreate(rows: any[]): Promise<{ success: any[]; errors: any[] }>;
  getProfile(id: string): Promise<any | null>;
  getDirectReports(managerId: string): Promise<any>;
}

export interface IClientRepository {
  findAll(params: {
    page?: number;
    pageSize?: number;
    status?: string;
    search?: string;
  }): Promise<PaginatedResult<any>>;
  findById(id: string): Promise<any | null>;
  create(data: any): Promise<any>;
  update(id: string, data: any): Promise<any | null>;
  delete(id: string): Promise<boolean>;
}

export interface IProjectRepository {
  findAll(params: {
    page?: number;
    pageSize?: number;
    status?: string;
    clientId?: string;
    search?: string;
  }): Promise<PaginatedResult<any>>;
  findById(id: string): Promise<any | null>;
  create(data: any): Promise<any>;
  update(id: string, data: any): Promise<any | null>;
  delete(id: string): Promise<boolean>;
}

export interface IActivityRepository {
  findAll(): Promise<any[]>;
  findById(id: string): Promise<any | null>;
  create(data: any): Promise<any>;
  update(id: string, data: any): Promise<any | null>;
  delete(id: string): Promise<boolean>;
}

export interface ITimesheetRepository {
  findAll(params: {
    page?: number;
    pageSize?: number;
    employeeId?: string;
    status?: string;
    weekStartDate?: string;
    managerId?: string;
  }): Promise<PaginatedResult<any>>;
  findById(id: string): Promise<any | null>;
  findByEmployeeAndWeek(employeeId: string, weekStartDate: string): Promise<any | null>;
  create(data: any, rows: any[]): Promise<any>;
  update(id: string, rows: any[]): Promise<any | null>;
  submit(id: string): Promise<any | null>;
  approve(id: string, approvedBy: string, comment?: string): Promise<any | null>;
  reject(id: string, comment: string): Promise<any | null>;
  bulkAction(ids: string[], action: "approve" | "reject", approvedBy: string, comment?: string): Promise<{ processed: number; succeeded: number; failed: number }>;
  copyFromPreviousWeek(employeeId: string, sourceWeekStartDate: string, targetWeekStartDate: string): Promise<any>;
  getStatusBreakdown(): Promise<any>;
  getRecentActivity(limit: number): Promise<any[]>;
  getComplianceOverview(): Promise<any[]>;
}

export interface INotificationRepository {
  findAll(params: { userId: string; unreadOnly?: boolean; page?: number; pageSize?: number }): Promise<PaginatedResult<any> & { unreadCount: number }>;
  create(data: any): Promise<any>;
  markRead(id: string, userId: string): Promise<boolean>;
  markAllRead(userId: string): Promise<void>;
}

export interface IAuditRepository {
  findAll(params: {
    page?: number;
    pageSize?: number;
    userId?: string;
    action?: string;
    role?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<PaginatedResult<any>>;
  create(data: any): Promise<any>;
  findAll_export(params: { dateFrom?: string; dateTo?: string }): Promise<any[]>;
}
