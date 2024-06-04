const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const watchTogetherLive = require("./live");

const app = express();

app.use(cors({ origin: "*" }));
app.use(helmet());
app.use(express.json());
app.use(morgan("dev"));

app.get("/", (_req, res, _next) => {
  res.json({ status: "ok" });
});

const server = app.listen(process.env.PORT || 3000, () => {
  console.log(`App Express is running!`);
});

watchTogetherLive(server);
