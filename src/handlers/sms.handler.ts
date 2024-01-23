import { Request, Response } from "express";
import parsePhoneNumber from "libphonenumber-js/max";

import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER } from "@/utils/constants";

const client = require("twilio")(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

export const sendSMS = async (req: Request, res: Response): Promise<any> => {
    try {
        // Validate phone number first
        if (!parsePhoneNumber(req.body.to).isValid()) {
            return res.status(400).send({ message: "Invalid phone number" });
        }

        const response = await client.messages.create({
            body: req.body.body,
            from: TWILIO_PHONE_NUMBER,
            to: req.body.to,
        });
        console.log(response);

        return res.send({ message: "Success" });
    } catch (e) {
        console.log(e);
        return res.status(500).send();
    }
};
