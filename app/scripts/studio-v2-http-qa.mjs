/**
 * Studio V2 real-HTTP smoke against the isolated combined Backend/UI Mac Vite.
 * Read-only scene/source inspection; destructive commands are NEVER sent.
 * Does not log secrets, session cookies or CSRF tokens.
 *
 * Usage:
 * STUDIO_V2_OWNER_SECRET='<inherited environment, not shell history>' \
 *   node app/scripts/studio-v2-http-qa.mjs 001 balislam
 */
import {mkdir, writeFile} from "node:fs/promises";

const episode = process.argv[2] || "001";
const channel = process.argv[3] || "balislam";
const origin = process.env.STUDIO_V2_QA_ORIGIN || "http://127.0.0.1:4322";
const secret = process.env.STUDIO_V2_OWNER_SECRET;
if (!/^\d{3}$/.test(episode) ||
  !["balislam","dafatir-alzaman","zubdat-alkutub"].includes(channel) ||
  !["http://127.0.0.1:4322","http://localhost:4322"].includes(origin))
  throw Error("Refusing unsafe URL, channel or episode.");
if (!secret || Buffer.byteLength(secret,"utf8") < 32)
  throw Error("STUDIO_V2_OWNER_SECRET must be configured outside the command line.");

let cookie = "";
let csrf = "";
const evidence = { at: new Date().toISOString(), origin, channel, episode,
  requests: [], authenticated: false, result: "BLOCKED" };
const scope = "/api/studio-v2/episodes/" + episode;
const channelQuery = "?channel=" + channel;
const jsonHeaders = { Accept: "application/json" };
async function test(name, path, { method="GET", auth=false, body, wrongCsrf=false }={}) {
  const headers = { ...jsonHeaders, ...(auth ? { Cookie: cookie } : {}),
    ...(method==="GET" ? {} : {
      Origin: origin, "Content-Type": "application/json",
      ...(auth ? { "x-studio-v2-csrf": wrongCsrf ? "0".repeat(64) : csrf } : {}),
    }),
  };
  const response = await fetch(origin + path, {
    method, headers, redirect:"manual", signal:AbortSignal.timeout(10000),
    ...(method === "GET" ? {} : {body:JSON.stringify(body ?? {})}),
  });
  const text = await response.text();
  let payload;
  try { payload = JSON.parse(text); } catch { payload = null; }
  const code = payload && typeof payload.code === "string" ? payload.code : null;
  const item = { name, method, path, status: response.status, code };
  evidence.requests.push(item);
  console.log(method, path, response.status, code || "");
  return {response,payload};
}

try {
  const guest = await test("guest-session","/api/studio-v2/session");
  if (guest.response.status !== 401) throw Error("Expected guest 401; is Backend V2 enabled?");
  const login = await test("login","/api/studio-v2/session", {
    method:"POST", body: {secret},
  });
  if (login.response.status !== 200) throw Error("Owner login failed");
  const setCookie = login.response.headers.get("set-cookie") || "";
  const match = setCookie.match(/(?:^|;\s*)(studio_v2_sid=[a-f0-9]{64})(?:;|$)/);
  if (!match || !login.payload || typeof login.payload.csrfToken !== "string")
    throw Error("Owner cookie/CSRF missing");
  cookie = match[1];
  csrf = login.payload.csrfToken;
  evidence.authenticated = true;
  const valid = await test("owner-session","/api/studio-v2/session",{auth:true});
  if (valid.response.status !== 200) throw Error("Owner session cookie rejected");
  const csrfDenied = await test("csrf-denied",scope+"/sources"+channelQuery,{
    method:"POST",auth:true,wrongCsrf:true,body:{},
  });
  if (csrfDenied.response.status !== 403 || csrfDenied.payload?.code !== "V2_CSRF_REJECTED")
    throw Error("Missing CSRF 403 enforcement");
  const source = await test("source-read",scope+"/sources"+channelQuery,{auth:true});
  const scenes = await test("scene-read",scope+"/scenes"+channelQuery,{auth:true});
  if (scenes.response.status === 200 &&
    Array.isArray(scenes.payload?.scenes) && scenes.payload.scenes.length) {
    const first = scenes.payload.scenes[0].id;
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(first))
      throw Error("Backend returned invalid scene id");
    const rejected = await test("forbidden-field",
      scope+"/scenes/"+first+"/commands"+channelQuery,{
      method:"POST",auth:true,
      body:{action:"request_changes",note:"QA must not change state",actor:"forbidden"},
    });
    if (rejected.response.status !== 400 ||
      rejected.payload?.code !== "V2_FORBIDDEN_FIELD")
      throw Error("Backend accepted forbidden actor field");
  }
  const signout = await test("owner-logout","/api/studio-v2/session",{
    method:"DELETE",auth:true,body:{},
  });
  if (signout.response.status !== 200) throw Error("Logout failed");
  const after = await test("revoked-session","/api/studio-v2/session",{auth:true});
  if (after.response.status !== 401) throw Error("Logout did not revoke session");
  evidence.result = source.response.status === 200 && scenes.response.status === 200 ?
    "PASS_AUTH_READONLY" : "PARTIAL_AUTH_OK_EPISODE_NOT_READY";
} catch(e) {
  evidence.error = String(e?.message || e);
  console.error("BLOCKED:",evidence.error);
  process.exitCode = 1;
} finally {
  cookie = ""; csrf = "";
  const dest = "app/qa-artifacts";
  await mkdir(dest,{recursive:true});
  await writeFile(dest+"/studio-v2-http-qa.json",JSON.stringify(evidence,null,2));
  console.log("Redacted evidence:",dest+"/studio-v2-http-qa.json");
}
