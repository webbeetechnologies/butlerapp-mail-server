import { Request, Response } from "express";
import ip from 'ip'

import { sendContactMail } from "../mail";

export const contactEmail = async (req: Request, res: Response): Promise<any> => {
    try {
        await sendContactMail({ ...req.body,
           clientIPAddress: ip.address()
        });

        return res.send({ message: "Success" });
    } catch (e) {
        return res.status(500).send();
    }
};
