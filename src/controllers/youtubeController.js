const { google } = require("googleapis");
const Workspace = require("../models/Workspace");
const asyncHandler = require("../utils/asyncHandler");
const ErrorResponse = require("../utils/errorResponse");
const oauth2Client = require("../config/yt.config");

exports.authenticateYouTube = asyncHandler((req, res, next) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/youtube.upload"],
    state: req.params.id, // Pass the workspace ID to the state parameter
  });
  res.json({ url: authUrl });
});

exports.youtubeOAuthCallback = asyncHandler(async (req, res, next) => {
  const { code, state } = req.query; // Retrieve the code and state (workspace ID) from the query string
  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const workspace = await Workspace.findById(state); // Use state to get workspace ID

    if (!workspace) {
      return next(new ErrorResponse("Workspace not found", 404));
    }

    if (workspace.youtuber.toString() !== req.user.id) {
      return next(new ErrorResponse("Unauthorized", 403));
    }

    workspace.youtubeChannel = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
    };
    await workspace.save();

    res.send("YouTube authentication successful");
  } catch (error) {
    return next(new ErrorResponse("YouTube authentication failed", 500));
  }
});
