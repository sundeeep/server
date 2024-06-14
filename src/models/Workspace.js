const mongoose = require("mongoose");

const WorkspaceSchema = new mongoose.Schema(
  {
    youtuber: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      required: [true, "Please add a title"],
    },
    description: {
      type: String,
      required: [true, "Please add a description"],
    },
    manager: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
    },
    editors: 
      {
        type: mongoose.Schema.ObjectId,
        ref: "User",
      },
    rawVideos: [
      {
        type: mongoose.Schema.ObjectId,
        ref: "RawVideo",
      },
    ],
    editedVideos: [
      {
        type: mongoose.Schema.ObjectId,
        ref: "EditedVideo",
      },
    ],
    youtubeChannel: {
      accessToken: String,
      refreshToken: String,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Workspace", WorkspaceSchema);
