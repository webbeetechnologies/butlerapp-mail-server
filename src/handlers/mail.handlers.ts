import { Request, Response } from "express";

import { sendContactMail } from "../mail";

export const contactEmail = async (req: Request, res: Response): Promise<any> => {
console.log({ ip: req.ip})
    try {
        await sendContactMail({ ...req.body,
            ipAddress: req.ip,
            xForwardedFor: req.headers['x-forwarded-for'] || req.socket.remoteAddress
        });

        return res.send({ message: "Success" });
    } catch (e) {
        return res.status(500).send();
    }
};
