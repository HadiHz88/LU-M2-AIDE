// Exercise 5: load_test.js plus a third scenario sending bad credentials at 5/s.
//
//   k6 run loadtests/wrong_password_test.js                 // naive: 401s count as failures
//   EXPECT_401=1 k6 run loadtests/wrong_password_test.js    // fixed: 401 is an expected status
import http from "k6/http";
import { check } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://127.0.0.1:8000";
const USER = { username: "loadtester", password: "loadtest123" };
const BAD_USER = { username: "loadtester", password: "wrong-pass1" };
const DURATION = __ENV.DURATION || "2m";
const EXPECT_401 = __ENV.EXPECT_401 === "1";

export const options = {
  cloud: { name: `Auth app - 50 RPS + bad logins${EXPECT_401 ? " (401 expected)" : ""}` },

  scenarios: {
    browse: {
      executor: "constant-arrival-rate",
      exec: "browse",
      rate: 40,
      timeUnit: "1s",
      duration: DURATION,
      preAllocatedVUs: 20,
      maxVUs: 100,
    },
    login: {
      executor: "constant-arrival-rate",
      exec: "login",
      rate: 10,
      timeUnit: "1s",
      duration: DURATION,
      preAllocatedVUs: 10,
      maxVUs: 100,
    },
    bad_login: {
      executor: "constant-arrival-rate",
      exec: "badLogin",
      rate: 5,
      timeUnit: "1s",
      duration: DURATION,
      preAllocatedVUs: 5,
      maxVUs: 50,
    },
  },

  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<500"],
    "http_req_duration{scenario:login}": ["p(95)<800"],
    "http_req_duration{scenario:bad_login}": ["p(95)<800"],
    http_reqs: ["rate>=50"],                           // 55 rps target now
    checks: ["rate>0.99"],
    dropped_iterations: ["count<10"],
  },
};

export function setup() {
  const res = http.post(`${BASE_URL}/register`, USER, { redirects: 0 });
  check(res, { "test user ready": (r) => r.status === 302 || r.status === 400 });
}

export function browse() {
  const res = http.get(`${BASE_URL}/login`, { tags: { name: "GET /login" } });
  check(res, {
    "login page 200": (r) => r.status === 200,
    "login form shown": (r) => r.body.includes("Log in"),
  });
}

export function login() {
  const res = http.post(`${BASE_URL}/login`, USER, {
    redirects: 0,
    tags: { name: "POST /login" },
  });
  check(res, {
    "login succeeded": (r) => r.status === 302,
    "redirects to welcome": (r) => (r.headers["Location"] || "").endsWith("/welcome"),
  });
}

// Scenario 3: a wrong password. The app answers 401, which is the correct behaviour.
// By default k6 marks every 4xx/5xx as failed in http_req_failed; responseCallback
// tells k6 that 401 is the expected answer for this request.
// Only set the key when wanted: an explicit `responseCallback: undefined` (or null)
// disables failure tracking for the request altogether.
export function badLogin() {
  const params = { redirects: 0, tags: { name: "POST /login (bad password)" } };
  if (EXPECT_401) params.responseCallback = http.expectedStatuses(401);
  const res = http.post(`${BASE_URL}/login`, BAD_USER, params);
  check(res, {
    "bad login rejected with 401": (r) => r.status === 401,
    "error message shown": (r) => r.body.includes("Invalid username or password"),
  });
}
