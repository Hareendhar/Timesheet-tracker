(async () => {
  try {
    const { default: dbModule } = await import("@workspace/db");

    const { db, employeesTable } = dbModule;

    const employees = await db.select().from(employeesTable);

    console.log("✅ Connected to PostgreSQL");
    console.log(employees);
  } catch (err) {
    console.error(err);
  }
})();