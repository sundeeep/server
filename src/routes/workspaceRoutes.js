const express = require("express");

const {
  inviteToWorkspace,
  uploadRawVideo,
  uploadEditedVideo,
  uploadToYouTube,
} = require("../controllers/workspaceController");
const {
  createWorkspace,
  getWorkspaces,
  getWorkspace,
  updateWorkspace,
  deleteWorkspace,
} = require("../controllers/workspaceController");
const auth = require("../middlewares/auth").protect;
const role = require("../middlewares/role").authorize;
const multer = require("multer");
const upload = multer({ dest: "uploads/" });

const router = express.Router();
router.use(auth);

router.route("/").post(role("Youtuber"), createWorkspace).get(getWorkspaces);

router
  .route("/:id")
  .get(getWorkspace)
  .put(role("Youtuber"), updateWorkspace)
  .delete(role("Youtuber"), deleteWorkspace);
router.post("/:id/invite", auth, role("Youtuber"), inviteToWorkspace);
router.post(
  "/:id/upload-raw",
  auth,
  role("Youtuber", "Manager"),
  upload.single("video"),
  uploadRawVideo
);
router.post(
  "/:id/upload-edited",
  auth,
  role("Editor"),
  upload.single("video"),
  uploadEditedVideo
);
router.post(
  "/:workspaceId/:editedVideoId/upload-to-youtube",
  auth,
  role("Manager", "Youtuber"),
  uploadToYouTube
);

module.exports = router;
