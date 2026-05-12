import express from "express";

/**
 * Cấu hình View Engine cho ứng dụng Express
 * @param {express.Application} app 
 */
let configViewEngine = (app) => {
    app.use(express.static("./src/public")); 
    app.set("view engine", "ejs"); 
    app.set("views", "./src/views"); 
}
export default configViewEngine;