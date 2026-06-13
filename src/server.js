import express from "express";
import http from "http";
import bodyParser from "body-parser";
import cors from "cors";
import connectDB from "./config/connectDB";
import initWebRoutes from "./route/web";
import { initSocket } from "./config/socket";

require('dotenv').config();

let app = express();
const server = http.createServer(app);

// Initialize Socket.io
initSocket(server);

// Enable CORS
app.use(cors({
    origin: [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost:3000',
        'http://127.0.0.1:3000'
    ],
    credentials: true
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Start server only after DB connection
const startServer = async () => {
    try {
        await connectDB();
        
        initWebRoutes(app);
        
        let port = process.env.PORT || 8088;
        
        server.listen(port, () => {
            console.log("Backend Nodejs (MongoDB) đang chạy tại port: " + port);
        });
    } catch (error) {
        console.error("Lỗi khởi động server:", error);
        process.exit(1);
    }
};

startServer();