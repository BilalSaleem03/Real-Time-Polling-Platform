const express = require("express");
const route = express.Router();
const isLoggedIn = require("../middleware/auth");
const pollController = require("../controllers/poll");

route.use(isLoggedIn); // All routes require authentication

route.get("/", pollController.getPolls);
route.post("/", pollController.createPoll);
route.get("/:id", pollController.getPoll);
route.get("/:id/results", pollController.getPollResults);

module.exports = route;