import { Router } from "express";
import asyncHandler from "express-async-handler";

import { sendSMS } from "@/handlers/sms.handler";

const router = Router();

/**
 * Contact
 * @route POST /contact
 */
router.post("/", asyncHandler(sendSMS));

export default router;
