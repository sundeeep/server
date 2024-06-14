const Workspace = require("../models/Workspace");
const RawVideo = require("../models/RawVideo");
const EditedVideo = require("../models/EditedVideo");
const asyncHandler = require("../utils/asyncHandler");
const ErrorResponse = require("../utils/errorResponse");
const s3 = require("../config/aws.config");
const FormData = require("form-data");
const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");
const oauth2Client = require("../config/yt.config");
const axios = require("axios");
const mongoose = require("mongoose");
const streamToBuffer = require('stream-to-buffer');

// Helper functions for AWS S3 multipart upload
const initiateMultipartUpload = async (Key) => {
  const params = {
    Bucket: process.env.S3_BUCKET_NAME,
    Key,
  };
  return await s3.createMultipartUpload(params).promise();
};

const uploadChunk = async (uploadId, Key, Body, PartNumber) => {
  const params = {
    Bucket: process.env.S3_BUCKET_NAME,
    Key,
    PartNumber,
    UploadId: uploadId,
    Body,
  };
  return await s3.uploadPart(params).promise();
};

const completeMultipartUpload = async (uploadId, Key, Parts) => {
  const params = {
    Bucket: process.env.S3_BUCKET_NAME,
    Key,
    UploadId: uploadId,
    MultipartUpload: { Parts },
  };
  return await s3.completeMultipartUpload(params).promise();
};

const abortMultipartUpload = async (uploadId, Key) => {
  const params = {
    Bucket: process.env.S3_BUCKET_NAME,
    Key,
    UploadId: uploadId,
  };
  return await s3.abortMultipartUpload(params).promise();
};

exports.uploadRawVideo = asyncHandler(async (req, res, next) => {
  const { notes } = req.body;

  const workspace = await Workspace.findById(req.params.id);

  if (!workspace) {
    return next(new ErrorResponse("Workspace not found", 404));
  }

  if (workspace.youtuber.toString() !== req.user.id) {
    return next(new ErrorResponse("Unauthorized", 403));
  }

  const filePath = req.file.path;
  const fileKey = `${Date.now()}_${req.file.originalname}`;
  const fileContent = fs.readFileSync(filePath);
  const chunkSize = 5 * 1024 * 1024; // 5MB
  const numChunks = Math.ceil(fileContent.length / chunkSize);

  const uploadId = await initiateMultipartUpload(fileKey);

  const uploadPromises = [];
  for (let i = 0; i < numChunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, fileContent.length);
    const chunk = fileContent.slice(start, end);

    uploadPromises.push(uploadChunk(uploadId.UploadId, fileKey, chunk, i + 1));
  }

  try {
    const uploadedParts = await Promise.all(uploadPromises);
    const parts = uploadedParts.map((part, index) => ({
      ETag: part.ETag,
      PartNumber: index + 1,
    }));

    await completeMultipartUpload(uploadId.UploadId, fileKey, parts);

    const rawVideo = new RawVideo({
      workspace: workspace._id,
      url: `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileKey}`,
      notes,
    });

    await rawVideo.save();
    workspace.rawVideos.push(rawVideo);
    await workspace.save();

    res.status(201).json({ success: true, data: rawVideo });
  } catch (err) {
    await abortMultipartUpload(uploadId.UploadId, fileKey);
    return next(new ErrorResponse("Error uploading file", 500));
  }
});


exports.inviteToWorkspace = asyncHandler(async (req, res, next) => {
  const { managerId, editorIds } = req.body;

  const workspace = await Workspace.findById(req.params.id);

  if (!workspace) {
    return next(new ErrorResponse("Workspace not found", 404));
  }

  if (workspace.youtuber.toString() !== req.user.id) {
    return next(new ErrorResponse("Unauthorized", 403));
  }

  workspace.manager = managerId;
  workspace.editors.push(...editorIds);
  await workspace.save();

  res.status(200).json({ success: true, data: workspace });
});



exports.uploadEditedVideo = asyncHandler(async (req, res, next) => {
  // const { notes } = req.body;
  const workspace = await Workspace.findById(req.params.id);

  if (!workspace) {
    return next(new ErrorResponse("Workspace not found", 404));
  }

  // if (!workspace.editors.includes(req.user.id)) {
  //   return next(new ErrorResponse("Unauthorized", 403));
  // }

  const filePath = req.file.path;
  const fileKey = `${Date.now()}_${req.file.originalname}`;
  const fileContent = fs.readFileSync(filePath);
  const chunkSize = 5 * 1024 * 1024; // 5MB
  const numChunks = Math.ceil(fileContent.length / chunkSize);

  const uploadId = await initiateMultipartUpload(fileKey);

  const uploadPromises = [];
  for (let i = 0; i < numChunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, fileContent.length);
    const chunk = fileContent.slice(start, end);

    uploadPromises.push(uploadChunk(uploadId.UploadId, fileKey, chunk, i + 1));
  }

  try {
    const uploadedParts = await Promise.all(uploadPromises);
    const parts = uploadedParts.map((part, index) => ({
      ETag: part.ETag,
      PartNumber: index + 1,
    }));

    await completeMultipartUpload(uploadId.UploadId, fileKey, parts);

    const editedVideo = new EditedVideo({
      workspace: workspace._id,
      url: `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileKey}`,
      notes: null
    });

    await editedVideo.save();
    workspace.editedVideos.push(editedVideo);
    await workspace.save();

    res.status(201).json({ success: true, data: editedVideo });
  } catch (err) {
    await abortMultipartUpload(uploadId.UploadId, fileKey);
    return next(new ErrorResponse("Error uploading file", 500));
  }
});




//upload to youtube
const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB

async function refreshAccessToken(workspace) {
  oauth2Client.setCredentials({
    refresh_token: workspace.youtubeChannel.refreshToken,
  });

  const tokens = await oauth2Client.refreshAccessToken();
  const newAccessToken = tokens.credentials.access_token;

  workspace.youtubeChannel.accessToken = newAccessToken;
  await workspace.save();

  return newAccessToken;
}

async function initializeUpload(workspace, title, description, tags) {
  try {
    const response = await axios.post(
      "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
      {
        snippet: {
          title,
          description,
          tags: tags || [],
        },
        status: {
          privacyStatus: "private",
        },
      },
      {
        headers: {
          Authorization: `Bearer ${workspace.youtubeChannel.accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    return response.headers.location;
  } catch (error) {
    if (error.response && error.response.status === 401) {
      const newAccessToken = await refreshAccessToken(workspace);
      const retryResponse = await axios.post(
        "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
        {
          snippet: {
            title,
            description,
            tags: tags || [],
          },
          status: {
            privacyStatus: "private",
          },
        },
        {
          headers: {
            Authorization: `Bearer ${newAccessToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      return retryResponse.headers.location;
    } else {
      throw new ErrorResponse("Error initializing YouTube upload", 500);
    }
  }
}

exports.uploadToYouTube = asyncHandler(async (req, res, next) => {
  const { title, description, tags } = req.body;
  const workspace = await Workspace.findById(req.params.workspaceId);
  const editedVideo = await EditedVideo.findById(req.params.editedVideoId);

  if (!workspace || !editedVideo) {
    return next(new ErrorResponse("Workspace or video not found", 404));
  }

  if (editedVideo.status !== "Approved") {
    return next(new ErrorResponse("Video not approved", 400));
  }

  const uploadUrl = await initializeUpload(workspace, title, description, tags);
  console.log("Resumable upload URL:", uploadUrl);

  const s3Params = {
    Bucket: process.env.S3_BUCKET_NAME,
    Key: editedVideo.url.split("/").pop(),
  };

  const s3Stream = s3.getObject(s3Params).createReadStream();

  let start = 0;
  let buffer = [];

  s3Stream.on("data", (chunk) => {
    buffer.push(chunk);
    if (Buffer.concat(buffer).length >= CHUNK_SIZE) {
      uploadChunk(Buffer.concat(buffer).slice(0, CHUNK_SIZE));
      buffer = [Buffer.concat(buffer).slice(CHUNK_SIZE)];
    }
  });

  s3Stream.on("end", async () => {
    if (buffer.length > 0) {
      await uploadChunk(Buffer.concat(buffer), true);
    }
  });

  s3Stream.on("error", (err) => {
    console.error("Error downloading video from S3:", err);
    return next(new ErrorResponse("Error downloading video from S3", 500));
  });

  async function uploadChunk(chunk, isLastChunk = false) {
    const end = start + chunk.length - 1;
    const headers = {
      "Content-Length": chunk.length,
      "Content-Range": `bytes ${start}-${end}/${isLastChunk ? end + 1 : "*"}`,
      "Content-Type": "application/octet-stream",
    };

    try {
      const uploadResponse = await axios.put(uploadUrl, chunk, { headers });
      if (uploadResponse.status === 200 || uploadResponse.status === 201) {
        res.status(201).json({
          success: true,
          data: uploadResponse.data,
        });
      } else if (uploadResponse.status === 308) {
        start = end + 1;
      }
    } catch (error) {
      console.error(
        "Error uploading video chunk to YouTube:",
        error.response ? error.response.data : error.message
      );
      if (error.response && error.response.status === 308) {
        start = end + 1;
      } else {
        return next(new ErrorResponse("Error uploading video to YouTube", 500));
      }
    }
  }
});

exports.createWorkspace = asyncHandler(async (req, res, next) => {
  const { title, description } = req.body;

  const workspace = new Workspace({
    youtuber: req.user.id,
    title,
    description,
    manager: null,
    editors: null,
  });

  await workspace.save();
  res.status(201).json({ success: true, data: workspace });
});
exports.getWorkspaces = asyncHandler(async (req, res, next) => {
  const workspaces = await Workspace.find({ youtuber: req.user.id });
  res.status(200).json({ success: true, data: workspaces });
});


exports.getWorkspace = asyncHandler(async (req, res, next) => {
  const workspace = await Workspace.findById(req.params.id);

  if (!workspace) {
    return next(new ErrorResponse("Workspace not found", 404));
  }

  res.status(200).json({ success: true, data: workspace });
});

exports.updateWorkspace = asyncHandler(async (req, res, next) => {
  let workspace = await Workspace.findById(req.params.id);

  if (!workspace) {
    return next(new ErrorResponse("Workspace not found", 404));
  }

  // Ensure the user is the owner of the workspace
  if (workspace.youtuber.toString() !== req.user.id) {
    return next(new ErrorResponse("Unauthorized", 403));
  }

  workspace = await Workspace.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({ success: true, data: workspace });
});

exports.deleteWorkspace = asyncHandler(async (req, res, next) => {
  const workspace = await Workspace.findById(req.params.id);

  if (!workspace) {
    return next(new ErrorResponse("Workspace not found", 404));
  }

  // Ensure the user is the owner of the workspace
  if (workspace.youtuber.toString() !== req.user.id) {
    return next(new ErrorResponse("Unauthorized", 403));
  }

  await workspace.remove();

  res.status(200).json({ success: true, data: {} });
});