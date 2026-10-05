const express = require("express");
const {
  getKekaAttendance,
  getKekaWFH,
  getKekaCaptureScheme,
} = require("../lib/keka");

const router = express.Router();

function toIST(timestamp) {
  if (!timestamp) return null;

  return new Date(timestamp).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour12: false,
  });
}

// ============================================================
// WFH
// ============================================================

router.get("/wfh", async (req, res) => {
  try {
    const { from, to, employeeId } = req.query;

    if (!from || !to) {
      return res.status(400).json({
        message: "from and to dates are required",
      });
    }

    const result = await getKekaWFH(
      from,
      to,
      employeeId
    );

    res.json(result);
  } catch (error) {
    console.error("Keka WFH error:", error);

    res.status(500).json({
      message: "Failed to fetch WFH from Keka",
      error: error.message,
    });
  }
});

// ============================================================
// ATTENDANCE
// ============================================================

router.get("/attendance", async (req, res) => {
  try {
    const {
      from,
      to,
      employeeNumber,
    } = req.query;

    if (!from || !to) {
      return res.status(400).json({
        message: "from and to dates are required",
        example:
          "/api/keka/attendance?from=2026-09-15&to=2026-09-21",
      });
    }

    // 1. Get attendance from Keka
    const result = await getKekaAttendance(
      from,
      to
    );

    // 2. Filter employee if employeeNumber is provided
    let attendanceRecords = result.data;

    if (employeeNumber) {
      attendanceRecords =
        attendanceRecords.filter(
          (record) =>
            record.employeeNumber ===
            employeeNumber
        );
    }

    const attendance = [];

    // 3. Process each attendance record
    for (const record of attendanceRecords) {
      const employeeId =
        record.employeeIdentifier;

      // --------------------------------------------------------
      // Get WFH information
      // --------------------------------------------------------

      let wfhRecords = [];

      if (employeeId) {
        const wfhResult =
          await getKekaWFH(
            from,
            to,
            employeeId
          );

        wfhRecords =
          Array.isArray(wfhResult.data)
            ? wfhResult.data
            : [];
      }

      // --------------------------------------------------------
      // Check approved WFH for this date
      // --------------------------------------------------------

      const attendanceDate =
        record.attendanceDate.slice(0, 10);

      const approvedWFH =
        wfhRecords.find((wfh) => {
          const wfhFrom =
            wfh.fromDate?.slice(0, 10);

          const wfhTo =
            wfh.toDate?.slice(0, 10);

          const isDateInsideWFH =
            wfhFrom &&
            wfhTo &&
            attendanceDate >= wfhFrom &&
            attendanceDate <= wfhTo;

          const isApproved =
            wfh.approvers?.some(
              (approver) =>
                approver.status ===
                "Approved"
            );

          return (
            isDateInsideWFH &&
            isApproved
          );
        });

      const isWFH =
        Boolean(approvedWFH);

      // --------------------------------------------------------
      // Keka first and last punch
      // --------------------------------------------------------

      const firstIn =
        record.firstInOfTheDay;

      const lastOut =
        record.lastOutOfTheDay;

      // --------------------------------------------------------
      // Identify Device and Web punches
      //
      // attendanceLogSource:
      // 0 = Device
      // 1 = Web
      // --------------------------------------------------------

      const isDevicePunch = (
        punch
      ) =>
        punch?.attendanceLogSource ===
        0;

      const isWebPunch = (
        punch
      ) =>
        punch?.attendanceLogSource ===
        1;

      // --------------------------------------------------------
      // Device punches
      // --------------------------------------------------------

      const deviceFirstIn =
        isDevicePunch(firstIn)
          ? firstIn
          : null;

      const deviceLastOut =
        isDevicePunch(lastOut)
          ? lastOut
          : null;

      // --------------------------------------------------------
      // Web punches
      // --------------------------------------------------------

      const webFirstIn =
        isWebPunch(firstIn)
          ? firstIn
          : null;

      const webLastOut =
        isWebPunch(lastOut)
          ? lastOut
          : null;

      // --------------------------------------------------------
      // BUSINESS RULE
      //
      // Approved WFH:
      //     Use Web Check-in / Check-out
      //
      // Office:
      //     Use Device / Face Capture
      // --------------------------------------------------------

      const selectedFirstIn =
        isWFH
          ? webFirstIn
          : deviceFirstIn;

      const selectedLastOut =
        isWFH
          ? webLastOut
          : deviceLastOut;

      // --------------------------------------------------------
      // Prepare response
      // --------------------------------------------------------

      attendance.push({
        employeeNumber:
          record.employeeNumber,

        attendanceDate:
          record.attendanceDate,

        workMode:
          isWFH
            ? "WFH"
            : "Office",

        attendanceSource:
          isWFH
            ? "Web"
            : "Device",

        // Keka daily totals
        grossHours:
          record.totalGrossHours,

        effectiveHours:
          record.totalEffectiveHours,

        breakHours:
          record.totalBreakDuration,

        effectiveOvertimeHours:
          record.totalEffectiveOvertimeDuration,

        grossOvertimeHours:
          record.totalGrossOvertimeDuration,

        // Selected source
        attendanceLogSource:
          selectedFirstIn
            ?.attendanceLogSource ??
          selectedLastOut
            ?.attendanceLogSource ??
          null,

        manualClockinType:
          selectedFirstIn
            ?.manualClockinType ??
          selectedLastOut
            ?.manualClockinType ??
          null,

        premiseName:
          selectedFirstIn
            ?.premiseName ??
          selectedLastOut
            ?.premiseName ??
          null,

        // Selected first/last punch
        firstIn: toIST(
          selectedFirstIn?.timestamp
        ),

        lastOut: toIST(
          selectedLastOut?.timestamp
        ),
      });
    }

    // ----------------------------------------------------------
    // Final response
    // ----------------------------------------------------------

    res.json({
      data: attendance,
      totalRecords:
        attendance.length,
      totalPages:
        result.totalPages,
    });
  } catch (error) {
    console.error(
      "Keka attendance error:",
      error
    );

    res.status(500).json({
      message:
        "Failed to fetch attendance from Keka",
      error: error.message,
    });
  }
});

router.get("/capturescheme", async (req, res) => {
  try {
    const result = await getKekaCaptureScheme();

    res.json(result);
  } catch (error) {
    console.error("Keka capture scheme error:", error);

    res.status(500).json({
      message: "Failed to fetch capture scheme from Keka",
      error: error.message,
    });
  }
});

module.exports = router;