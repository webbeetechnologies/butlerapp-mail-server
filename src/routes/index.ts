import { Router } from "express";

// import auth from "./auth.routes";
// import user from "./user.routes";
import mail from "./mail.routes";
import sms from "./sms.routes";

const router = Router();

// router.use("/auth", auth);
// router.use("/users", user);
router.use("/contact", mail);
router.use("/sms", sms);

export default router;
