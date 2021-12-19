const express = require("express");
const axios = require("axios");
const next = require("next");
const fs = require("fs");
const NodeCache = require("node-cache");
const myCache = new NodeCache();
const moment = require("moment");
require("dotenv").config();

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    const server = express();

    const datesStr = fs.readFileSync("./public/dates.txt", "utf8");
    const datesArr = datesStr.trim().split(/\r?\n/);
    const marsPromises = [];

    datesArr.forEach((date) => {
      const formattedDate = moment(date.trim()).format("YYYY-MM-DD");
      if (moment(formattedDate).isValid()) {
        marsPromises.push(
          axios.get(
            `https://api.nasa.gov/mars-photos/api/v1/rovers/curiosity/photos?earth_date=${formattedDate}&api_key=${process.env.API_KEY}`,
            { responseType: "arraybuffer" }
          )
        );
      }
    });

    Promise.all(marsPromises).then((results) => {
      results.forEach((result) => {
        const { data } = result;
        const mars = JSON.parse(data);
        const imageUrls = mars.photos.map((photo) => photo.img_src);
        myCache.set(mars.photos[0].earth_date, imageUrls);
      });
    });

    server.get("/:date", async (req, res) => {
      if (myCache.has(req.params.date)) {
        res.send(myCache.get(req.params.date));
      } else {
        const { data } = await axios.get(
          `https://api.nasa.gov/mars-photos/api/v1/rovers/curiosity/photos?earth_date=${req.params.date}&api_key=${process.env.API_KEY}`,
          { responseType: "arraybuffer" }
        );
        const mars = JSON.parse(data);
        const imageUrls = mars.photos.map((photo) => photo.img_src);
        myCache.set(req.params.date, imageUrls);
        res.send(imageUrls);
      }
    });

    server.get("*", (req, res) => {
      return handle(req, res);
    });

    server.listen(3000, (err) => {
      if (err) throw err;
      console.log("> Ready on http://localhost:3000");
    });
  })
  .catch((ex) => {
    console.error(ex.stack);
    process.exit(1);
  });
