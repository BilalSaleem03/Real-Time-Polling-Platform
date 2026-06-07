const express = require("express");
const route = express.Router();
const isLoggedIn = require("../middleware/auth");
const pollController = require("../controllers/poll");
const { pollCreationRateLimiter } = require("../middleware/rateLimiter");

route.use(isLoggedIn);

route.get("/", pollController.getPolls);
route.post("/", pollCreationRateLimiter, pollController.createPoll);
route.get("/:id", pollController.getPoll);
route.get("/:id/results", pollController.getPollResults);

module.exports = route;