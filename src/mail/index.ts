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
        // Wait for the demo instance to be created, otherwise the account setup will fail

        // Wait for 10 seconds
        console.debug("Waiting for Demo Instance to be created: 20s");
        await new Promise((resolve) => setTimeout(resolve, 20000));
        console.debug("Demo Instance created! Setting up user account");
    }

    // Setup user account
    const response = await setupUserAccount(form);

    // Delete password from form
    delete form.password;

    const loginURL = response.data.body.redirect.body;

    // Send an email informing the user that the demo is ready
    const htmlMessage = `
    <span style="color: rgb(34, 34, 34); font-family: Arial, Helvetica, sans-serif; font-size: small;">Hallo X,</span><div style="color: rgb(34, 34, 34); font-family: Arial, Helvetica, sans-serif; font-size: small;"><div><br>
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
    </div><span class="gmail_signature_prefix" style="color: rgb(34, 34, 34); font-family: Arial, Helvetica, sans-serif; font-size: small;">--</span><br style="color: rgb(34, 34, 34); font-family: Arial, Helvetica, sans-serif; font-size: small;"><div dir="ltr" class="gmail_signature" data-smartmail="gmail_signature" style="color: rgb(34, 34, 34); font-family: Arial, Helvetica, sans-serif; font-size: small;"><div dir="ltr"><div dir="ltr"><div dir="ltr"><div dir="ltr"><div dir="ltr"><div dir="ltr"><div dir="ltr"><div dir="ltr"><div style="color: rgb(38, 38, 38); font-family: -apple-system, system-ui, sans-serif; font-size: 14px; font-weight: bold;"><br>
    </div><div style="color: rgb(38, 38, 38); font-family: -apple-system, system-ui, sans-serif; font-size: 14px; font-weight: bold;">Tobias Anhalt<br>
    </div><div style="color: rgb(38, 38, 38); font-family: -apple-system, system-ui, sans-serif; font-size: 14px; font-weight: bold;"><br>
    </div><div><font color="#262626" face="-apple-system, system-ui, sans-serif"><span style="font-size: 14px;">Tel: </span></font>+49 30 31199677</div><div style="color: rgb(38, 38, 38); font-family: -apple-system, system-ui, sans-serif; font-size: 14px;">Mail: <a href="mailto:tobias@butlerapp.de" target="_blank" style="color: rgb(17, 85, 204);">tobias@butlerapp.de</a></div><div style="color: rgb(38, 38, 38); font-family: -apple-system, system-ui, sans-serif; font-size: 14px;">Web: <a href="https://www.butlerapp.de/" target="_blank" style="color: rgb(17, 85, 204);">www.butlerapp.de</a></div><div style="color: rgb(38, 38, 38); font-family: -apple-system, system-ui, sans-serif; font-size: 14px;"></div><div style="color: rgb(38, 38, 38); font-family: -apple-system, system-ui, sans-serif; font-size: 14px;"><br>
    </div><div style="color: rgb(38, 38, 38); font-family: -apple-system, system-ui, sans-serif; font-size: 14px;"><div>Webbee GmbH</div><div>Oberwallstraße 6</div><div>10117 Berlin</div><div>Geschäftsführer: Tobias Anhalt</div><div>Amtsgericht Charlottenburg | HRB 192759</div></div></div></div></div></div></div></div></div></div></div>     
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
    Tobias Anhalt
    \n\n
    Tel:  +49 30 31199677\n
    Mail: tobias@butlerapp.de\n
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
        subject: "Deine Demo wartet auf dich! — Butlerapp",
        text: textMessage,
        html: htmlMessage,
    });

    if (!mail.accepted.length) {
        throw new Error("Something went wrong while sending the mail. Try again later.");
    }

    await sendContactMail(form);
};
