const fs = require("fs");
const path = require("path");

function loadJson(name) {
  const filePath = path.join(__dirname, "..", "seed", `${name}.json`);
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

// In-memory data store seeded from src/seed/*.json. Lists are mutated directly
// by the repositories below — there is no persistence beyond process lifetime.
const store = {
  employees: loadJson("employees"),
  clients: loadJson("clients"),
  projects: loadJson("projects"),
  activities: loadJson("activities"),
  timesheets: loadJson("timesheets"),
  timesheetRows: loadJson("timesheetRows"),
  notifications: loadJson("notifications"),
  auditLogs: loadJson("auditLogs"),
};

module.exports = { store };
