const ErrorResponse = require("../utils/errorResponse");

exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new ErrorResponse(
          `Role ${req.user.role} is not authorized to access this route`,
          403
        )
      );
    }
    next();
  };
};
