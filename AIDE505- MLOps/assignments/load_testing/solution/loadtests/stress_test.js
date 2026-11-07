// Exercises 1-3: same traffic as load_test.js, but the login rate is configurable
// so we can push it until the thresholds break.
//
//   LOGIN_RATE=50  k6 run loadtests/stress_test.js
//   LOGIN_RATE=100 DURATION=1m k6 run loadtests/stress_test.js
import http from "k6/http";
import { check } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://127.0.0.1:8000";
const USER = { username: "loadtester", password: "loadtest123" };
const DURATION = __ENV.DURATION || "1m";
const BROWSE_RATE = Number(__ENV.BROWSE_RATE || 40);
const LOGIN_RATE = Number(__ENV.LOGIN_RATE || 50);

export const options = {
  cloud: { name: `Auth app - stress, login ${LOGIN_RATE}/s` },

  scenarios: {
    browse: {
      executor: "constant-arrival-rate",
      exec: "browse",
      rate: BROWSE_RATE,
      timeUnit: "1s",
      duration: DURATION,
      preAllocatedVUs: 20,
      maxVUs: 100,
    },
    login: {
      executor: "constant-arrival-rate",
      exec: "login",
      rate: LOGIN_RATE,
      timeUnit: "1s",
      duration: DURATION,
      preAllocatedVUs: 10,
      maxVUs: 200,
    },
  },

  // Same criteria as load_test.js; only the request-rate floor follows the target.
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<500"],
    "http_req_duration{scenario:login}": ["p(95)<800"],
    http_reqs: [`rate>=${0.9 * (BROWSE_RATE + LOGIN_RATE)}`],
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
