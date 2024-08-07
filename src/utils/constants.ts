export const ENVIRONMENT = process.env.ENVIRONMENT;

export const MONGODB_URI = process.env.MONGODB_URI;

export const JWT_SECRET_KEY = process.env.JWT_SECRET_KEY;

export const CLIENT_ADDRESS = process.env.CLIENT_ADDRESS;

export const MAIL_HOST = process.env.MAIL_HOST;
export const MAIL_PORT = +process.env.MAIL_PORT;
export const MAIL_SECURE = process.env.MAIL_SECURE === "true";
export const MAIL_USER = process.env.MAIL_USER;
export const MAIL_PASSWORD = process.env.MAIL_PASSWORD;
export const MAIL_FROM = process.env.MAIL_FROM;
export const MAIL_TO = process.env.MAIL_TO;

export const MATTERMOST_MAIL_BOT_ACCESS_TOKEN = process.env.MATTERMOST_MAIL_BOT_ACCESS_TOKEN;

export const SITE_NAME = "My Site";

export const BAMBOO_SERVER_HOST = process.env.BAMBOO_SERVER_HOST;
export const BAMBOO_SERVER_APP_ID = process.env.BAMBOO_SERVER_APP_ID;
export const BAMBOO_TABLE_SLUG = process.env.BAMBOO_TABLE_SLUG;
export const BAMBOO_API_TOKEN = process.env.BAMBOO_API_TOKEN;
export const BAMBOO_CLIENT_ID = process.env.BAMBOO_CLIENT_ID;
export const COURSE_CONFIGURATOR_TABLE_SLUG = process.env.COURSE_CONFIGURATOR_TABLE_SLUG;
export const QUIZ_NESTED_FORM_KEY = "Deine Demoversion steht bereit";

// TWILIO
export const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
export const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
export const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;
export const TWILIO_FROM_NUMBER = process.env.TWILIO_FROM_NUMBER;
export const CUSTOMER_REP_NUMBER = process.env.CUSTOMER_REP_NUMBER;

// DEMO Installation
export const DEMO_INSTALLER_API_URL = process.env.DEMO_INSTALLER_API_URL;
export const DEMO_INSTALLER_API_KEY = process.env.DEMO_INSTALLER_API_KEY;
export const DEMO_INSTALLER_AUTHORITY = process.env.DEMO_INSTALLER_AUTHORITY;
export const DEMO_INSTALLER_SOURCE = process.env.DEMO_INSTALLER_SOURCE;

export const BUTLERAPP_ACCOUNT_SETUP_ENDPOINT = process.env.BUTLERAPP_ACCOUNT_SETUP_ENDPOINT;
export const BUTLERAPP_API_KEY = process.env.BUTLERAPP_API_KEY;
export const DEMO_FROM_EMAIL = process.env.DEMO_FROM_EMAIL;
export const DEMO_BCC_EMAIL = process.env.DEMO_BCC_EMAIL;
