// import fs from "fs";
// import path from "path";
import axios, { AxiosResponse } from "axios";
import nodemailer from "nodemailer";
const MATTERMOST_INBOUNDS_CHANNEL_ID = "pp9amtzhebdy8bi7ikz6m3jjgw";
const MATTERMOST_LEADS_CHANNEL_ID = "krr34khcafn75qffyfkxod9epa";

const MATTERMOST_TAYLOR_LEADS_CHANNEL_ID = "68paz7mcgjbety533xhsnsxefy";

import request from "graphql-request";

import {
    BAMBOO_SERVER_APP_ID,
    BAMBOO_SERVER_HOST,
    BAMBOO_TABLE_SLUG,
    BUTLERAPP_ACCOUNT_SETUP_ENDPOINT,
    BUTLERAPP_API_KEY,
    COURSE_CONFIGURATOR_TABLE_SLUG,
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

type MattermostPost = {
    id: string;
    [key: string]: any;
};

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

const sendMail = async (form: Record<string, any>, channelId: string) => {
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
                channel_id: channelId,
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

const sendMessageToChannel = async (form: Record<string, any>, channelId: string) => {
    try {
        const text = Object.entries(form)
            .map(([key, value]) => `${key}: ${value}`)
            .join("\n");

        const res = await axios.post<MattermostPost>(
            "https://mattermost.bambooapp.ai/api/v4/posts",
            {
                channel_id: channelId,
                message: text,
            },
            {
                headers: {
                    Authorization: `Bearer ${MATTERMOST_MAIL_BOT_ACCESS_TOKEN}`,
                },
            }
        );

        return res.data.id;
    } catch (error) {
        console.error(error);
    }
};

const updateMessageInChannel = async (form: Record<string, any>) => {
    const { postId, ...formData } = form;
    try {
        const text = Object.entries(formData)
            .map(([key, value]) => `${key}: ${value}`)
            .join("\n");

        const res = await axios.put<MattermostPost>(
            `https://mattermost.bambooapp.ai/api/v4/posts/${form.postId}`,
            {
                id: postId,
                message: text,
            },
            {
                headers: {
                    Authorization: `Bearer ${MATTERMOST_MAIL_BOT_ACCESS_TOKEN}`,
                },
            }
        );

        return res.data.id;
    } catch (error) {
        console.error(error);
    }
};

const createOrUpdatePostInChannel = async (formData: Record<string, any>, channelId: string) => {
    const { postId, date, phone, ...rest } = formData;
    // If there's no phone number, or the phone number includes the test phone number, don't send the message
    if (!phone || ["495678", "495679"].includes(phone)) return;

    if (postId) {
        return await updateMessageInChannel({
            phone,
            date: new Date(date).toLocaleString("de-DE"),
            postId,
            ...rest,
        });
    } else {
        return await sendMessageToChannel(
            {
                phone,
                date: new Date(date).toLocaleString("de-DE"),
                ...rest,
            },
            channelId
        );
    }
};

const sendDataToBambooTable = async (
    initialForm: Record<string, any>,
    tableSlug = BAMBOO_TABLE_SLUG,
    isExistingRecord?: boolean
) => {
    console.debug("START: SENDING DATA TO BAMBOO TABLE", initialForm, tableSlug);
    // Map form fields to bamboo fields
    const form =
        tableSlug === COURSE_CONFIGURATOR_TABLE_SLUG
            ? {
                  // Course configurator specific fields
                  _eventType: initialForm?.eventType,
                  _eventDate: initialForm?.eventDate,
                  _hasStartTimes: initialForm?.hasStartTimes,
                  _eventName: initialForm?.eventName,
                  _eventTime: initialForm?.eventTime,
                  _costType: initialForm?.costType,
                  _paymentMethods: initialForm?.paymentMethods,
                  _automationTypes: initialForm?.automationTypes,
                  _website: initialForm?.website,
                  _hasNoWebsite: initialForm?.hasNoWebsite,
                  _timestampId: initialForm?.timestampId,
                  _screenResolution: initialForm?.screenResolution,
              }
            : {
                  _firma_fldZjcqfv8yPKDyea: initialForm?.name || initialForm[QUIZ_NESTED_FORM_KEY]?.name,
                  _apEMail_fldViznFWpT4RVJnZ: initialForm?.email || initialForm[QUIZ_NESTED_FORM_KEY]?.email,
                  _apTelefon1_fldPOqfODf7TAodQV:
                      initialForm?.phone || initialForm[QUIZ_NESTED_FORM_KEY]?.phone,
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
                  _screenResolution: initialForm?.screenResolution,
                  _tags_fld2TIFNyJVVwymNs: initialForm?.tags,
                  ...(!isExistingRecord
                      ? {
                            _quelle_fldwPbyoIvdGPgmTi: "Butlerapp Inbound",
                            _status_fldxG5PdWUBHPf0RK: "Not contacted",
                        }
                      : {}),
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
                tableName:${tableSlug},
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

export const sendContactMailTaylor = async (form: Record<string, any>) => {
    try {
        const postIdRes = await createOrUpdatePostInChannel(form, MATTERMOST_TAYLOR_LEADS_CHANNEL_ID);
        console.debug("TAYLOR POST_ID", postIdRes);

        return postIdRes;
    } catch (err) {
        console.debug("TAYLOR: Error sending to mattermost", err);
    }
};

export const sendContactMail = async (form: Record<string, any>) => {
    // const tableSlug = form?.eventType ? COURSE_CONFIGURATOR_TABLE_SLUG : BAMBOO_TABLE_SLUG;
    const tableSlug = BAMBOO_TABLE_SLUG;
    try {
        const findRecordQuery = `
        query{
            ${tableSlug}(filtersSet: {conjunction: and, filtersSet: [{field: _timestampId, operator: "contains", value: ["${form.timestampId}"]}]}){
             records{
              result{
                id
              }
            }
            }
          }
        `;

        console.debug("FINDING RECORD", findRecordQuery, tableSlug);

        const res = await request(`${BAMBOO_SERVER_HOST}/${BAMBOO_SERVER_APP_ID}`, findRecordQuery);
        console.debug("FIND_RECORD_RESPONSE", res);

        const isExistingRecord = res[tableSlug].records.result[0]?.id;

        console.debug("RECORD FOUND", isExistingRecord);

        const { postId, ...formData } = form;

        await sendDataToBambooTable(formData, tableSlug, !!isExistingRecord);
        await sendMail(formData, MATTERMOST_INBOUNDS_CHANNEL_ID);

        // Create or Update post in leads channel
        const {
            phone,
            website,
            country,
            date,
            utmCampaign,
            utmSource,
            utmTerm,
            campaignName,
            demoURL,
            email,
        } = formData;
        const postIdRes = await createOrUpdatePostInChannel(
            {
                postId,
                phone,
                website,
                country,
                date,
                utmCampaign,
                utmSource,
                utmTerm,
                campaignName,
                demoURL,
                email,
            },
            MATTERMOST_LEADS_CHANNEL_ID
        );
        console.debug("POST_ID", postIdRes);

        return postIdRes;
    } catch (err) {
        console.debug("Error sending request to bamboo: Sending to Mattermost", err);
        await sendMail(form, MATTERMOST_INBOUNDS_CHANNEL_ID);
        // Create or Update post in leads channel
        const {
            postId,
            phone,
            website,
            country,
            date,
            utmCampaign,
            utmSource,
            utmTerm,
            campaignName,
            demoURL,
            email,
        } = form;
        const postIdRes = createOrUpdatePostInChannel(
            {
                postId,
                phone,
                website,
                country,
                date,
                utmCampaign,
                utmSource,
                utmTerm,
                campaignName,
                demoURL,
                email,
            },
            MATTERMOST_LEADS_CHANNEL_ID
        );
        console.debug("POST_ID", postIdRes);
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
        const result = hostnameParts.join("");

        // add a prefix if it starts with a number
        const startsWithNumber = /^\d/.test(result);
        if (startsWithNumber) return `demo${result}`;

        // escape special characters like hyphens
        const escapedResult = result.replace(/[^a-zA-Z0-9-]/g, "").replace(/-/g, "");

        if (escapedResult.length < 3) return generateUniqueString(10);
        return escapedResult;
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
    const oldHtmlMessage = `
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
    <span style="font-size: 11.0pt; font-family: 'Verdana',sans-serif; color: #5cb85c;"><strong>Irina Varapai</strong> | Butlerapp</span><br /> </span><strong><span style="font-size: 11.0pt; font-family: 'Verdana',sans-serif; color: #595959;">Kundenservice</span></strong><br /><br /><a href="mailto:irina@butlerapp.de"><img src="https://www.butlerapp.de/irina.png" alt="Irina Varapai" />
    </a>
    <br />
    <br />
    <span style="font-size: 17.0pt; font-family: 'Verdana',sans-serif; color: #595959;">📞&nbsp;</span><span style="color: #0563c1;">&nbsp;</span><a href="tel:+493031199425"><span style="font-size: 12.0pt; font-family: 'Verdana',sans-serif; color: #0563c1;">+49 30 311 99 425</span></a>
    <span style="font-size: 17.0pt; font-family: 'Verdana',sans-serif; color: #595959;"><br />📧&nbsp;</span><span style="color: #0563c1;">&nbsp;</span><a href="mailto:Irina@butlerapp.de"><span style="font-size: 12.0pt; font-family: 'Verdana',sans-serif; color: #0563c1;">Irina@butlerapp.de</span></a>
    <span style="font-size: 17.0pt; font-family: 'Verdana',sans-serif; color: #595959;"><br />🌐&nbsp;</span><span style="color: #0563c1;">&nbsp;</span><a href="https://www.butlerapp.de" target="_blank"><span style="font-size: 12.0pt; font-family: 'Verdana',sans-serif; color: #0563c1;">www.butlerapp.de</span></a></p><br />
    <hr />
    <p><span style="color: #0563c1;"></span><a href="https://www.butlerapp.de/" target="_blank"><img src="https://www.butlerapp.de/butlerapp-logo.png" alt="Butlerapp" />
    </a><br /><span style="font-size: 11.0pt;"><span style="font-family: 'Verdana',sans-serif; color: #595959;"><br /><span style="font-size: 11.0pt; font-family: 'Verdana',sans-serif; color: #595959;">Software made with&nbsp;<span style="font-size: 11.0pt; font-family: 'Verdana',sans-serif; color: #e30a16;">♥</span>&nbsp;in Berlin</span></span><br /><span style="color: #0563c1;"></span><span style="font-family: 'Verdana',sans-serif; color: #595959;"><br />Webbee GmbH<br />Oberwallstraße 6<br />10117 Berlin<br />Geschäftsführer: Tobias Anhalt</span></span></p></span>
    `;

    const htmlMessage = `
    <!DOCTYPE html PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN" "http://www.w3.org/TR/html4/loose.dtd">
<html data-lt-installed="true">

<head>
	<style data-em-localization="true">
		table:empty::before {
			/*content: 'Paste block here';*/
		}

		[em="block"].empty-structure td:not([height]):not([width]):empty::before {
			/*content: 'Paste atom here';*/
		}

		.em-block-insert:after {
			content: 'Вставить сюда' !important;
		}

		.em-atom-insert:after,
		.em-blockatom-insert:after {
			content: 'Вставить сюда' !important;
		}
	</style>
	<style data-theme-varibalse="true">
		:root {
			--blue: #1677ff;
			--purple: #722ED1;
			--cyan: #13C2C2;
			--green: #52C41A;
			--magenta: #EB2F96;
			--pink: #eb2f96;
			--red: #F5222D;
			--orange: #FA8C16;
			--yellow: #FADB14;
			--volcano: #FA541C;
			--geekblue: #2F54EB;
			--gold: #FAAD14;
			--lime: #A0D911;
			--colorPrimary: #1668dc;
			--colorSuccess: #49aa19;
			--colorWarning: #d89614;
			--colorError: #dc4446;
			--colorInfo: #7f4ac0;
			--colorLink: #177ddc;
			--colorTextBase: #fff;
			--colorBgBase: #1F1F1F;
			--fontFamily: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial,
				'Noto Sans', sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol',
				'Noto Color Emoji';
			--fontFamilyCode: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace;
			--lineType: solid;
			--motionEaseOutCirc: cubic-bezier(0.08, 0.82, 0.17, 1);
			--motionEaseInOutCirc: cubic-bezier(0.78, 0.14, 0.15, 0.86);
			--motionEaseOut: cubic-bezier(0.215, 0.61, 0.355, 1);
			--motionEaseInOut: cubic-bezier(0.645, 0.045, 0.355, 1);
			--motionEaseOutBack: cubic-bezier(0.12, 0.4, 0.29, 1.46);
			--motionEaseInBack: cubic-bezier(0.71, -0.46, 0.88, 0.6);
			--motionEaseInQuint: cubic-bezier(0.755, 0.05, 0.855, 0.06);
			--motionEaseOutQuint: cubic-bezier(0.23, 1, 0.32, 1);
			--colorLinkHover: #69c0ff;
			--colorDarken1: rgba(0, 0, 0, 0.9);
			--colorFillSecondaryDarken: rgba(255, 255, 255, 0.16);
			--borderColorHover: rgba(255, 255, 255, 0.3);
			--blue-1: #111a2c;
			--blue1: #111a2c;
			--blue-2: #112545;
			--blue2: #112545;
			--blue-3: #15325b;
			--blue3: #15325b;
			--blue-4: #15417e;
			--blue4: #15417e;
			--blue-5: #1554ad;
			--blue5: #1554ad;
			--blue-6: #1668dc;
			--blue6: #1668dc;
			--blue-7: #3c89e8;
			--blue7: #3c89e8;
			--blue-8: #65a9f3;
			--blue8: #65a9f3;
			--blue-9: #8dc5f8;
			--blue9: #8dc5f8;
			--blue-10: #b7dcfa;
			--blue10: #b7dcfa;
			--purple-1: #1a1325;
			--purple1: #1a1325;
			--purple-2: #24163a;
			--purple2: #24163a;
			--purple-3: #301c4d;
			--purple3: #301c4d;
			--purple-4: #3e2069;
			--purple4: #3e2069;
			--purple-5: #51258f;
			--purple5: #51258f;
			--purple-6: #642ab5;
			--purple6: #642ab5;
			--purple-7: #854eca;
			--purple7: #854eca;
			--purple-8: #ab7ae0;
			--purple8: #ab7ae0;
			--purple-9: #cda8f0;
			--purple9: #cda8f0;
			--purple-10: #ebd7fa;
			--purple10: #ebd7fa;
			--cyan-1: #112123;
			--cyan1: #112123;
			--cyan-2: #113536;
			--cyan2: #113536;
			--cyan-3: #144848;
			--cyan3: #144848;
			--cyan-4: #146262;
			--cyan4: #146262;
			--cyan-5: #138585;
			--cyan5: #138585;
			--cyan-6: #13a8a8;
			--cyan6: #13a8a8;
			--cyan-7: #33bcb7;
			--cyan7: #33bcb7;
			--cyan-8: #58d1c9;
			--cyan8: #58d1c9;
			--cyan-9: #84e2d8;
			--cyan9: #84e2d8;
			--cyan-10: #b2f1e8;
			--cyan10: #b2f1e8;
			--green-1: #162312;
			--green1: #162312;
			--green-2: #1d3712;
			--green2: #1d3712;
			--green-3: #274916;
			--green3: #274916;
			--green-4: #306317;
			--green4: #306317;
			--green-5: #3c8618;
			--green5: #3c8618;
			--green-6: #49aa19;
			--green6: #49aa19;
			--green-7: #6abe39;
			--green7: #6abe39;
			--green-8: #8fd460;
			--green8: #8fd460;
			--green-9: #b2e58b;
			--green9: #b2e58b;
			--green-10: #d5f2bb;
			--green10: #d5f2bb;
			--magenta-1: #291321;
			--magenta1: #291321;
			--magenta-2: #40162f;
			--magenta2: #40162f;
			--magenta-3: #551c3b;
			--magenta3: #551c3b;
			--magenta-4: #75204f;
			--magenta4: #75204f;
			--magenta-5: #a02669;
			--magenta5: #a02669;
			--magenta-6: #cb2b83;
			--magenta6: #cb2b83;
			--magenta-7: #e0529c;
			--magenta7: #e0529c;
			--magenta-8: #f37fb7;
			--magenta8: #f37fb7;
			--magenta-9: #f8a8cc;
			--magenta9: #f8a8cc;
			--magenta-10: #fad2e3;
			--magenta10: #fad2e3;
			--pink-1: #291321;
			--pink1: #291321;
			--pink-2: #40162f;
			--pink2: #40162f;
			--pink-3: #551c3b;
			--pink3: #551c3b;
			--pink-4: #75204f;
			--pink4: #75204f;
			--pink-5: #a02669;
			--pink5: #a02669;
			--pink-6: #cb2b83;
			--pink6: #cb2b83;
			--pink-7: #e0529c;
			--pink7: #e0529c;
			--pink-8: #f37fb7;
			--pink8: #f37fb7;
			--pink-9: #f8a8cc;
			--pink9: #f8a8cc;
			--pink-10: #fad2e3;
			--pink10: #fad2e3;
			--red-1: #2a1215;
			--red1: #2a1215;
			--red-2: #431418;
			--red2: #431418;
			--red-3: #58181c;
			--red3: #58181c;
			--red-4: #791a1f;
			--red4: #791a1f;
			--red-5: #a61d24;
			--red5: #a61d24;
			--red-6: #d32029;
			--red6: #d32029;
			--red-7: #e84749;
			--red7: #e84749;
			--red-8: #f37370;
			--red8: #f37370;
			--red-9: #f89f9a;
			--red9: #f89f9a;
			--red-10: #fac8c3;
			--red10: #fac8c3;
			--orange-1: #2b1d11;
			--orange1: #2b1d11;
			--orange-2: #442a11;
			--orange2: #442a11;
			--orange-3: #593815;
			--orange3: #593815;
			--orange-4: #7c4a15;
			--orange4: #7c4a15;
			--orange-5: #aa6215;
			--orange5: #aa6215;
			--orange-6: #d87a16;
			--orange6: #d87a16;
			--orange-7: #e89a3c;
			--orange7: #e89a3c;
			--orange-8: #f3b765;
			--orange8: #f3b765;
			--orange-9: #f8cf8d;
			--orange9: #f8cf8d;
			--orange-10: #fae3b7;
			--orange10: #fae3b7;
			--yellow-1: #2b2611;
			--yellow1: #2b2611;
			--yellow-2: #443b11;
			--yellow2: #443b11;
			--yellow-3: #595014;
			--yellow3: #595014;
			--yellow-4: #7c6e14;
			--yellow4: #7c6e14;
			--yellow-5: #aa9514;
			--yellow5: #aa9514;
			--yellow-6: #d8bd14;
			--yellow6: #d8bd14;
			--yellow-7: #e8d639;
			--yellow7: #e8d639;
			--yellow-8: #f3ea62;
			--yellow8: #f3ea62;
			--yellow-9: #f8f48b;
			--yellow9: #f8f48b;
			--yellow-10: #fafab5;
			--yellow10: #fafab5;
			--volcano-1: #2b1611;
			--volcano1: #2b1611;
			--volcano-2: #441d12;
			--volcano2: #441d12;
			--volcano-3: #592716;
			--volcano3: #592716;
			--volcano-4: #7c3118;
			--volcano4: #7c3118;
			--volcano-5: #aa3e19;
			--volcano5: #aa3e19;
			--volcano-6: #d84a1b;
			--volcano6: #d84a1b;
			--volcano-7: #e87040;
			--volcano7: #e87040;
			--volcano-8: #f3956a;
			--volcano8: #f3956a;
			--volcano-9: #f8b692;
			--volcano9: #f8b692;
			--volcano-10: #fad4bc;
			--volcano10: #fad4bc;
			--geekblue-1: #131629;
			--geekblue1: #131629;
			--geekblue-2: #161d40;
			--geekblue2: #161d40;
			--geekblue-3: #1c2755;
			--geekblue3: #1c2755;
			--geekblue-4: #203175;
			--geekblue4: #203175;
			--geekblue-5: #263ea0;
			--geekblue5: #263ea0;
			--geekblue-6: #2b4acb;
			--geekblue6: #2b4acb;
			--geekblue-7: #5273e0;
			--geekblue7: #5273e0;
			--geekblue-8: #7f9ef3;
			--geekblue8: #7f9ef3;
			--geekblue-9: #a8c1f8;
			--geekblue9: #a8c1f8;
			--geekblue-10: #d2e0fa;
			--geekblue10: #d2e0fa;
			--gold-1: #2b2111;
			--gold1: #2b2111;
			--gold-2: #443111;
			--gold2: #443111;
			--gold-3: #594214;
			--gold3: #594214;
			--gold-4: #7c5914;
			--gold4: #7c5914;
			--gold-5: #aa7714;
			--gold5: #aa7714;
			--gold-6: #d89614;
			--gold6: #d89614;
			--gold-7: #e8b339;
			--gold7: #e8b339;
			--gold-8: #f3cc62;
			--gold8: #f3cc62;
			--gold-9: #f8df8b;
			--gold9: #f8df8b;
			--gold-10: #faedb5;
			--gold10: #faedb5;
			--lime-1: #1f2611;
			--lime1: #1f2611;
			--lime-2: #2e3c10;
			--lime2: #2e3c10;
			--lime-3: #3e4f13;
			--lime3: #3e4f13;
			--lime-4: #536d13;
			--lime4: #536d13;
			--lime-5: #6f9412;
			--lime5: #6f9412;
			--lime-6: #8bbb11;
			--lime6: #8bbb11;
			--lime-7: #a9d134;
			--lime7: #a9d134;
			--lime-8: #c9e75d;
			--lime8: #c9e75d;
			--lime-9: #e4f88b;
			--lime9: #e4f88b;
			--lime-10: #f0fab5;
			--lime10: #f0fab5;
			--colorText: rgba(255, 255, 255, 0.85);
			--colorTextSecondary: rgba(255, 255, 255, 0.65);
			--colorTextTertiary: rgba(255, 255, 255, 0.45);
			--colorTextQuaternary: rgba(255, 255, 255, 0.25);
			--colorFill: rgba(255, 255, 255, 0.18);
			--colorFillSecondary: rgba(255, 255, 255, 0.12);
			--colorFillTertiary: rgba(255, 255, 255, 0.08);
			--colorFillQuaternary: rgba(255, 255, 255, 0.04);
			--colorBgLayout: #1f1f1f;
			--colorBgContainer: #333333;
			--colorBgElevated: #3e3e3e;
			--colorBgSpotlight: #616161;
			--colorBgBlur: rgba(255, 255, 255, 0.04);
			--colorBorder: #616161;
			--colorBorderSecondary: #4f4f4f;
			--colorPrimaryBg: #111a2c;
			--colorPrimaryBgHover: #112545;
			--colorPrimaryBorder: #15325b;
			--colorPrimaryBorderHover: #15417e;
			--colorPrimaryHover: #3c89e8;
			--colorPrimaryActive: #1554ad;
			--colorPrimaryTextHover: #3c89e8;
			--colorPrimaryText: #1668dc;
			--colorPrimaryTextActive: #1554ad;
			--colorSuccessBg: #162312;
			--colorSuccessBgHover: #1d3712;
			--colorSuccessBorder: #274916;
			--colorSuccessBorderHover: #306317;
			--colorSuccessHover: #306317;
			--colorSuccessActive: #3c8618;
			--colorSuccessTextHover: #6abe39;
			--colorSuccessText: #49aa19;
			--colorSuccessTextActive: #3c8618;
			--colorErrorBg: #2c1618;
			--colorErrorBgHover: #451d1f;
			--colorErrorBorder: #5b2526;
			--colorErrorBorderHover: #7e2e2f;
			--colorErrorHover: #e86e6b;
			--colorErrorActive: #ad393a;
			--colorErrorTextHover: #e86e6b;
			--colorErrorText: #dc4446;
			--colorErrorTextActive: #ad393a;
			--colorWarningBg: #2b2111;
			--colorWarningBgHover: #443111;
			--colorWarningBorder: #594214;
			--colorWarningBorderHover: #7c5914;
			--colorWarningHover: #7c5914;
			--colorWarningActive: #aa7714;
			--colorWarningTextHover: #e8b339;
			--colorWarningText: #d89614;
			--colorWarningTextActive: #aa7714;
			--colorInfoBg: #1d1727;
			--colorInfoBgHover: #2b1e3d;
			--colorInfoBorder: #3a2751;
			--colorInfoBorderHover: #4d316f;
			--colorInfoHover: #4d316f;
			--colorInfoActive: #663e97;
			--colorInfoTextHover: #a374d6;
			--colorInfoText: #7f4ac0;
			--colorInfoTextActive: #663e97;
			--colorLinkActive: #1765ad;
			--colorBgMask: rgba(0, 0, 0, 0.45);
			--colorWhite: #fff;
			--motionDurationFast: 0.1s;
			--motionDurationMid: 0.2s;
			--motionDurationSlow: 0.3s;
			--colorFillContent: rgba(255, 255, 255, 0.12);
			--colorFillContentHover: rgba(255, 255, 255, 0.18);
			--colorFillAlter: rgba(255, 255, 255, 0.04);
			--colorBgContainerDisabled: rgba(255, 255, 255, 0.08);
			--colorBorderBg: #333333;
			--colorSplit: rgba(251, 251, 251, 0.14);
			--colorTextPlaceholder: rgba(255, 255, 255, 0.25);
			--colorTextDisabled: rgba(255, 255, 255, 0.25);
			--colorTextHeading: rgba(255, 255, 255, 0.85);
			--colorTextLabel: rgba(255, 255, 255, 0.65);
			--colorTextDescription: rgba(255, 255, 255, 0.45);
			--colorTextLightSolid: #fff;
			--colorHighlight: #dc4446;
			--colorBgTextHover: rgba(255, 255, 255, 0.12);
			--colorBgTextActive: rgba(255, 255, 255, 0.18);
			--colorIcon: rgba(255, 255, 255, 0.45);
			--colorIconHover: rgba(255, 255, 255, 0.85);
			--colorErrorOutline: rgba(39, 0, 4, 0.57);
			--colorWarningOutline: rgba(39, 24, 0, 0.67);
			--controlItemBgHover: rgba(255, 255, 255, 0.08);
			--controlItemBgActive: #111a2c;
			--controlItemBgActiveHover: #112545;
			--controlItemBgActiveDisabled: rgba(255, 255, 255, 0.18);
			--controlTmpOutline: rgba(255, 255, 255, 0.04);
			--controlOutline: rgba(0, 14, 41, 0.67);
			--linkDecoration: none;
			--linkHoverDecoration: none;
			--linkFocusDecoration: none;
			--boxShadow:
				0 6px 16px 0 rgba(0, 0, 0, 0.08),
				0 3px 6px -4px rgba(0, 0, 0, 0.12),
				0 9px 28px 8px rgba(0, 0, 0, 0.05);
			--boxShadowSecondary:
				0 6px 16px 0 rgba(0, 0, 0, 0.08),
				0 3px 6px -4px rgba(0, 0, 0, 0.12),
				0 9px 28px 8px rgba(0, 0, 0, 0.05);
			--boxShadowTertiary:
				0 1px 2px 0 rgba(0, 0, 0, 0.03),
				0 1px 6px -1px rgba(0, 0, 0, 0.02),
				0 2px 4px 0 rgba(0, 0, 0, 0.02);
			--boxShadowPopoverArrow: 2px 2px 5px rgba(0, 0, 0, 0.05);
			--boxShadowCard:
				0 1px 2px -2px rgba(0, 0, 0, 0.16),
				0 3px 6px 0 rgba(0, 0, 0, 0.12),
				0 5px 12px 4px rgba(0, 0, 0, 0.09);
			--boxShadowDrawerRight:
				-6px 0 16px 0 rgba(0, 0, 0, 0.08),
				-3px 0 6px -4px rgba(0, 0, 0, 0.12),
				-9px 0 28px 8px rgba(0, 0, 0, 0.05);
			--boxShadowDrawerLeft:
				6px 0 16px 0 rgba(0, 0, 0, 0.08),
				3px 0 6px -4px rgba(0, 0, 0, 0.12),
				9px 0 28px 8px rgba(0, 0, 0, 0.05);
			--boxShadowDrawerUp:
				0 6px 16px 0 rgba(0, 0, 0, 0.08),
				0 3px 6px -4px rgba(0, 0, 0, 0.12),
				0 9px 28px 8px rgba(0, 0, 0, 0.05);
			--boxShadowDrawerDown:
				0 -6px 16px 0 rgba(0, 0, 0, 0.08),
				0 -3px 6px -4px rgba(0, 0, 0, 0.12),
				0 -9px 28px 8px rgba(0, 0, 0, 0.05);
			--boxShadowTabsOverflowLeft: inset 10px 0 8px -8px rgba(0, 0, 0, 0.08);
			--boxShadowTabsOverflowRight: inset -10px 0 8px -8px rgba(0, 0, 0, 0.08);
			--boxShadowTabsOverflowTop: inset 0 10px 8px -8px rgba(0, 0, 0, 0.08);
			--boxShadowTabsOverflowBottom: inset 0 -10px 8px -8px rgba(0, 0, 0, 0.08);
			--_tokenKey: 1sq59ij;
			--_hashId: css-1cqogtq;
		}
	</style>
	<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
	<link rel="stylesheet" type="text/css" em="css" href="css/sandbox.css?25339bdda523b1e9d860">
	<link rel="stylesheet" type="text/css" em="css" href="css/sandbox-dark.css?25339bdda523b1e9d860">
	<link rel="stylesheet" type="text/css" em="css" href="css/line-awesome/line-awesome.min.css?25339bdda523b1e9d860">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<title>Willkommen an Board!</title>
	<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,400&amp;display=swap"
		em-class="em-font-Inter-Regular">
	<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Mulish:ital,wght@0,400&amp;display=swap"
		em-class="em-font-Mulish-Regular">
	<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,500&amp;display=swap"
		em-class="em-font-Inter-Medium">
	<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,600&amp;display=swap"
		em-class="em-font-Inter-SemiBold">
	<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,700&amp;display=swap"
		em-class="em-font-Inter-Bold">
	<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,800&amp;display=swap"
		em-class="em-font-Inter-ExtraBold">
	<style type="text/css">
		html {
			-webkit-text-size-adjust: none;
			-ms-text-size-adjust: none;
		}
	</style>
	<style em="styles">
		.em-font-Inter-ExtraBold {
			font-weight: 800 !important;
		}

		.em-font-Inter-Bold,
		.em-font-Inter-ExtraBold {
			font-family: Inter, sans-serif !important;
		}

		.em-font-Inter-Bold {
			font-weight: 700 !important;
		}

		.em-font-Inter-SemiBold,
		.em-font-Mulish-SemiBold {
			font-weight: 600 !important;
		}

		.em-font-Inter-Medium,
		.em-font-Inter-SemiBold {
			font-family: Inter, sans-serif !important;
		}

		.em-font-Inter-Regular,
		.em-font-Mulish-Regular {
			font-weight: 400 !important;
		}

		.em-font-Mulish-Regular {
			font-family: Mulish, sans-serif !important;
		}

		.em-font-Inter-Regular {
			font-family: Inter, sans-serif !important;
		}

		@media only screen and (max-device-width:660px),
		only screen and (max-width:660px) {
			.em-mob-wrap.em-mob-wrap-cancel {
				display: table-cell !important;
			}

			.em-narrow-table {
				width: 100% !important;
				max-width: 660px !important;
				min-width: 280px !important;
			}

			.em-mob-padding_top-0 {
				padding-top: 0 !important;
			}

			.em-mob-height-auto {
				height: auto !important;
			}

			.em-mob-width-auto {
				width: auto !important;
			}

			.em-mob-padding_bottom-30 {
				padding-bottom: 30px !important;
			}

			.em-mob-padding_top-25 {
				padding-top: 25px !important;
			}

			.em-mob-font_size-15px {
				font-size: 15px !important;
			}

			.em-mob-padding_top-20 {
				padding-top: 20px !important;
			}

			.em-mob-height-20px {
				height: 20px !important;
			}

			.em-mob-width-60px {
				width: 60px !important;
				max-width: 60px !important;
				min-width: 60px !important;
			}

			.em-mob-width-70perc {
				width: 70% !important;
				max-width: 70% !important;
				min-width: 70% !important;
			}

			.em-mob-padding_bottom-20 {
				padding-bottom: 20px !important;
			}

			.em-mob-padding_top-30 {
				padding-top: 30px !important;
			}

			.em-mob-line_height-25px {
				line-height: 25px !important;
			}

			.em-mob-font_size-30px {
				font-size: 30px !important;
			}

			.em-mob-width-15perc {
				width: 15% !important;
				max-width: 15% !important;
				min-width: 15% !important;
			}

			.em-mob-wrap {
				display: block !important;
			}

			.em-mob-padding_right-20 {
				padding-right: 20px !important;
			}

			.em-mob-padding_left-20 {
				padding-left: 20px !important;
			}

			.em-mob-table_align-center {
				margin: 0 auto !important;
			}

			.em-mob-font_size-20px {
				font-size: 20px !important;
			}

			.em-mob-font_size-14px {
				font-size: 14px !important;
			}

			.em-mob-line_height-21px {
				line-height: 21px !important;
			}

			.em-mob-padding_bottom-10 {
				padding-bottom: 10px !important;
			}

			.em-mob-width-100perc {
				width: 100% !important;
				max-width: 100% !important;
				min-width: 100% !important;
			}

			.em-mob-text_align-center {
				text-align: center !important;
			}

			.em-mob-width-80perc {
				width: 80% !important;
				max-width: 80% !important;
				min-width: 80% !important;
			}
		}
	</style>
</head>

<body class="null mceNonEditable" style="margin: 0; padding: 0;" data-new-gr-c-s-check-loaded="14.1169.0"
	data-gr-ext-installed="" data-new-gr-c-s-loaded="14.1171.0">
	<span class="preheader"
		style="display: none !important; visibility: hidden; opacity: 0; color: #F8F8F8; height: 0; width: 0; font-size: 1px;">Deine
		Butlerapp-Demo wartet auf
		dich&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</span>
	<!--[if !mso]><!-->
	<div style="font-size:0px;color:transparent;opacity:0;">
		⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
	</div>
	<!--<![endif]-->
	<table cellpadding="0" cellspacing="0" border="0" width="100%" style="font-size: 1px; line-height: 16px;">
		<tr em="group">
			<td style="padding: 40px 0px; background-repeat: repeat; background-size: cover; background-color: #ffffff;"
				align="center"
				class="null em-mob-padding_top-20 em-mob-padding_right-20 em-mob-padding_bottom-20 em-mob-padding_left-20"
				bgcolor="#FFFFFF">
				<!--[if (gte mso 9)|(IE)]>
				<table cellpadding="0" cellspacing="0" border="0" width="660"><tr><td>
				<![endif]-->
				<table cellpadding="0" cellspacing="0" width="100%" border="0"
					style="max-width: 660px; min-width: 660px; width: 660px;" class="em-narrow-table">
					<tr em="block" class="em-structure">
						<td align="center"
							style="padding: 20px; border-top-left-radius: 16px; border-top-right-radius: 16px; background-color: #f3f4ff;"
							class="em-mob-padding_right-20 em-mob-padding_bottom-10 em-mob-padding_left-20" bgcolor="#f3f4ff">
							<table border="0" cellspacing="0" cellpadding="0" class="em-mob-width-100perc">
								<tr>
									<td width="620" class="em-mob-wrap em-mob-wrap-cancel em-mob-width-auto">
										<table cellpadding="0" cellspacing="0" border="0" width="100%" em="atom">
											<tr>
												<td align="center">
													<a href="https://www.butlerapp.de/" target="_blank">
														<img
															src="https://buchungsbutler.de/wp-content/uploads/2024/04/Butlerapp_Logo_Transparent.png"
															border="0" alt="" style="display: block; width: 100%; max-width: 160px;"
															class="em-mob-width-60px" width="160">
												</td>
											</tr>
										</table>
									</td>
								</tr>
							</table>
						</td>
					</tr>
					<tr em="block" class="em-structure">
						<td valign="top"
							class="em-mob-height-auto em-mob-padding_top-20 em-mob-padding_right-20 em-mob-padding_bottom-20 em-mob-padding_left-20"
							height="400"
							style="background-position: center center; padding: 20px 40px 40px; background-repeat: no-repeat; height: 400px; background-size: cover; border-bottom-right-radius: 16px; border-bottom-left-radius: 16px;"
							background="https://buchungsbutler.de/wp-content/uploads/2024/05/231227_4213_JWpsktU.png" bgcolor="b8c1f3"
							align="center">
							<table border="0" cellspacing="0" cellpadding="0" class="em-mob-width-100perc">
								<tr>
									<td width="580" class="em-mob-wrap em-mob-width-100perc" align="center">
										<table cellpadding="0" cellspacing="0" border="0" width="100%" em="atom">
											<tr>
												<td style="padding-bottom: 10px;" class="em-mob-padding_top-0 em-mob-padding_bottom-10">
													<div
														style="font-family: Helvetica, Arial, sans-serif; font-size: 28px; line-height: 38px; color: #0b2541;"
														align="center" class="em-font-Inter-ExtraBold em-mob-font_size-15px"><b
															class="em-mob-line_height-25px em-mob-font_size-20px">Willkommen bei Butlerapp!</b></div>
												</td>
											</tr>
										</table>
										<table cellpadding="0" cellspacing="0" border="0" width="100%" em="atom"
											class="em-mob-width-100perc">
											<tr>
												<td style="padding-bottom: 20px;" class="em-mob-padding_bottom-30">
													<div
														style="font-family: Helvetica, Arial, sans-serif; font-size: 16px; line-height: 25px; color: #ffffff;"
														align="center" class="em-font-Inter-Regular em-mob-font_size-14px em-mob-line_height-21px">
														Wir bedanken uns für dein Interesse und freuen uns, dich an Bord zu haben.<br>Starte jetzt
														deine <span style="color: #0b2541;"><strong>kostenlose </strong></span><strong><span
																style="color: #0b2541;">30-Tage-Demo</span></strong>.<br></div>
												</td>
											</tr>
										</table>

									</td>
								</tr>
							</table>
							<table border="0" cellspacing="0" cellpadding="0" class="em-mob-width-100perc">
								<tr>
									<td width="166" valign="top" class="em-mob-wrap em-mob-width-100perc">
										<table cellpadding="0" cellspacing="0" border="0" width="100%" em="atom">
											<tr>
												<td style="padding-bottom: 20px;" class="em-mob-padding_bottom-10">
													<table cellpadding="0" cellspacing="0" border="0" width="180"
														class="em-mob-table_align-center" style="width: 180px;">
														<tr>
															<td align="center" valign="middle"
																style="background-color: #1a334e; border-radius: 5px; height: 50px; box-shadow: #0b2541 2px 3px 5px -3px;"
																bgcolor="#1a334e" height="50">
																<a href="${loginURL}" target="_blank"
																	style="display: block; font-family: Helvetica, Arial, sans-serif; color: #ffffff; font-size: 17px; text-decoration: none; white-space: nowrap; height: 50px; line-height: 50px;"
																	class="em-font-Inter-Regular"><strong style="line-height: 50px;">Demo öffnen</strong></a>
															</td>
														</tr>
													</table>
												</td>
											</tr>
										</table>
									</td>
									<td width="10" class="em-mob-wrap">&nbsp;</td>
								</tr>
							</table>
						</td>
					</tr>
					<tr em="block" class="em-structure">
						<td align="center">
							<table cellpadding="0" cellspacing="0" border="0" width="100%" em="atom">
								<tr>
									<td height="40" class="em-mob-height-20px"></td>
								</tr>
							</table>
						</td>
					</tr>
					<tr em="block" class="em-structure">
						<td dir="rtl" align="center" style="padding-top: 40px; padding-right: 40px; padding-left: 40px;"
							bgcolor="#FFFFFF"
							class="em-mob-text_align-center em-mob-padding_top-20 em-mob-padding_right-20 em-mob-padding_bottom-20 em-mob-padding_left-20">
							<table border="0" cellspacing="0" cellpadding="0" class="em-mob-width-100perc">
								<tr>
									<td dir="ltr" width="275" valign="middle" class="em-mob-wrap em-mob-width-100perc">
										<table cellpadding="0" cellspacing="0" border="0" width="100%" em="atom">
											<tr>
												<td align="center">
													<img
														src="https://buchungsbutler.de/wp-content/uploads/2024/05/draw-person-who-has-lots-of-questions-he-turn-to.png"
														border="0" alt="" style="display: block; border-radius: 5px; width: 100%; max-width: 100%;"
														class="em-mob-border_radius-topLeft-7px em-mob-border_radius-topRight-7px em-mob-border_radius-bottomLeft-0px em-mob-width-70perc"
														width="100%">
												</td>
											</tr>
										</table>
									</td>
									<td width="30" class="em-mob-wrap">&nbsp;</td>
									<td dir="ltr" width="275" align="center" class="em-mob-wrap em-mob-width-100perc">


										<table cellpadding="0" cellspacing="0" border="0" width="1120%" em="atom">
											<tr>
												<td style="padding-right: 0px; padding-bottom: 10px; padding-left: 0px;"
													class="em-mob-padding_bottom-20">
													<div
														style="font-family: -apple-system, 'Segoe UI', 'Helvetica Neue', Helvetica, Roboto, Arial, sans-serif; font-size: 30px; line-height: 38px; color: #576490;"
														align="left" class="em-mob-text_align-center"><strong class="em-mob-font_size-30px">Hast du
															noch Fragen?</strong></div>
												</td>
											</tr>
										</table>

										<table cellpadding="0" cellspacing="0" border="0" width="100%" em="atom">
											<tr>
												<td style="padding-bottom: 10px;" align="center">
													<div
														style="font-family: Helvetica, Arial, sans-serif; font-size: 14px; line-height: 21px; color: #191919;"
														class="em-font-Mulish-Regular em-mob-text_align-center" align="left">Du möchtest wissen, wie
														man Butlerapp einbindet oder den Nachrichtenversand einstellt?<br><br>Gerne helfen wir dir
														dabei Butlerapp näher kennenzulernen.<br>Erfahre in <strong><u>unter 30
																Minuten</u></strong>, ob wir zu dir passen.</div>
												</td>
											</tr>
										</table>
										<table cellpadding="0" cellspacing="0" border="0" width="100%" em="atom">
											<tr>
												<td style="padding: 20px 0px 10px;">
													<table cellpadding="0" cellspacing="0" border="0" style="width: 160px;" width="160"
														class="em-mob-table_align-center">
														<tr>
															<td align="center" valign="middle"
																style="border-radius: 5px; background-color: #016bff; background-repeat: repeat; height: 45px; box-shadow: #0b2541 1px 2px 3px -1px;"
																bgcolor="#016bff" height="45">
																<a style="display: block; font-family: Helvetica, Arial, sans-serif; font-size: 16px; text-decoration: none; white-space: nowrap; color: #ffffff; height: 45px; line-height: 45px;"
																	class="em-font-Inter-Regular" target="_blank"
																	href="https://calendly.com/irina-butlerapp/60min"><strong>Termin
																		buchen&nbsp;</strong></a>
															</td>
														</tr>
													</table>
												</td>
											</tr>
										</table>


									</td>
								</tr>
							</table>
						</td>
					</tr>
					<tr em="block" class="em-structure">
						<td align="center" style="padding-top: 40px; padding-right: 40px; padding-left: 40px;"
							class="em-mob-padding_left-20 em-mob-padding_right-20">
							<table align="center" border="0" cellspacing="0" cellpadding="0" class="em-mob-width-100perc">
								<tr>
									<td width="580" valign="top" class="em-mob-wrap em-mob-width-100perc">
										<table cellpadding="0" cellspacing="0" border="0" width="100%" em="atom">
											<tr>
												<td style="padding: 20px 0 10px;">
													<div
														style="font-family: -apple-system, 'Segoe UI', 'Helvetica Neue', Helvetica, Roboto, Arial, sans-serif; font-size: 24px; line-height: 32px; color: #333333;"
														align="center"><strong>Dit find ick knorke!</strong></div>
												</td>
											</tr>
										</table>
										<table cellpadding="0" cellspacing="0" border="0" width="100%" em="atom">
											<tr>
												<td style="padding-bottom: 10px;">
													<div
														style="font-family: -apple-system, 'Segoe UI', 'Helvetica Neue', Helvetica, Roboto, Arial, sans-serif; font-size: 16px; line-height: 21px; color: #5a5a5a;"
														align="center">Gründe, warum uns unsere Kunden lieben:</div>
												</td>
											</tr>
										</table>

									</td>
								</tr>
							</table>
						</td>
					</tr>
					<tr em="block" class="em-structure">
						<td style="padding: 16px 22px 40px 11px;" bgcolor="#FFFFFF"
							class="em-mob-padding_top-20 em-mob-padding_right-20 em-mob-padding_bottom-20 em-mob-padding_left-20">
							<table border="0" cellspacing="0" cellpadding="0" class="em-mob-width-100perc">
								<tr>
									<td width="194" valign="top" class="em-mob-wrap em-mob-width-100perc">
										<table width="100%" border="0" cellspacing="0" cellpadding="0">
											<tr>
												<td align="left">
													<table cellpadding="0" cellspacing="0" border="0" width="100%" em="atom">
														<tr>
															<td style="padding-top: 10px;" class="em-mob-padding_top-25" align="center">
																<img src="https://buchungsbutler.de/wp-content/uploads/2024/05/231227_4213_1KHiSRT.png"
																	width="40" border="0" alt=""
																	style="display: block; width: 100%; max-width: 40px; border-radius: 5px;"
																	class="em-mob-width-15perc">
															</td>
														</tr>
													</table>
												</td>
											</tr>
											<tr>
												<td align="center" valign="top" class="em-mob-height-auto">
													<table cellpadding="0" cellspacing="0" border="0" width="100%" em="atom"
														class="em-mob-width-100perc">
														<tr>
															<td style="padding-top: 20px; padding-bottom: 19px;"
																class="em-mob-padding_top-20 em-mob-text_align-center" align="center">
																<a href="" target="_blank"
																	style="font-family: Helvetica, Arial, sans-serif; font-size: 18px; line-height: 21px; text-decoration: none; color: #576490;"
																	class="em-font-Inter-Bold">Exklusive Vorteile</a>
															</td>
														</tr>
													</table>

												</td>
											</tr>
											<tr>
												<td align="center">
													<table cellpadding="0" cellspacing="0" border="0" width="100%" em="atom"
														class="em-mob-width-80perc">
														<tr>
															<td align="center">
																<div
																	style="font-family: Helvetica, Arial, sans-serif; font-size: 14px; line-height: 21px; color: #5a5a5a;"
																	class="em-font-Mulish-Regular" align="center">Erlebe eine breite Funktionspalette,
																	regelmäßige Updates und maßgeschneiderte Benutzererfahrung.</div>
															</td>
														</tr>
													</table>
												</td>
											</tr>
										</table>
									</td>
									<td width="22" class="em-mob-wrap">&nbsp;</td>
									<td width="194" valign="top" class="em-mob-wrap em-mob-width-100perc">
										<table width="100%" border="0" cellspacing="0" cellpadding="0">
											<tr>
												<td align="left">
													<table cellpadding="0" cellspacing="0" border="0" width="100%" em="atom">
														<tr>
															<td style="padding-top: 10px;" class="em-mob-padding_top-30" align="center">
																<img src="https://buchungsbutler.de/wp-content/uploads/2024/05/231227_4213_F6I8x2d.png"
																	width="40" border="0" alt=""
																	style="display: block; width: 100%; max-width: 40px; border-radius: 5px;"
																	class="em-mob-width-15perc">
															</td>
														</tr>
													</table>
												</td>
											</tr>
											<tr>
												<td valign="top" class="em-mob-height-auto" align="center">
													<table cellpadding="0" cellspacing="0" border="0" width="100%" em="atom"
														class="em-mob-width-100perc">
														<tr>
															<td style="padding-top: 20px; padding-bottom: 3px;"
																class="em-mob-padding_top-20 em-mob-text_align-center" align="center">
																<a style="font-family: Helvetica, Arial, sans-serif; line-height: 21px; text-decoration: none; color: #576490; font-size: 18px;"
																	class="em-font-Inter-Bold" target="_blank">Gestaffeltes Preismodell</a>
															</td>
														</tr>
													</table>
													<table cellpadding="0" cellspacing="0" border="0" width="100%" em="atom"
														class="em-mob-width-80perc">
														<tr>
															<td>
																<div
																	style="font-family: Helvetica, Arial, sans-serif; font-size: 14px; line-height: 21px; color: #5a5a5a;"
																	class="em-font-Mulish-Regular" align="center">Ein Preismodell, optimal an dein
																	Unternehmen angepasst.</div>
															</td>
														</tr>
													</table>
												</td>
											</tr>
										</table>
									</td>
									<td width="22" class="em-mob-wrap">&nbsp;</td>
									<td width="196" valign="top" class="em-mob-wrap em-mob-width-100perc">
										<table width="100%" border="0" cellspacing="0" cellpadding="0">
											<tr>
												<td align="left">
													<table cellpadding="0" cellspacing="0" border="0" width="100%" em="atom">
														<tr>
															<td style="padding-top: 10px;" class="em-mob-padding_top-30" align="center">
																<img src="https://buchungsbutler.de/wp-content/uploads/2024/05/231227_4213_jxKnHjc.png"
																	width="40" border="0" alt=""
																	style="display: block; width: 100%; max-width: 40px; border-radius: 5px;"
																	class="em-mob-width-15perc">
															</td>
														</tr>
													</table>
												</td>
											</tr>
											<tr>
												<td align="center" valign="top" height="140" style="height: 140px;" class="em-mob-height-auto">
													<table cellpadding="0" cellspacing="0" border="0" width="100%" em="atom"
														class="em-mob-width-100perc">
														<tr>
															<td style="padding-top: 20px; padding-bottom: 19px;"
																class="em-mob-padding_top-20 em-mob-text_align-center" align="center">
																<a style="font-family: Helvetica, Arial, sans-serif; font-size: 18px; line-height: 21px; text-decoration: none; color: #576490;"
																	class="em-font-Inter-Bold" target="_blank">Kundenorientierung&nbsp;</a>
															</td>
														</tr>
													</table>
													<table cellpadding="0" cellspacing="0" border="0" width="100%" em="atom"
														class="em-mob-width-80perc">
														<tr>
															<td>
																<div
																	style="font-family: Helvetica, Arial, sans-serif; font-size: 14px; line-height: 21px; color: #5a5a5a;"
																	class="em-font-Mulish-Regular" align="center">Wir passen uns an deine Bedürfnisse an
																	und betreuen dich in voller Länge.</div>
															</td>
														</tr>
													</table>
												</td>
											</tr>
										</table>
									</td>
								</tr>
							</table>
						</td>
					</tr>
					<tr em="block" class="em-structure">
						<td align="center">
							<table cellpadding="0" cellspacing="0" border="0" width="100%" em="atom">
								<tr>
									<td height="40" class="em-mob-height-20px"></td>
								</tr>
							</table>
						</td>
					</tr>
					<tr em="block" class="em-structure">
						<td align="center"
							style="padding: 40px; background-color: #b8c1f3; background-repeat: repeat; background-size: cover; border-radius: 16px;"
							class="em-mob-padding_top-20 em-mob-padding_right-20 em-mob-padding_bottom-20 em-mob-padding_left-20"
							bgcolor="#B8C1F3">
							<table border="0" cellspacing="0" cellpadding="0" class="em-mob-width-100perc">
								<tr>
									<td width="580" valign="top" class="em-mob-wrap em-mob-width-100perc">
										<table cellpadding="0" cellspacing="0" border="0" width="100%" em="atom">
											<tr>
												<td align="center" style="padding-bottom: 30px;">
													<img src="https://buchungsbutler.de/wp-content/uploads/2024/04/Butlerapp_Logo_Transparent.png"
														border="0" alt="" style="display: block; width: 100%; max-width: 150px;" width="150">
												</td>
											</tr>
										</table>
									</td>
								</tr>
							</table>
							<table border="0" cellspacing="0" cellpadding="0" class="em-mob-width-100perc">
								<tr>
									<td width="580" valign="top" class="em-mob-wrap em-mob-width-100perc" align="center">
										<table cellpadding="0" cellspacing="0" border="0" width="90%" em="atom"
											class="em-mob-width-100perc">
											<tr>
												<td style="padding-bottom: 30px;" align="center">
													<div
														style="font-family: Helvetica, Arial, sans-serif; font-size: 18px; line-height: 25px; color: #ffffff;"
														class="em-font-Inter-Regular em-mob-font_size-14px em-mob-line_height-25px">„Ich brauche ja
														so gut wie nichts machen, selbst wenn der Kunde anruft und ich den Kunden selbst einbuche,
														geht’s sehr schnell. Der Arbeitsaufwand, den wir uns einsparen ist wirklich enorm.“<br>
													</div>
												</td>
											</tr>
										</table>
										<table cellpadding="0" cellspacing="0" border="0" width="100%" em="atom">
											<tr>
												<td align="center" style="padding-bottom: 10px;">
													<img src="https://buchungsbutler.de/wp-content/uploads/2024/05/christopher.f8c9ba9e.webp"
														width="80" border="0" alt=""
														style="display: block; width: 100%; max-width: 80px; border-radius: 100px;">
												</td>
											</tr>
										</table>
										<table cellpadding="0" cellspacing="0" border="0" width="100%" em="atom">
											<tr>
												<td style="padding-bottom: 5px;">
													<div
														style="font-family: Helvetica, Arial, sans-serif; line-height: 14px; font-size: 14px; color: #ffffff;"
														align="center" class="em-font-Inter-SemiBold">Christopher Käßberger</div>
												</td>
											</tr>
										</table>
										<table cellpadding="0" cellspacing="0" border="0" width="100%" em="atom">
											<tr>
												<td>
													<div
														style="font-family: Helvetica, Arial, sans-serif; font-size: 12px; line-height: 14px; color: #e1e1e1;"
														align="center" class="em-font-Inter-Regular">Inhaber Chiemsee Sailing Center</div>
												</td>
											</tr>
										</table>
									</td>
								</tr>
							</table>
						</td>
					</tr>
					<tr em="block" class="em-structure">
						<td align="center">
							<table cellpadding="0" cellspacing="0" border="0" width="100%" em="atom">
								<tr>
									<td height="40"></td>
								</tr>
							</table>
						</td>
					</tr>
					<tr em="block" class="em-structure">
						<td style="padding: 40px 40px 20px;"
							class="em-mob-padding_top-20 em-mob-padding_right-20 em-mob-padding_bottom-20 em-mob-padding_left-20">
							<table border="0" cellspacing="0" cellpadding="0" class="em-mob-width-100perc">
								<tr>
									<td width="280" valign="top" class="em-mob-wrap em-mob-width-100perc">

										<table cellpadding="0" cellspacing="0" border="0" width="100%" em="atom">
											<tr>
												<td style="padding-right: 0px; padding-bottom: 5px; padding-left: 0px;">
													<div
														style="font-family: -apple-system, 'Segoe UI', 'Helvetica Neue', Helvetica, Roboto, Arial, sans-serif; font-size: 24px; line-height: 32px; color: #576490;">
														<strong>Kontaktiere uns</strong></div>
												</td>
											</tr>
										</table>
										<table cellpadding="0" cellspacing="0" border="0" width="100%" em="atom">
											<tr>
												<td style="padding-bottom: 10px; padding-top: 5px;">
													<div
														style="font-family: Helvetica, Arial, sans-serif; font-size: 14px; line-height: 21px; color: #333333;"
														class="em-font-Mulish-Regular">Hast du noch Fragen oder benötigst weitere
														Informationen?<br>Wir sind hier, um zu helfen!</div>
												</td>
											</tr>
										</table>


									</td>
									<td width="20" class="em-mob-wrap"></td>
									<td width="280" valign="middle" class="em-mob-wrap em-mob-width-100perc">
										<table cellpadding="0" cellspacing="0" border="0" width="100%" em="atom">
											<tr>
												<td style="padding-right: 0px; padding-bottom: 2px; padding-left: 0px;">
													<div
														style="font-family: -apple-system, 'Segoe UI', 'Helvetica Neue', Helvetica, Roboto, Arial, sans-serif; font-size: 16px; line-height: 21px; color: #333333;">
														<strong>E-Mail</strong></div>
												</td>
											</tr>
										</table>
										<table cellpadding="0" cellspacing="0" border="0" width="100%" em="atom">
											<tr>
												<td style="padding-bottom: 10px;">
													<div
														style="font-family: Helvetica, Arial, sans-serif; font-size: 12px; line-height: 16px; color: #5a5a5a;"
														class="em-font-Mulish-Regular">irina@butlerapp.de</div>
												</td>
											</tr>
										</table>

										<table cellpadding="0" cellspacing="0" border="0" width="100%" em="atom">
											<tr>
												<td style="padding: 10px 0px 2px;">
													<div
														style="font-family: -apple-system, 'Segoe UI', 'Helvetica Neue', Helvetica, Roboto, Arial, sans-serif; font-size: 16px; line-height: 21px; color: #333333;">
														<strong>Kontakt&nbsp;</strong></div>
												</td>
											</tr>
										</table>
										<table cellpadding="0" cellspacing="0" border="0" width="100%" em="atom">
											<tr>
												<td style="padding-bottom: 10px;">
													<div
														style="font-family: Helvetica, Arial, sans-serif; font-size: 12px; line-height: 16px; color: #5a5a5a;"
														class="em-font-Mulish-Regular">+49 30 311 99 425</div>
												</td>
											</tr>
										</table>
										<table cellpadding="0" cellspacing="0" border="0" width="100%" em="atom">
											<tr>
												<td style="padding: 10px 0px 2px;">
													<div
														style="font-family: -apple-system, 'Segoe UI', 'Helvetica Neue', Helvetica, Roboto, Arial, sans-serif; font-size: 16px; line-height: 21px; color: #333333;">
														<b>Webbee GmbH</b></div>
												</td>
											</tr>
										</table>
										<table cellpadding="0" cellspacing="0" border="0" width="100%" em="atom">
											<tr>
												<td style="padding-bottom: 10px;">
													<div
														style="font-family: Helvetica, Arial, sans-serif; font-size: 12px; line-height: 16px; color: #5a5a5a;"
														class="em-font-Mulish-Regular"><b>Mühlenstraße 8a</b><br><b>14167
															Berlin</b><br>Geschäftsführer: Tobias Anhalt<br></div>
												</td>
											</tr>
										</table>
									</td>
								</tr>
							</table>
						</td>
					</tr>
				</table>
				<!--[if (gte mso 9)|(IE)]>
				</td></tr></table>
				<![endif]-->
			</td>
		</tr>
	</table>
</body>

</html>
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
    Software made with ♥ in Berlin
    \n\n
    Webbee GmbH\n
    Oberwallstraße 6\n
    10117 Berlin\n
    Geschäftsführer: Tobias Anhalt
    `;

    console.debug("DEMO_MAIL", textMessage);

    const mail = await transporter.sendMail({
        from: `Butlerapp <${DEMO_FROM_EMAIL || MAIL_USER}>`,
        to: form.email,
        subject: "Willkommen an Board!",
        text: textMessage,
        html: htmlMessage,
    });

    if (!mail.accepted.length) {
        throw new Error("Something went wrong while sending the mail. Try again later.");
    }

    await sendContactMail(form);
};
