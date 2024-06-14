const express = require("express");
const router = express.Router();
const {
    authenticateYouTube,
    youtubeOAuthCallback,
} = require("../controllers/youtubeController");
const auth = require("../middlewares/auth").protect;
const role = require("../middlewares/role").authorize;

router.get("/:id/addYTChannel", auth, role("Youtuber"), authenticateYouTube);
router.get("/oauth2callback", auth, youtubeOAuthCallback);

module.exports = router;
