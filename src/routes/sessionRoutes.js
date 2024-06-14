const express = require("express");
const router = express.Router();
const { checkUserSession } = require("../controllers/sessionController");

router.get("/check", checkUserSession);

module.exports = router;
