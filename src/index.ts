import "dotenv/config";

// import "./db/mongoose";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";

import { stream } from "@/config/winston";
import routes from "@/routes/index";
import { ENVIRONMENT } from "@/utils/constants";

const app = express();
const port = process.env.PORT || 3001;

if (ENVIRONMENT === "development") {
    app.use(morgan("combined", { stream }));
}

app.use(cors());
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", routes);

app.set("trust proxy", "loopback");

app.get("/", (req, res) => {
    const text = "hello";
    res.status(200).send(text);
});

app.listen(port, () => {
    console.log(`Server is listening to port ${port}`);
});
