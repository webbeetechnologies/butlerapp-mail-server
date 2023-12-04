import { Request, Response } from "express";
import axios from 'axios'

import { sendContactMail } from "../mail";
import { MATTERMOST_MAIL_BOT_ACCESS_TOKEN } from "@/utils/constants";

const MATTERMOST_INBOUNDS_CHANNEL_ID = 'pp9amtzhebdy8bi7ikz6m3jjgw';

export const contactEmail = async (req: Request, res: Response): Promise<any> => {
    try {
        await sendContactMail({ ...req.body,
            ipAddress: req.ip,
            xForwardedForIP: req.headers['x-forwarded-for'] || req.socket.remoteAddress
        });

        await axios.post('https://mattermost.bambooapp.ai/api/v4/posts', {
            "channel_id": MATTERMOST_INBOUNDS_CHANNEL_ID,
            "message": req.body
        }, {
            headers: {
                Authorization: `Bearer ${MATTERMOST_MAIL_BOT_ACCESS_TOKEN}`
            }
        })

        return res.send({ message: "Success" });
    } catch (e) {
        return res.status(500).send();
    }
};
