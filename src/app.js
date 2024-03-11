import { express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();

app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
}));

app.use(express.json({limit: "16kb"})); //parse json request bodies as json objects and set limit
app.use(express.urlencoded({extended: true, limit: "16kb"})); //parse urlencoded request bodies
app.use(express.static("public")); //configure express to serve static files like images,pdfs 
app.use(cookieParser());
export {app};