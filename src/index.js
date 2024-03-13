//require('dotenv').config({ path: './env' });

import dotenv from "dotenv"
import connectDB from "./db/index.js";
import { app } from "./app.js";

dotenv.config({ 
    path: './env' 
}) 

connectDB()
.then(() => {
    app.on("error", (error) => {
        console.error("ERROR: ", error);
        throw error;
    })
    app.listen(process.env.PORT || 8000, () => {
        console.log("Listening on port: " + process.env.PORT);
    });
}

)
.catch((error) =>  {
    console.error("Connection ERROR: ", error);
    process.exit(1);
});


/* import mongoose from "mongoose";
import { DB_NAME } from "./constants";
import { Express } from "express";
const app = new Express();
( async() => {
    try {
        await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);
        app.on("error", (error) => {
            console.error("ERROR: ", error);
            throw error;
        });

        app.listen(process.env.PORT, () => {
            console.log("Listening on port " + process.env.PORT);
        });
    } catch (error) {
        console.error("ERROR: ", error);
        throw error;
    }
})()  */