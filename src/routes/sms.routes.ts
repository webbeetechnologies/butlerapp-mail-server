import { Router } from "express";
import asyncHandler from "express-async-handler";

import { repeatOTP, sendSMS } from "@/handlers/sms.handler";

const router = Router();

/**
 * Contact
 * @route POST /sms
 */
router.post("/", asyncHandler(sendSMS));

router.post("/repeatOTP", asyncHandler(repeatOTP));

export default router;
