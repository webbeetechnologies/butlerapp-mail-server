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
    DEMO_BCC_EMAIL,
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

    // remove undefined keys from the object
    Object.keys(form).forEach((key) => form[key] === undefined && delete form[key]);
    console.debug("SENDING FORM DATA", form);

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
    const isDev = ENVIRONMENT === "development" || initialForm?.phone === "495679";
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
        // Wait for the demo instance to be created, otherwise the account setup will fail

        // Wait for 60 seconds
        console.debug("Waiting for Demo Instance to be created: 60s");
        await new Promise((resolve) => setTimeout(resolve, 60000));
        console.debug("Demo Instance created! Setting up user account");
    }

    // Setup user account
    const response = await setupUserAccount(form);

    // Delete password from form
    delete form.password;

    const loginURL = response.data.body.redirect.body;

    // Send an email informing the user that the demo is ready
    const htmlMessage = `
    <span style="color: rgb(34, 34, 34); font-family: Arial, Helvetica, sans-serif; font-size: small;">Hallo ${form?.name},</span><div style="color: rgb(34, 34, 34); font-family: Arial, Helvetica, sans-serif; font-size: small;"><div><br>
    </div><div>Deine Demoversion ist jetzt für <b>30 Tage</b> freigeschaltet. <br>
    </div><div><br>
    </div><div><div>Du kannst dich in deine Butlerapp Demoversion unter folgendem Link anmelden:</div><div><br>
    </div><div><font size="4"><a href="${loginURL}" target="_blank" style="color: rgb(17, 85, 204);">» Demo</a></font></div><div><br>
    </div><div>Unser Handbuch zur Software findest du unter folgendem Link:</div><div><br>
    </div><div><font size="4"><a href="https://intercom.help/butler/de/collections/3160101-butler-knowledgebase" target="_blank" style="color: rgb(17, 85, 204);">» Handbuch</a></font></div><div><br>
    </div><div><b>Falls du es noch nicht gemacht hast,</b> empfehle ich dir in meinem Kalender einen Termin auszuwählen, wo ich dir eine auf dich zugeschnittene Demo von Butlerapp zeige. So findest du in unter 30 Minuten heraus ob Butlerapp für dich passt oder eben halt nicht.</div><div><br>
    </div><div><font size="4"><a href="https://calendly.com/irina-butlerapp/60min?back=1&amp;month=2024-01" target="_blank" style="color: rgb(17, 85, 204);">» Jetzt Termin auswählen</a></font></div><div><br>
    </div><div>Ich freue mich schon auf unseren Termin und bis dann <img data-emoji="😊" class="an1" alt="😊" aria-label="😊" src="https://fonts.gstatic.com/s/e/notoemoji/15.0/1f60a/72.png" loading="lazy" style="height: 1.2em; width: 1.2em; vertical-align: middle;"></div><div><br>
    </div><div>P.S. </div><div>Dies ist eine automatisch generierte Mail, aber du kannst mir bei Fragen gerne antworten <img data-emoji="😊" class="an1" alt="😊" aria-label="😊" src="https://fonts.gstatic.com/s/e/notoemoji/15.0/1f60a/72.png" loading="lazy" style="height: 1.2em; width: 1.2em; vertical-align: middle;">.</div></div></div><div style="color: rgb(34, 34, 34); font-family: Arial, Helvetica, sans-serif; font-size: small;"><br>
    </div><span class="gmail_signature_prefix" style="color: rgb(34, 34, 34); font-family: Arial, Helvetica, sans-serif; font-size: small;">--</span><br style="color: rgb(34, 34, 34); font-family: Arial, Helvetica, sans-serif; font-size: small;">
    <span style="font-size: 11.0pt; font-family: 'Verdana',sans-serif; color: #5cb85c;"><strong>Irina Varapai</strong> | Butlerapp</span><br /> </span><strong><span style="font-size: 11.0pt; font-family: 'Verdana',sans-serif; color: #595959;">Kundenservice</span></strong><br /><br /><a href="mailto:irina@butlerapp.de"><img src="data:image/png;base64,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" alt="Irina Varapai" />
    </a>
    <br />
    <br />
    <span style="font-size: 17.0pt; font-family: 'Verdana',sans-serif; color: #595959;">📞&nbsp;</span><span style="color: #0563c1;">&nbsp;</span><a href="tel:+493031199425"><span style="font-size: 12.0pt; font-family: 'Verdana',sans-serif; color: #0563c1;">+49 30 311 99 425</span></a>
    <span style="font-size: 17.0pt; font-family: 'Verdana',sans-serif; color: #595959;"><br />📧&nbsp;</span><span style="color: #0563c1;">&nbsp;</span><a href="mailto:Irina@butlerapp.de"><span style="font-size: 12.0pt; font-family: 'Verdana',sans-serif; color: #0563c1;">Irina@butlerapp.de</span></a>
    <span style="font-size: 17.0pt; font-family: 'Verdana',sans-serif; color: #595959;"><br />🌐&nbsp;</span><span style="color: #0563c1;">&nbsp;</span><a href="https://www.butlerapp.de" target="_blank"><span style="font-size: 12.0pt; font-family: 'Verdana',sans-serif; color: #0563c1;">www.butlerapp.de</span></a></p><br />
    <hr />
    <p><span style="color: #0563c1;"></span><a href="https://www.butlerapp.de/" target="_blank"><img src="data:image/png;base64,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 AElFTkSuQmCC" alt="Butlerapp" />
    </a><br /><span style="font-size: 11.0pt;"><span style="font-family: 'Verdana',sans-serif; color: #595959;"><br /><span style="font-size: 11.0pt; font-family: 'Verdana',sans-serif; color: #595959;">Software made with&nbsp;<span style="font-size: 11.0pt; font-family: 'Verdana',sans-serif; color: #e30a16;">♥</span>&nbsp;in Berlin</span></span><br /><span style="color: #0563c1;"></span><span style="font-family: 'Verdana',sans-serif; color: #595959;"><br />Webbee GmbH<br />Oberwallstraße 6<br />10117 Berlin<br />Geschäftsführer: Tobias Anhalt</span></span></p></span>
    `;

    const textMessage = `
    Hallo ${form?.name},
    \n\n
    Deine Demoversion ist jetzt für 30 Tage freigeschaltet. 
    \n\n
    Du kannst dich in deine Butlerapp Demoversion unter folgendem Link anmelden:\n
    ${loginURL}
    \n\n
    Unser Handbuch zur Software findest du unter folgendem Link:\n
    https://intercom.help/butler/de/collections/3160101-butler-knowledgebase
    \n\n
    Falls du es noch nicht gemacht hast, empfehle ich dir in meinem Kalender einen Termin auszuwählen, wo ich dir eine auf dich zugeschnittene Demo von Butlerapp zeige. So findest du in unter 30 Minuten heraus ob Butlerapp für dich passt oder eben halt nicht.\n
    https://calendly.com/irina-butlerapp/60min?back=1&amp;month=2024-01
    \n\n
    Ich freue mich schon auf unseren Termin und bis dann 😊
    \n\n
    P.S.\n
    Dies ist eine automatisch generierte Mail, aber du kannst mir bei Fragen gerne antworten 😊.
    \n\n
    --
    \n\n
    Irina Varapai
    \n\n
    Tel: +49 30 311 994 25\n
    Mail: irina@butlerapp.de\n
    Web: www.butlerapp.de\n
    \n\n
    Webbee GmbH\n
    Oberwallstraße 6\n
    10117 Berlin\n
    Geschäftsführer: Tobias Anhalt\n
    Amtsgericht Charlottenburg | HRB 192759\n
    `;

    console.debug("DEMO_MAIL", textMessage);

    const mail = await transporter.sendMail({
        from: DEMO_FROM_EMAIL || MAIL_USER,
        to: form.email,
        subject: "🔥 Deine Demo wartet auf dich! — Butlerapp",
        text: textMessage,
        html: htmlMessage,
    });

    if (!mail.accepted.length) {
        throw new Error("Something went wrong while sending the mail. Try again later.");
    }

    await sendContactMail(form);
};
