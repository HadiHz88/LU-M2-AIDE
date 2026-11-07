// Exercise 4: login traffic ramps 0 -> 50 -> 0 req/s over 3 minutes, so we can
// see where (if anywhere) the response time curve bends.
//
//   k6 run loadtests/ramp_test.js
//   PEAK=400 k6 run loadtests/ramp_test.js     // push the peak past capacity
import http from "k6/http";
import { check } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://127.0.0.1:8000";
const USER = { username: "loadtester", password: "loadtest123" };
const PEAK = Number(__ENV.PEAK || 50);

export const options = {
  cloud: { name: `Auth app - ramp to ${PEAK} RPS` },

  scenarios: {
    login: {
      executor: "ramping-arrival-rate",
      exec: "login",
      startRate: 0,
      timeUnit: "1s",
      preAllocatedVUs: 10,
      maxVUs: 200,
      stages: [
        { target: PEAK, duration: "1m30s" },   // ramp up
        { target: PEAK, duration: "30s" },     // hold the peak
        { target: 0, duration: "1m" },         // ramp down
      ],
    },
  },

  thresholds: {
    http_req_failed: ["rate<0.01"],
    "http_req_duration{scenario:login}": ["p(95)<800"],
    checks: ["rate>0.99"],
  },
};

export function setup() {
  const res = http.post(`${BASE_URL}/register`, USER, { redirects: 0 });
  check(res, { "test user ready": (r) => r.status === 302 || r.status === 400 });
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
