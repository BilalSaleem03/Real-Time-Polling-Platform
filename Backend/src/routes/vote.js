const express = require("express");
const route = express.Router();
const isLoggedIn = require("../middleware/auth");
const voteController = require("../controllers/vote");

route.use(isLoggedIn); // All routes require authentication

route.post("/", voteController.submitVote);
route.get("/check/:pollId", voteController.checkUserVote);

module.exports = route;