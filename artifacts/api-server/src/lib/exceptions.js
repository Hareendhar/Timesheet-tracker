class InvalidTransitionException extends Error {
  constructor(currentStatus, attempted) {
    super(`Cannot perform '${attempted}' on a timesheet in '${currentStatus}' status`);
    this.name = "InvalidTransitionException";
    this.currentStatus = currentStatus;
  }
}

module.exports = { InvalidTransitionException };
