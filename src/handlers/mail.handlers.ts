import { Request, Response } from "express";

import { sendContactMail, sendDemoMail } from "../mail";

export const contactEmail = async (req: Request, res: Response): Promise<any> => {
    try {
        const postId = await sendContactMail({
            ...req.body,
            name: req.body.name || req.body.email,
            ipAddress: req.ip,
            xForwardedForIp: req.headers["x-forwarded-for"] || req.socket.remoteAddress,
        });

        return res.send({ message: "Success", postId });
    } catch (e) {
        console.error(e);
        return res.status(500).send();
    }
};

export const issueDemo = async (req: Request, res: Response): Promise<any> => {
    try {
        await sendDemoMail({
            ...req.body,
            name: req.body.name || req.body.email,
            ipAddress: req.ip,
            xForwardedForIp: req.headers["x-forwarded-for"] || req.socket.remoteAddress,
        });

        return res.send({ message: "Success" });
    } catch (e) {
        console.error(e);
        return res.status(500).send(e?.message);
    }
};
