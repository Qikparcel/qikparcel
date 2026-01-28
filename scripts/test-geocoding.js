// Simple script to test your local geocoding API and see
// exactly what Google is returning (including for Zimbabwe).
//
// Usage:
//   node scripts/test-geocoding.js "Harare" ZW
//   node scripts/test-geocoding.js "Karachi" PK
//
// Make sure your Next.js dev server is running on http://localhost:3000
// and that GOOGLE_MAPS_API_KEY is set in your .env.local.

const http = require("http");

const query = process.argv[2] || "Harare";
const country = process.argv[3] || "ZW";
const limit = process.argv[4] || "5";

const params = new URLSearchParams({
  q: query,
  limit,
  country,
});

const options = {
  hostname: "localhost",
  port: 3000,
  path: `/api/geocoding/forward?${params.toString()}`,
  method: "GET",
};

console.log("Requesting:", `http://localhost:3000${options.path}`);

const req = http.request(options, (res) => {
  let data = "";

  console.log("Status code:", res.statusCode);

  res.on("data", (chunk) => {
    data += chunk;
  });

  res.on("end", () => {
    try {
      const json = JSON.parse(data);
      console.log("Response JSON:");
      console.dir(json, { depth: null });
    } catch (e) {
      console.error("Failed to parse JSON:", e);
      console.log("Raw response:", data);
    }
  });
});

req.on("error", (error) => {
  console.error("Request error:", error);
});

req.end();

