import { Router } from "express";
import asyncHandler from "express-async-handler";

import { confirmOTP, handleAfterOTP, handleConferenceCall, sendSMS } from "@/handlers/sms.handler.dev";

const router = Router();

/**
 * Contact
 * @route POST /sms-dev
 */
router.post("/", asyncHandler(sendSMS));

router.post("/confirmOTP", asyncHandler(confirmOTP));

router.post("/afterOTP", asyncHandler(handleAfterOTP));

router.post("/conference", asyncHandler(handleConferenceCall));

export default router;
