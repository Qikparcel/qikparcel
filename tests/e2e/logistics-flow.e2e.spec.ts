import { expect, test, type Page } from "@playwright/test";

function createImageFixture(filename: string) {
  return {
    name: filename,
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/w8AAgMBgJ2x7QAAAABJRU5ErkJggg==",
      "base64",
    ),
  };
}

async function setMockAuth(page: Page, role: "sender" | "courier" | "admin") {
  await page.addInitScript((mockRole) => {
    window.localStorage.setItem("e2e_auth_enabled", "1");
    window.localStorage.setItem("e2e_auth_role", mockRole);
    window.localStorage.setItem("e2e_auth_user_id", `e2e-${mockRole}-user`);
    window.localStorage.setItem("e2e_auth_name", `E2E ${mockRole} User`);
    window.localStorage.setItem("e2e_auth_phone", "+10000000000");
  }, role);
}

async function mockDashboardCommon(page: Page) {
  await page.route("**/api/chat/unread-count", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ count: 0 }),
    });
  });

  await page.route("**/api/connect/status", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        hasAccount: true,
        onboarded: true,
        canReceivePayouts: true,
      }),
    });
  });
}

async function mockGeocoding(page: Page) {
  await page.route("**/api/geocoding/forward**", async (route) => {
    const url = new URL(route.request().url());
    const query = (url.searchParams.get("q") || "").toLowerCase();

    const pickCoordinates = () => {
      if (query.includes("pickup")) return [24.7536, 59.437] as [number, number];
      if (query.includes("delivery"))
        return [23.7275, 37.9838] as [number, number];
      if (query.includes("origin")) return [2.3522, 48.8566] as [number, number];
      if (query.includes("destination"))
        return [13.405, 52.52] as [number, number];
      return [24.7536, 59.437] as [number, number];
    };

    const [lng, lat] = pickCoordinates();
    const suffix = query.includes("delivery") || query.includes("destination")
      ? "B"
      : "A";

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        features: [
          {
            id: `feature-${suffix}`,
            geometry: { type: "Point", coordinates: [lng, lat] },
            properties: {
              name: `Address ${suffix}`,
              full_address: `Address ${suffix}, City ${suffix}, State ${suffix}, 1000${suffix}, Country ${suffix}`,
              feature_type: "address",
              coordinates: { longitude: lng, latitude: lat },
              context: {
                place: { name: `City ${suffix}` },
                region: { name: `State ${suffix}` },
                postcode: { name: `1000${suffix}` },
                country: { name: `Country ${suffix}` },
              },
            },
          },
        ],
      }),
    });
  });

  await page.route("**/api/pricing/estimate**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        total_amount: 45,
        delivery_fee: 40,
        platform_fee: 5,
        currency: "USD",
        distance_km: 120,
        estimated_delivery_min_hours: 10,
        estimated_delivery_max_hours: 12,
        is_domestic: false,
      }),
    });
  });

  await page.route("**/api/geocoding/duration**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        durationSeconds: 7200,
        durationText: "2 hours",
      }),
    });
  });
}

function toDatetimeLocal(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  const hours = String(value.getHours()).padStart(2, "0");
  const minutes = String(value.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

test.describe("Parcel, trip and matching coverage", () => {
  test("parcel creation validates same pickup and delivery address", async ({
    page,
  }) => {
    await setMockAuth(page, "sender");
    await mockDashboardCommon(page);
    await mockGeocoding(page);

    await page.goto("/dashboard/parcels/new");

    await expect(
      page.getByRole("heading", { name: "Create New Parcel" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Create Parcel" })).toBeDisabled();

    await page.getByLabel("Pickup Address *").fill("same location");
    await page.getByLabel("Pickup Address *").blur();
    await page.getByLabel("Delivery Address *").fill("same location");
    await page.getByLabel("Delivery Address *").blur();

    await page.getByLabel(/Description/).fill("Electronics");
    await page.getByLabel(/Weight \(kg\)/).fill("2");
    await page.getByLabel(/Dimensions/).fill("30x20x15 cm");
    await page.getByLabel(/Estimated Value/).fill("120");
    await page
      .getByLabel(/Parcel Picture/)
      .setInputFiles(createImageFixture("parcel.png"));
    await page.locator("#acceptTerms").check();

    await page.getByRole("button", { name: "Create Parcel" }).click();
    await expect(
      page.getByText("Pickup and delivery addresses cannot be the same"),
    ).toBeVisible();
  });

  test("parcel creation submits and redirects on success", async ({ page }) => {
    await setMockAuth(page, "sender");
    await mockDashboardCommon(page);
    await mockGeocoding(page);

    let parcelCreateCalls = 0;
    await page.route("**/api/parcels", async (route) => {
      if (route.request().method() === "POST") {
        parcelCreateCalls += 1;
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            parcel: { id: "parcel-e2e-1" },
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, parcels: [] }),
      });
    });

    await page.goto("/dashboard/parcels/new");

    await page.getByLabel("Pickup Address *").fill("pickup alpha");
    await page.getByLabel("Pickup Address *").blur();
    await page.getByLabel("Delivery Address *").fill("delivery beta");
    await page.getByLabel("Delivery Address *").blur();

    await page.getByLabel(/Description/).fill("Documents");
    await page.getByLabel(/Weight \(kg\)/).fill("1.5");
    await page.getByLabel(/Dimensions/).fill("25x20x2 cm");
    await page.getByLabel(/Estimated Value/).fill("80");
    await page
      .getByLabel(/Parcel Picture/)
      .setInputFiles(createImageFixture("doc.png"));
    await page.locator("#acceptTerms").check();

    await page.getByRole("button", { name: "Create Parcel" }).click();

    await expect(page).toHaveURL(/\/dashboard\/parcels\/parcel-e2e-1$/);
    expect(parcelCreateCalls).toBe(1);
  });

  test("trip page blocks courier when KYC is not approved", async ({ page }) => {
    await setMockAuth(page, "courier");
    await mockDashboardCommon(page);

    await page.route("**/api/kyc/status", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          kyc: { verification_status: "pending" },
        }),
      });
    });

    await page.goto("/dashboard/trips/new");
    await expect(page.getByText("ID verification required")).toBeVisible();
    await expect(page.getByRole("link", { name: "Go to Settings" })).toBeVisible();
  });

  test("trip creation validates arrival must be after departure", async ({
    page,
  }) => {
    await setMockAuth(page, "courier");
    await mockDashboardCommon(page);
    await mockGeocoding(page);

    await page.route("**/api/kyc/status", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          kyc: { verification_status: "approved" },
        }),
      });
    });

    await page.goto("/dashboard/trips/new");

    await page.getByLabel("Origin Address *").fill("origin city");
    await page.getByLabel("Origin Address *").blur();
    await page.getByLabel("Destination Address *").fill("destination city");
    await page.getByLabel("Destination Address *").blur();

    const departure = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const arrival = new Date(departure.getTime() - 10 * 60 * 1000);
    await page.getByLabel(/Departure Time/).fill(toDatetimeLocal(departure));
    await page.getByLabel(/Estimated Arrival/).fill(toDatetimeLocal(arrival));

    await page.getByRole("button", { name: "Create Trip" }).click();
    await expect(
      page.getByText("Estimated arrival must be after departure time"),
    ).toBeVisible();
  });

  test("trip creation submits and redirects on success", async ({ page }) => {
    await setMockAuth(page, "courier");
    await mockDashboardCommon(page);
    await mockGeocoding(page);

    await page.route("**/api/kyc/status", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          kyc: { verification_status: "approved" },
        }),
      });
    });

    let tripCreateCalls = 0;
    await page.route("**/api/trips", async (route) => {
      if (route.request().method() === "POST") {
        tripCreateCalls += 1;
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            trip: { id: "trip-e2e-1" },
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, trips: [] }),
      });
    });

    await page.goto("/dashboard/trips/new");

    await page.getByLabel("Origin Address *").fill("origin start");
    await page.getByLabel("Origin Address *").blur();
    await page.getByLabel("Destination Address *").fill("destination end");
    await page.getByLabel("Destination Address *").blur();

    const departure = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const arrival = new Date(departure.getTime() + 2 * 60 * 60 * 1000);
    await page.getByLabel(/Departure Time/).fill(toDatetimeLocal(departure));
    await page.getByLabel(/Estimated Arrival/).fill(toDatetimeLocal(arrival));
    await page.getByLabel("Available Capacity").selectOption("medium");
    await page.getByLabel("Mode of travel").selectOption("train");
    await page.getByLabel("Train number").fill("TGV 123");

    await page.getByRole("button", { name: "Create Trip" }).click();

    await expect(page).toHaveURL(/\/dashboard\/trips\/trip-e2e-1$/);
    expect(tripCreateCalls).toBe(1);
  });

  test("matched parcels keeps progression disabled until paid", async ({ page }) => {
    await setMockAuth(page, "courier");
    await mockDashboardCommon(page);

    await page.route("**/api/courier/matched-parcels", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          parcels: [
            {
              id: "parcel-1",
              status: "matched",
              pickup_address: "Pickup A",
              delivery_address: "Delivery B",
              description: "Box",
              weight_kg: 2,
              dimensions: "20x20x20",
              sender_id: "sender-1",
              matched_trip_id: "trip-1",
              created_at: new Date().toISOString(),
              sender: {
                id: "sender-1",
                full_name: "Sender User",
                phone_number: "+10000000000",
                whatsapp_number: "+10000000000",
              },
              matched_trip: {
                id: "trip-1",
                origin_address: "Origin",
                destination_address: "Destination",
                departure_time: new Date().toISOString(),
                estimated_arrival: new Date().toISOString(),
                status: "scheduled",
              },
              payment_status: "pending",
            },
          ],
        }),
      });
    });

    await page.goto("/dashboard/matched-parcels");

    await expect(
      page.getByRole("heading", { name: "Matched Parcels" }),
    ).toBeVisible();
    await expect(
      page.getByText("We are waiting for payment from sender side"),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Mark as Picked Up" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Cancel Parcel" })).toBeEnabled();
  });

  test("matched parcel status update requires proof and submits after upload", async ({
    page,
  }) => {
    await setMockAuth(page, "courier");
    await mockDashboardCommon(page);

    let statusCalls = 0;

    await page.route("**/api/courier/matched-parcels", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          parcels: [
            {
              id: "parcel-2",
              status: "matched",
              pickup_address: "Pickup X",
              delivery_address: "Delivery Y",
              description: "Package",
              weight_kg: 1,
              dimensions: "10x10x10",
              sender_id: "sender-2",
              matched_trip_id: "trip-2",
              created_at: new Date().toISOString(),
              sender: {
                id: "sender-2",
                full_name: "Sender Two",
                phone_number: "+10000000001",
                whatsapp_number: "+10000000001",
              },
              matched_trip: {
                id: "trip-2",
                origin_address: "Origin",
                destination_address: "Destination",
                departure_time: new Date().toISOString(),
                estimated_arrival: new Date().toISOString(),
                status: "scheduled",
              },
              payment_status: "paid",
            },
          ],
        }),
      });
    });

    await page.route("**/api/parcels/parcel-2/status", async (route) => {
      statusCalls += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    });

    await page.goto("/dashboard/matched-parcels");

    await page.getByRole("button", { name: "Mark as Picked Up" }).click();
    await expect(
      page.getByText("Please upload a proof photo before marking as picked up"),
    ).toBeVisible();

    await page
      .locator('input[type="file"]')
      .setInputFiles(createImageFixture("proof.png"));
    await page.getByRole("button", { name: "Mark as Picked Up" }).click();

    await expect.poll(() => statusCalls).toBe(1);
  });
});
