import { Request, Response } from "express";
import parsePhoneNumber from "libphonenumber-js/max";
import VoiceResponse from "twilio/lib/twiml/VoiceResponse";

import {
    CUSTOMER_REP_NUMBER,
    TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN,
    TWILIO_FROM_NUMBER,
} from "@/utils/constants";

import { sendEventsToAll } from "./events.handlers";

const twilio = require("twilio");

const client = new twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

const generateOTP = (): string => {
    return Math.floor(1000 + Math.random() * 9000).toString();
};

export const sendSMS = async (req: Request, res: Response): Promise<any> => {
    const to = req.body.to || req.query.to;
    const otp = generateOTP();

    try {
        const phoneNumber = parsePhoneNumber(to);
        // Validate phone number first
        if (!phoneNumber.isValid()) {
            return res.status(400).send({ message: "Invalid phone number" });
        }

        const twiml = createOTPTwiML({ otp });
        const call = await client.calls.create({
            twiml,
            to,
            from: TWILIO_FROM_NUMBER,
        });

        console.debug(`Call initiated with SID: ${call.sid}`);
        return res.send({ otp });
    } catch (e) {
        console.error(e);
        return res.status(500).send();
    }
};

// Repeats the OTP message if the user presses 1, otherwise hangs up
export const confirmOTP = (req: Request, res: Response) => {
    const input = req.body.otp || req.query.otp;
    const digits = req.body.Digits;

    try {
        // If user presses just 1, send them to conference call
        if (input.length === 1 && input === "1") {
            console.debug("User pressed 1, redirecting to conference call");
            const response = new VoiceResponse();
            response.redirect({ method: "POST" }, "https://www.butlerapp.de/api/sms-dev/conference");
            res.type("text/xml");
            res.send(response.toString());
            return;
        }

        if (digits !== input) {
            console.debug("Incorrect OTP entered", input, digits);
            const twiml = createOTPTwiML({ otp: input, isFailed: true });
            res.type("text/xml");
            res.send(twiml);
            return;
        } else {
            // Ask if the user wants to connect to a conference call, send to afterOTP
            console.debug("Correct OTP entered", input);
            const twiml = new VoiceResponse();
            twiml.redirect(
                { method: "POST" },
                "https://www.butlerapp.de/api/sms-dev/afterOTP?isCorrect=true"
            );

            res.type("text/xml");
            res.send(twiml.toString());
            return;
        }
    } catch (e) {
        console.error(e);
        res.send(e);
        return;
    }
};

const createOTPTwiML = ({ otp, isFailed }: { otp: string; isFailed?: boolean }): string => {
    const response = new VoiceResponse();

    const gather = response.gather({
        action: `https://www.butlerapp.de/api/sms-dev/confirmOTP?otp=${encodeURIComponent(otp)}`,
        method: "POST",
        language: "de-DE",
        timeout: 10,
    });

    console.debug("asking user for OTP", otp);

    // Handle Incorrect OTP
    if (isFailed) {
        console.debug("Handling Incorrect OTP");
        gather.play("https://butlerapp.de/audio/incorrect_code_plus_help.mp3");
        gather.pause({ length: 1 });

        gather.play("https://butlerapp.de/audio/enter_code.mp3");
        gather.pause({ length: 1 });
    } else {
        gather.play("https://butlerapp.de/audio/intro.mp3");
        gather.pause({ length: 1 });
    }

    // If the user does not provide input, ask for a conference call
    console.debug("Redirecting to afterOTP if user does not enter any input");
    response.redirect({ method: "POST" }, "https://www.butlerapp.de/api/sms-dev/afterOTP");

    return response.toString();
};

export const handleAfterOTP = (req: Request, res: Response) => {
    try {
        // get param to know if the user has entered the correct OTP
        const isCorrect = req.query.isCorrect;

        const response = new VoiceResponse();
        console.debug("Handling after OTP", isCorrect);

        if (isCorrect === "true") {
            response.play("https://butlerapp.de/audio/correct_code.mp3");
            response.pause({ length: 1 });

            // Send event to connected clients
            sendEventsToAll({ isVerified: true });
        }

        if (isCorrect === "false") {
            response.play("https://butlerapp.de/audio/incorrect_code_plus_help.mp3");
            response.pause({ length: 1 });
        }

        const gather = response.gather({
            numDigits: 1,
            action: "https://www.butlerapp.de/api/sms-dev/conference",
            method: "POST",
            language: "de-DE",
            timeout: 10,
        });

        console.debug("Asking for conference call");

        if (isCorrect) {
            gather.play("https://butlerapp.de/audio/end_any_questions.mp3");
        }

        // If the user does not provide input after 10 seconds, hang up with a message
        response.say({ language: "de-DE" }, "Vielen Dank für deinen Anruf. Bis bald!");

        res.type("text/xml");
        res.send(response.toString());
    } catch (e) {
        console.error(e);
        res.send(e);
    }
};

export const handleConferenceCall = (req: Request, res: Response) => {
    const digits = req.body.Digits;

    try {
        if (digits === "1") {
            const response = new VoiceResponse();
            // Call customer service number
            response.dial(
                {
                    callerId: TWILIO_FROM_NUMBER,
                },
                CUSTOMER_REP_NUMBER
            );

            // Send event to connected clients
            sendEventsToAll({ isVerified: true });

            res.type("text/xml");
            res.send(response.toString());
        } else {
            const response = new VoiceResponse();
            response.redirect(
                { method: "POST" },
                "https://www.butlerapp.de/api/sms-dev/afterOTP?isCorrect=false"
            );

            // Send event to connected clients
            sendEventsToAll({ isVerified: true });

            res.type("text/xml");
            res.send(response.toString());
        }
    } catch (e) {
        console.error(e);
        res.send(e);
    }
};
