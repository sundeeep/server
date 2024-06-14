const asyncHandler = require("../utils/asyncHandler");
const ErrorResponse = require("../utils/errorResponse");
const User = require("../models/User");

exports.protect = asyncHandler(async (req, res, next) => {
  if (!req.session.userId) {
    return next(new ErrorResponse("Not authorized to access this route", 401));
  }

  const user = await User.findById(req.session.userId);

  if (!user) {
    return next(new ErrorResponse("User not found", 404));
  }

  req.user = user;
  next();
});
