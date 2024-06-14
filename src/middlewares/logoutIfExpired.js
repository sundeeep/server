const asyncHandler = require("../utils/asyncHandler");

exports.logoutIfExpired = asyncHandler((req, res, next) => {
  if (req.session.cookie.expires && new Date() > req.session.cookie.expires) {
    req.session.destroy((err) => {
      if (err) {
        return next(err);
      }
      res.redirect("/");
    });
  } else {
    next();
  }
});
