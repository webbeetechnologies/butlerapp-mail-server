// import fs from "fs";
// import path from "path";
import axios from "axios";
import nodemailer from "nodemailer";
const MATTERMOST_INBOUNDS_CHANNEL_ID = "pp9amtzhebdy8bi7ikz6m3jjgw";

import request from "graphql-request";

import {
    BAMBOO_SERVER_APP_ID,
    BAMBOO_SERVER_HOST,
    BAMBOO_TABLE_SLUG,
    // CLIENT_ADDRESS,
    MAIL_FROM,
    MAIL_HOST,
    MAIL_PASSWORD,
    MAIL_PORT,
    MAIL_SECURE,
    MAIL_TO,
    MAIL_USER,
    MATTERMOST_MAIL_BOT_ACCESS_TOKEN,
} from "@/utils/constants";

import { normalizeString, stringifyForGraphQL } from "./utils";

// import { resetMailText } from "./texts";

const mailConfig = {
    host: MAIL_HOST,
    port: MAIL_PORT,
    secure: MAIL_SECURE,
    auth: MAIL_USER
        ? {
              user: MAIL_USER,
              pass: MAIL_PASSWORD,
          }
        : undefined,
};

export const transporter = nodemailer.createTransport(mailConfig);

// Read Email Template Files
// const resetEmailTemplatePath = path.join(__dirname, "template-reset.html");
//
// const resetEmailTemplate = fs
//     .readFileSync(resetEmailTemplatePath, { encoding: "utf-8" })
//     .replace(/{{domain}}/gm, CLIENT_ADDRESS)
//     .replace(/{{site_name}}/gm, SITE_NAME);
//
// export const sendResetPasswordTokenMail = async (user: { email: string; token: string }) => {
//     try {
//         const mail = await transporter.sendMail({
//             from: MAIL_FROM || MAIL_USER,
//             to: user.email,
//             subject: "Reset your password",
//             text: resetMailText
//                 .replace(/{{resetpassword}}/gm, user.token)
//                 .replace(/{{domain}}/gm, CLIENT_ADDRESS),
//             html: resetEmailTemplate
//                 .replace(/{{resetpassword}}/gm, user.token)
//                 .replace(/{{domain}}/gm, CLIENT_ADDRESS),
//         });
//
//         if (!mail.accepted.length) {
//             throw new Error("Couldn't send reset password email. Try again later.");
//         }
//     } catch (e) {
//         console.log(e);
//     }
// };

const sendMail = async (form: { email: string; phone: string; [key: string]: any }) => {
    try {
        const text = `
            Contact Info: 
            ${JSON.stringify({ ...form }, null, 4)}
            `;

        const mail = await transporter.sendMail({
            from: MAIL_FROM || MAIL_USER,
            to: MAIL_TO,
            subject: "Contact from bulterapp website",
            text,
        });

        await axios.post(
            "https://mattermost.bambooapp.ai/api/v4/posts",
            {
                channel_id: MATTERMOST_INBOUNDS_CHANNEL_ID,
                message: text,
            },
            {
                headers: {
                    Authorization: `Bearer ${MATTERMOST_MAIL_BOT_ACCESS_TOKEN}`,
                },
            }
        );

        if (!mail.accepted.length) {
            throw new Error("Something went wrong while sending the mail. Try again later.");
        }
    } catch (error) {
        console.log(error);
    }
};

const sendDataToBambooTable = async (form: { email: string; phone: string; [key: string]: any }) => {
    try {
        const selectedFieldNames = Object.keys(form);

        const csvString = selectedFieldNames
            .map((key) => {
                const value = form[key as keyof typeof form];
                if (typeof value === "string") return normalizeString(value);
                if (value && typeof value === "object") return stringifyForGraphQL(value);
                return value;
            })
            .join("\t");

        // Send graphql to bamboo
        const mutationQuery = `
        mutation{
            csvImporter(
            tableName:${BAMBOO_TABLE_SLUG},
            selectedFieldNames:${JSON.stringify(selectedFieldNames)},
            startRecordOffset:0,
            numberOfRecordsToUpdate:1,
            csvString:"${csvString}",
            ${
                form.email
                    ? `
                tableConfiguration:{
                    filtersSet:{
                    conjunction:and,
                    filtersSet:[
                        {
                        field:"_apEMail_fldViznFWpT4RVJnZ",
                        operator:"contains",
                        value:["${form.email}"]
                        }
                    ]
                    }
                }
            `
                    : ""
            }
            )
        }
        `;

        const res = await request(`${BAMBOO_SERVER_HOST}/${BAMBOO_SERVER_APP_ID}`, mutationQuery);
        console.log("GraphQL Response:", res);
    } catch (error) {
        console.log(error);
    }
};

export const sendContactMail = async (form: { email: string; phone: string; [key: string]: any }) => {
    await sendDataToBambooTable(form);
    await sendMail(form);
};
