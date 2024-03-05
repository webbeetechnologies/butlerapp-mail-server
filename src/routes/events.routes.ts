import { Router } from "express";

import { eventsHandler } from "@/handlers/events.handlers";

const router = Router();

router.get("/", eventsHandler);

export default router;
