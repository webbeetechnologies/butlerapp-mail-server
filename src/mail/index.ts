// import fs from "fs";
// import path from "path";
import axios, { AxiosResponse } from "axios";
import nodemailer from "nodemailer";
const MATTERMOST_INBOUNDS_CHANNEL_ID = "pp9amtzhebdy8bi7ikz6m3jjgw";

import request from "graphql-request";

import {
    BAMBOO_SERVER_APP_ID,
    BAMBOO_SERVER_HOST,
    BAMBOO_TABLE_SLUG,
    BUTLERAPP_ACCOUNT_SETUP_ENDPOINT,
    BUTLERAPP_API_KEY,
    DEMO_FROM_EMAIL,
    DEMO_INSTALLER_API_KEY,
    DEMO_INSTALLER_API_URL,
    DEMO_INSTALLER_AUTHORITY,
    DEMO_INSTALLER_SOURCE,
    ENVIRONMENT,
    // CLIENT_ADDRESS,
    MAIL_FROM,
    MAIL_HOST,
    MAIL_PASSWORD,
    MAIL_PORT,
    MAIL_SECURE,
    MAIL_TO,
    MAIL_USER,
    MATTERMOST_MAIL_BOT_ACCESS_TOKEN,
    QUIZ_NESTED_FORM_KEY,
} from "@/utils/constants";

import { generateUniqueString, normalizeString, stringifyForGraphQL } from "./utils";

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

const isObject = (value: any) => {
    return value && typeof value === "object" && value.constructor === Object;
};

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

const sendMail = async (form: Record<string, any>) => {
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
        console.error(error);
    }
};

const sendDataToBambooTable = async (initialForm: Record<string, any>) => {
    // Map form fields to bamboo fields
    const form = {
        _quelle_fldwPbyoIvdGPgmTi: "Butlerapp Inbound",
        _status_fldxG5PdWUBHPf0RK: "Not contacted",
        _firma_fldZjcqfv8yPKDyea: initialForm?.name || initialForm[QUIZ_NESTED_FORM_KEY]?.name,
        _apEMail_fldViznFWpT4RVJnZ: initialForm?.email || initialForm[QUIZ_NESTED_FORM_KEY]?.email,
        _apTelefon1_fldPOqfODf7TAodQV: initialForm?.phone || initialForm[QUIZ_NESTED_FORM_KEY]?.phone,
        _website_fldfqTVDHqy6EcU5m: initialForm?.website,
        _country: initialForm?.country || initialForm[QUIZ_NESTED_FORM_KEY]?.country,
        _message: initialForm?.message,
        _campaignName: initialForm.campaignName,
        _utmSource: initialForm.utmSource,
        _utmMedium: initialForm.utmMedium,
        _utmCampaign: initialForm.utmCampaign,
        _keyword_fldwMVW1bGtuW7sqr: initialForm.utmTerm,
        _anfrageAm_fldDW3dBF67bR7Bir: initialForm.date,
        _versionCookie: initialForm.versionCookie,
        _ipAddress: initialForm.ipAddress,
        _xForwardedForIp: initialForm.xForwardedForIp,
        _completeJson: initialForm.completeJson,
        _url: initialForm.URL,
        _userAgent: initialForm.userAgent,
        _userAgentData: initialForm.userAgentData,
        _timestampId: initialForm?.timestampId,
        _demoAccess: initialForm?.demoURL,
    };

    try {
        const selectedFieldNames = Object.keys(form);

        const csvString = selectedFieldNames
            .map((key) => {
                const value = form[key as keyof typeof form];
                if (typeof value === "string") return normalizeString(value);
                if (isObject(value)) return stringifyForGraphQL(value);
                return value;
            })
            .join("\t");

        if (!form._timestampId) throw new Error("No timestampId provided");

        // Send graphql to bamboo
        const mutationQuery = `
        mutation{
            csvImporter(
                tableName:${BAMBOO_TABLE_SLUG},
                selectedFieldNames:${JSON.stringify(selectedFieldNames)},
                startRecordOffset:0,
                numberOfRecordsToUpdate:1,
                csvString:"${csvString}",
                tableConfiguration: {
                    filtersSet:{
                        conjunction:and,
                        filtersSet:[
                            {
                                field: "_timestampId",
                                operator: "=",
                                value:["${form._timestampId}"]
                            }
                        ]
                    }
                }
            )
        }
        `;
        console.debug("GraphQL Query:", mutationQuery);
        const res = await request(`${BAMBOO_SERVER_HOST}/${BAMBOO_SERVER_APP_ID}`, mutationQuery);
        console.debug("GraphQL Response:", res);
    } catch (error) {
        console.error(error);
    }
};

export const sendContactMail = async (form: Record<string, any>) => {
    try {
        const findRecordQuery = `
    query{
        ${BAMBOO_TABLE_SLUG}(filtersSet: {conjunction: and, filtersSet: [{field: _timestampId, operator: "contains", value: ["${form.timestampId}"]}]}){
         records{
          result{
            id
          }
        }
        }
      }
    `;

        const res = await request(`${BAMBOO_SERVER_HOST}/${BAMBOO_SERVER_APP_ID}`, findRecordQuery);
        const isExistingRecord = res[BAMBOO_TABLE_SLUG].records.result[0]?.id;

        await sendDataToBambooTable(form);
        if (!isExistingRecord) await sendMail(form);
    } catch {
        console.debug("Error sending request to bamboo: Sending to Mattermost");
        await sendMail(form);
    }
};

export const setupUserAccount = async (form: Record<string, any>): Promise<AxiosResponse<any>> => {
    if (!form.email) throw new Error("No email provided");
    if (!form.password) throw new Error("No password provided");
    if (!form.phone) throw new Error("No phone provided");

    const response = await axios.post(
        `${form.demoURL}${BUTLERAPP_ACCOUNT_SETUP_ENDPOINT}`,
        {
            email: form.email,
            password: form.password,
            phone: form.phone,
            first_name: form?.name.split(" ")[0] || "Test User",
            last_name: form?.name.split(" ")[1] || form?.name.split(" ")[0],
            mobile_phone: form.phone,
            // Can we add website to the request?
            // website: form.website,
        },
        {
            headers: {
                "X-Api-Key": BUTLERAPP_API_KEY,
                Accept: "application/json",
            },
        }
    );
    console.debug("SETUP_USER", response.data);

    return response;
};

const generateSubDomain = (website?: string) => {
    if (!website) return generateUniqueString(10);
    try {
        // Ensure that the website is a valid URL by adding a protocol
        const url = new URL(website.startsWith("http") ? website : `https://${website}`);
        // Extract the hostname
        const hostname = url.hostname;
        // Split the hostname into parts
        const hostnameParts = hostname.split(".");
        // Remove the top level domain
        hostnameParts.pop();
        // Remove the www subdomain
        if (hostnameParts[0] === "www") hostnameParts.shift();
        const result = hostnameParts.join("-");

        // add a prefix if it starts with a number
        const startsWithNumber = /^\d/.test(result);
        if (startsWithNumber) return `demo-${result}`;

        return result;
    } catch {
        return generateUniqueString(10);
    }
};

export const createDemoInstance = async (name: string) => {
    if (!name) throw new Error("No name provided");

    // Must be alphanumeric and should not contain any special characters, and must not start with a number
    const nameRegex = /^[a-zA-Z][a-zA-Z0-9-]*$/;
    if (!nameRegex.test(name)) throw new Error("Invalid name provided");

    const response = await axios.post(
        DEMO_INSTALLER_API_URL,
        {
            name,
            source: DEMO_INSTALLER_SOURCE,
        },
        {
            headers: {
                "api-key": DEMO_INSTALLER_API_KEY,
                authority: DEMO_INSTALLER_AUTHORITY,
                "Content-Type": "application/json",
                Accept: "*/*",
            },
        }
    );
    console.debug("CREATE_DEMO", response.data);
};

export const sendDemoMail = async (initialForm: { password: string; email: string; [key: string]: any }) => {
    const isDev = ENVIRONMENT === "development" || initialForm?.phone === "495678";
    const demoInstanceName = isDev ? "tobiasisthegreatest2" : generateSubDomain(initialForm.website);

    const demoURL = `https://${demoInstanceName}.butlerapp2.de`;
    const form: Record<string, any> = {
        ...initialForm,
        demoURL,
    };

    // Create demo instance

    // For testing purposes, we don't need to create a demo instance
    if (!isDev) {
        await createDemoInstance(demoInstanceName);
    }

    // Setup user account
    const response = await setupUserAccount(form);

    const loginURL = response.data.body.redirect.body;

    // Send an email informing the user that the demo is ready
    const htmlMessage = `
        <p>Hallo ${form?.name},</p>
        <p>Deine Demo ist ab jetzt für 30 Tage freigeschaltet.</p>
        <p>Du kannst dich in deine Butlerapp Demoversion unter folgendem Link anmelden: <a href="${loginURL}">${loginURL}</a></p>
        <p><strong>Falls du es noch nicht gemacht hast,</strong> empfehle ich dir in meinem Kalender einen Termin auszuwählen, wo ich dir eine auf dich zugeschnittene Demo von Butlerapp zeige. So findest du in unter 30 Minuten heraus ob Butlerapp für dich passt oder eben halt nicht.</p>
        <p><a href="https://calendly.com/irina-butlerapp/60min?back=1&amp;month=2024-01">>&gt; Jetzt Termin auswählen</a></p>
        <p>Ich freue mich schon auf unseren Termin und bis dann 😊</p>
        <p>P.S. <br/>
        Dies ist eine automatisch generierte Mail, aber du kannst mir bei Fragen gerne antworten 😊.</p>      
    `;

    const textMessage = `
        Hallo ${form?.name},

        Deine Demo ist ab jetzt für 30 Tage freigeschaltet.

        Du kannst dich in deine Butlerapp Demoversion unter folgendem Link anmelden: ${loginURL}

        Falls du es noch nicht gemacht hast, empfehle ich dir in meinem Kalender einen Termin auszuwählen, wo ich dir eine auf dich zugeschnittene Demo von Butlerapp zeige. So findest du in unter 30 Minuten heraus ob Butlerapp für dich passt oder eben halt nicht.

        >> Jetzt Termin auswählen (https://calendly.com/irina-butlerapp/60min?back=1&month=2024-01)

        Ich freue mich schon auf unseren Termin und bis dann 😊

        P.S.
        Dies ist eine automatisch generierte Mail, aber du kannst mir bei Fragen gerne antworten 😊.
    `;

    console.debug("DEMO_MAIL", textMessage);

    const mail = await transporter.sendMail({
        from: DEMO_FROM_EMAIL || MAIL_USER,
        to: form.email,
        subject: "Your demo is ready! - Butlerapp",
        text: textMessage,
        html: htmlMessage,
    });

    if (!mail.accepted.length) {
        throw new Error("Something went wrong while sending the mail. Try again later.");
    }

    await sendContactMail(form);
};
