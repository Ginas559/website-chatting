import express from "express";
import bodyParser from "body-parser";
import viewEngine from "./config/viewEngine";
import connectDB from "./config/connectDB";
import initWebRoutes from "./route/web";

require('dotenv').config();

let app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

viewEngine(app);

connectDB();

initWebRoutes(app);

let port = process.env.PORT || 8088;

app.listen(port, () => {
    console.log("Backend Nodejs (MongoDB) đang chạy tại port: " + port);
});