import { Request, Response } from "express";
import parsePhoneNumber from "libphonenumber-js/max";
const twilio = require("twilio");

import VoiceResponse from "twilio/lib/twiml/VoiceResponse";

import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER } from "@/utils/constants";

const client = new twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

export const sendSMS = async (req: Request, res: Response): Promise<any> => {
    const to = req.body.to || req.query.to;
    const body = req.body.body || req.query.body;

    try {
        const phoneNumber = parsePhoneNumber(to);
        // Validate phone number first
        if (!phoneNumber.isValid()) {
            return res.status(400).send({ message: "Invalid phone number" });
        }

        // if phone is a landline, send voice message
        if (phoneNumber.getType() === "FIXED_LINE") {
            const twiml = createOTPTwiML({ body });
            const call = await client.calls.create({
                twiml,
                to,
                from: TWILIO_PHONE_NUMBER,
            });

            console.debug(`Call initiated with SID: ${call.sid}`);
            return res.send(`Call initiated with SID: ${call.sid}`);
        } else {
            // Default to SMS
            const response = await client.messages.create({
                body: `${body} ist der Bestätigungscode für deine Butlerapp Demo`,
                from: TWILIO_PHONE_NUMBER,
                to,
            });
            console.debug(response);

            return res.send({ message: "Success" });
        }
    } catch (e) {
        console.error(e);
        return res.status(500).send();
    }
};

// Repeats the OTP message if the user presses 1, otherwise hangs up
export const repeatOTP = (req: Request, res: Response) => {
    const body = req.body.body || req.query.body;
    const digits = req.body.Digits;

    try {
        if (digits === "1") {
            const twiml = createOTPTwiML({ body });
            res.type("text/xml");
            res.send(twiml);
        } else {
            const response = new VoiceResponse();
            response.say({ language: "de-DE" }, "Vielen Dank für deinen Anruf. Bis bald!");
            res.type("text/xml");
            res.send(response.toString());
        }
    } catch (e) {
        console.error(e);
        const response = new VoiceResponse();
        response.say({ language: "de-DE" }, "Vielen Dank für deinen Anruf. Bis bald!");
        res.type("text/xml");
        res.send(response.toString());
    }
};

const createOTPTwiML = ({ body }: { body: string }): string => {
    const response = new VoiceResponse();
    const gather = response.gather({
        numDigits: 1,
        action: `https://www.butlerapp.de/api/sms/repeatOTP?body=${encodeURIComponent(body)}`,
        method: "POST",
        language: "de-DE",
    });

    console.debug("body", body);

    gather.say({ language: "de-DE" }, "Dein Bestätigungscode lautet");
    gather.pause({ length: 1 });

    const numbers = body.split("");
    numbers.forEach((number) => {
        gather.say({ language: "de-DE" }, number);
        gather.pause({ length: 1 });
    });

    gather.say({ language: "de-DE" }, "Um die Nachricht zu wiederholen, drücke eins");

    return response.toString();
};
