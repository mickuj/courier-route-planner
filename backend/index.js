import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pointsRouter from "./routes/points.js";
import routeRouter from "./routes/route.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use("/api/points", pointsRouter);
app.use("/api/route", routeRouter);

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.listen(PORT, () => {
  console.log(`🚀 Backend running at http://localhost:${PORT}`);
});
