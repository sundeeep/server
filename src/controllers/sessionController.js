const asyncHandler = require('../utils/asyncHandler');


exports.checkUserSession = asyncHandler(async (req, res, next) => {
  if (req.session.userId) {
    return res.status(200).json({ success: true, userId: req.session.userId });
  } else {
    return res.status(200).json({ success: false });
  }
});
