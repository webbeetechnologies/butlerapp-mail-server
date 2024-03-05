import { Router } from "express";

import events from "./events.routes";
// import auth from "./auth.routes";
// import user from "./user.routes";
import mail from "./mail.routes";
import sms from "./sms.routes";
import smsDev from "./sms.routes.dev";

const router = Router();

// router.use("/auth", auth);
// router.use("/users", user);
router.use("/", mail);
router.use("/sms", sms);
router.use("/sms-dev", smsDev);
router.use("/events", events);

export default router;
