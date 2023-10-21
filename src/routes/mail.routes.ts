import { Router } from "express";
import asyncHandler from "express-async-handler";

import { contactEmail } from "@/handlers/mail.handlers";

const router = Router();

/**
 * Contact
 * @route POST /contact
 */
router.post("/", asyncHandler(contactEmail));

export default router;
