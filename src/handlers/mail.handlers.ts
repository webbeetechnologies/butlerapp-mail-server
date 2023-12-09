import { Request, Response } from "express";

import { sendContactMail } from "../mail";

export const contactEmail = async (req: Request, res: Response): Promise<any> => {
    try {
        await sendContactMail({
            ...req.body,
            name: req.body.name || req.body.email,
            ipAddress: req.ip,
            xForwardedForIp: req.headers["x-forwarded-for"] || req.socket.remoteAddress,
        });

        return res.send({ message: "Success" });
    } catch (e) {
        console.log(e);
        return res.status(500).send();
    }
};
