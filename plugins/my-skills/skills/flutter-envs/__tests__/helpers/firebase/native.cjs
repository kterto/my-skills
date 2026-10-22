"use strict";
// Synthetic native Firebase files, shaped like the console's downloads. Every value is a fake; the API keys carry a
// SENTINEL marker so a test can prove no value reaches an output.

const escape = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// clients: [{ pkg, appId, apiKey, type1: [clientId...], type3: [clientId...], foreignType1: [{ pkg, id }] }]
function googleServicesJson({ projectId, projectNumber, bucket, clients }) {
  return JSON.stringify({
    project_info: { project_number: projectNumber, project_id: projectId, storage_bucket: bucket },
    client: clients.map((c) => ({
      client_info: { mobilesdk_app_id: c.appId, android_client_info: { package_name: c.pkg } },
      oauth_client: [
        ...(c.type1 || []).map((id, n) => ({ client_id: id, client_type: 1, android_info: { package_name: c.pkg, certificate_hash: `${n}`.repeat(40) } })),
        ...(c.foreignType1 || []).map((f) => ({ client_id: f.id, client_type: 1, android_info: { package_name: f.pkg, certificate_hash: "f".repeat(40) } })),
        ...(c.type3 || []).map((id) => ({ client_id: id, client_type: 3 })),
      ],
      api_key: [{ current_key: c.apiKey }],
      services: { appinvite_service: { other_platform_oauth_client: [] } },
    })),
    configuration_version: "1",
  }, null, 2);
}

function infoPlist(entries) {
  const body = Object.entries(entries).map(([k, v]) => {
    const value = typeof v === "boolean" ? `<${v}/>` : Number.isInteger(v) ? `<integer>${v}</integer>` : `<string>${escape(v)}</string>`;
    return `\t<key>${escape(k)}</key>\n\t${value}`;
  });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    '<plist version="1.0">',
    "<dict>",
    ...body,
    "</dict>",
    "</plist>",
    "",
  ].join("\n");
}

// One environment's pair of files for com.acme.shop.dev in acme-dev-staging, with one client of each kind.
function devPair(overrides = {}) {
  const android = {
    projectId: "acme-dev-staging",
    projectNumber: "111111111111",
    bucket: "acme-dev-staging.appspot.com",
    clients: [
      { pkg: "com.acme.shop.dev", appId: "1:111111111111:android:aaaa", apiKey: "AIza-SENTINEL-ANDROID-DEV", type1: ["111-dev-android.apps.googleusercontent.com"], type3: ["111-web-first.apps.googleusercontent.com", "111-web-second.apps.googleusercontent.com"] },
      { pkg: "com.acme.shop.staging", appId: "1:111111111111:android:bbbb", apiKey: "AIza-SENTINEL-ANDROID-STG", type1: ["111-stg-android.apps.googleusercontent.com"], type3: ["111-web-first.apps.googleusercontent.com"] },
    ],
    ...overrides.android,
  };
  const ios = {
    CLIENT_ID: "111-dev-ios.apps.googleusercontent.com",
    REVERSED_CLIENT_ID: "com.googleusercontent.apps.111-dev-ios",
    API_KEY: "AIza-SENTINEL-IOS-DEV",
    GCM_SENDER_ID: "111111111111",
    PLIST_VERSION: "1",
    BUNDLE_ID: "com.acme.shop.dev",
    PROJECT_ID: "acme-dev-staging",
    STORAGE_BUCKET: "acme-dev-staging.appspot.com",
    IS_ADS_ENABLED: false,
    IS_ANALYTICS_ENABLED: false,
    IS_GCM_ENABLED: true,
    IS_SIGNIN_ENABLED: true,
    GOOGLE_APP_ID: "1:111111111111:ios:cccc",
    ...overrides.ios,
  };
  return { json: googleServicesJson(android), plist: infoPlist(ios), android, ios };
}

module.exports = { googleServicesJson, infoPlist, devPair };
