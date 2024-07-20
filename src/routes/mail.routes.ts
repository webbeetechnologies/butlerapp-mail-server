import { Router } from "express";
import asyncHandler from "express-async-handler";

import { contactEmail, contactTaylor, issueDemo } from "@/handlers/mail.handlers";

const router = Router();

/**
 * Contact
 * @route POST /contact
 */
router.post("/contact", asyncHandler(contactEmail));
router.post("/demo", asyncHandler(issueDemo));
router.post("/contact/taylor", asyncHandler(contactTaylor));

export default router;
