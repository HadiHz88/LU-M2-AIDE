// k6 load test: holds a steady 50 requests per second against the auth app.
//
//   Run locally only:            k6 run loadtests/load_test.js
//   Run locally, view in cloud:  k6 cloud run --local-execution loadtests/load_test.js
//
// Override the target with:     BASE_URL=http://127.0.0.1:9000 k6 run ...
import http from "k6/http";
import { check } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://127.0.0.1:8000";
const USER = { username: "loadtester", password: "loadtest123" };
const DURATION = "2m";

export const options = {
  cloud: { name: "Auth app - 50 RPS" },   // name shown in Grafana Cloud

  // Two scenarios run in parallel: 40 + 10 = 50 requests per second.
  // "constant-arrival-rate" starts N iterations per second no matter how
  // slow the server is, so the request rate stays fixed.
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
  },

  // Pass/fail criteria. If any is broken, k6 exits with an error.
  thresholds: {
    http_req_failed: ["rate<0.01"],                    // < 1% errors
    http_req_duration: ["p(95)<500"],                  // 95% under 500 ms
    "http_req_duration{scenario:login}": ["p(95)<800"],
    http_reqs: ["rate>=45"],                           // we really reached ~50 rps
    checks: ["rate>0.99"],
    dropped_iterations: ["count<10"],                  // k6 kept up with the target rate
  },
};

// Runs once before the load starts: make sure the test user exists.
// 302 = created, 400 = already exists from a previous run. Both are fine.
export function setup() {
  const res = http.post(`${BASE_URL}/register`, USER, { redirects: 0 });
  check(res, { "test user ready": (r) => r.status === 302 || r.status === 400 });
}

// Scenario 1: a visitor opens the login page (cheap request).
export function browse() {
  const res = http.get(`${BASE_URL}/login`, { tags: { name: "GET /login" } });
  check(res, {
    "login page 200": (r) => r.status === 200,
    "login form shown": (r) => r.body.includes("Log in"),
  });
}

// Scenario 2: a user submits the login form (expensive: password hashing).
// redirects: 0 keeps it to exactly one request; success is a 302 to /welcome.
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
