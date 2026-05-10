import { expect, test, type Page } from "@playwright/test";

type OtpPayload = { phoneNumber?: string; isSignup?: boolean };

async function goToLoginOtpStep(page: Page) {
  await page.route("**/api/auth/send-otp", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true }),
    });
  });
  await page.goto("/login");
  await page.getByLabel("Phone Number *").fill("03224916205");
  await page.getByRole("button", { name: "Send Verification Code" }).click();
  await expect(
    page.getByRole("heading", { name: "Enter verification code" }),
  ).toBeVisible();
}

async function fillSignupBasicInfo(
  page: Page,
  options?: { role?: "sender" | "courier" },
) {
  await page.getByLabel("Full Name *").fill("Test User");
  await page.getByLabel("Phone Number *").fill("03224916205");

  if (options?.role === "courier") {
    await page.getByRole("button", { name: "Courier" }).click();
  } else if (options?.role === "sender") {
    await page.getByRole("button", { name: "Sender" }).click();
  }

  await page.getByRole("button", { name: "Next" }).click();
}

async function fillSignupRequiredDetails(
  page: Page,
  email = "sender@example.com",
) {
  await page.getByLabel("Street Address *").fill("123 Main Street");
  await page.getByLabel("City *").fill("Tallinn");
  await page.getByLabel("State/Province *").fill("Harju");
  await page.getByLabel("Postcode *").fill("10111");
  await page.getByLabel("Country *").fill("Estonia");
  await page.getByLabel("Email Address *").fill(email);
}

test.describe("Auth pages", () => {
  test("redirects root path to login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  });

  test.describe("Login edge cases", () => {
    test("submits normalized phone number on login", async ({ page }) => {
      let requestBody: OtpPayload | null = null;

      await page.route("**/api/auth/send-otp", async (route) => {
        requestBody = route.request().postDataJSON();
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true }),
        });
      });

      await page.goto("/login");
      await page.getByLabel("Phone Number *").fill("03-2249abc16205");
      await page.getByRole("button", { name: "Send Verification Code" }).click();

      expect(requestBody).toEqual({
        phoneNumber: "+3723224916205",
        isSignup: false,
      });
      await expect(
        page.getByRole("heading", { name: "Enter verification code" }),
      ).toBeVisible();
    });

    test("shows API error and stays on phone step when send-otp fails", async ({
      page,
    }) => {
      await page.route("**/api/auth/send-otp", async (route) => {
        await route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({ message: "Invalid phone number format" }),
        });
      });

      await page.goto("/login");
      await page.getByLabel("Phone Number *").fill("12345");
      await page.getByRole("button", { name: "Send Verification Code" }).click();

      await expect(page.getByText("Invalid phone number format")).toBeVisible();
      await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    });

    test("shows signup link when error asks user to sign up", async ({ page }) => {
      await page.route("**/api/auth/send-otp", async (route) => {
        await route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({
            message: "Account not found, please sign up first",
          }),
        });
      });

      await page.goto("/login");
      await page.getByLabel("Phone Number *").fill("1234567");
      await page.getByRole("button", { name: "Send Verification Code" }).click();

      await expect(page.getByText(/please sign up first/i)).toBeVisible();
      await expect(
        page.getByRole("link", { name: "Create an account →" }),
      ).toBeVisible();
    });

    test("otp verify button stays disabled until six digits", async ({ page }) => {
      await goToLoginOtpStep(page);

      const verifyButton = page.getByRole("button", { name: "Verify" });
      await expect(verifyButton).toBeDisabled();

      await page.getByLabel("Verification Code").fill("12345");
      await expect(verifyButton).toBeDisabled();

      await page.getByLabel("Verification Code").fill("123456");
      await expect(verifyButton).toBeEnabled();
    });

    test("otp input only keeps digits and max length six", async ({ page }) => {
      await goToLoginOtpStep(page);

      const otpInput = page.getByLabel("Verification Code");
      await otpInput.fill("ab12cd34567");
      await expect(otpInput).toHaveValue("123456");
    });

    test("shows error when verify-otp fails", async ({ page }) => {
      await goToLoginOtpStep(page);

      await page.route("**/api/auth/verify-otp", async (route) => {
        await route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({ error: "Invalid OTP" }),
        });
      });

      await page.getByLabel("Verification Code").fill("123456");
      await page.getByRole("button", { name: "Verify" }).click();

      await expect(page.getByText("Invalid OTP")).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Enter verification code" }),
      ).toBeVisible();
    });

    test("resend code calls send-otp again with same normalized payload", async ({
      page,
    }) => {
      const requests: OtpPayload[] = [];

      await page.route("**/api/auth/send-otp", async (route) => {
        requests.push(route.request().postDataJSON());
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true }),
        });
      });

      await page.goto("/login");
      await page.getByLabel("Phone Number *").fill("03-2249abc16205");
      await page.getByRole("button", { name: "Send Verification Code" }).click();
      await page.getByRole("button", { name: "Resend Code" }).click();

      expect(requests).toHaveLength(2);
      expect(requests[0]).toEqual({
        phoneNumber: "+3723224916205",
        isSignup: false,
      });
      expect(requests[1]).toEqual({
        phoneNumber: "+3723224916205",
        isSignup: false,
      });
    });

    test("change number returns user to phone step", async ({ page }) => {
      await goToLoginOtpStep(page);

      await page.getByRole("button", { name: "Change Number" }).click();
      await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Send Verification Code" }),
      ).toBeVisible();
    });
  });

  test.describe("Signup edge cases", () => {
    test.beforeEach(async ({ page }) => {
      await page.route("**/api/geocoding/forward**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ features: [] }),
        });
      });
    });

    test("validates required full name on basic step", async ({ page }) => {
      await page.goto("/signup");
      await page.getByLabel("Full Name *").fill("   ");
      await page.getByLabel("Phone Number *").fill("1234567");
      await page.getByRole("button", { name: "Next" }).click();

      await expect(page.getByText("Full name is required")).toBeVisible();
      await expect(page.getByRole("heading", { name: "Sign up" })).toBeVisible();
    });

    test("validates minimum phone length on basic step", async ({ page }) => {
      await page.goto("/signup");
      await page.getByLabel("Full Name *").fill("Test User");
      await page.getByLabel("Phone Number *").fill("1234");
      await page.getByRole("button", { name: "Next" }).click();

      await expect(
        page.getByText("Please enter a valid phone number"),
      ).toBeVisible();
    });

    test("sender role proceeds to sender details step", async ({ page }) => {
      await page.goto("/signup");
      await fillSignupBasicInfo(page, { role: "sender" });

      await expect(
        page.getByRole("heading", { name: "Sender Details" }),
      ).toBeVisible();
    });

    test("courier role proceeds to courier details step", async ({ page }) => {
      await page.goto("/signup");
      await fillSignupBasicInfo(page, { role: "courier" });

      await expect(
        page.getByRole("heading", { name: "Courier Details" }),
      ).toBeVisible();
    });

    test("details step requires street address", async ({ page }) => {
      await page.goto("/signup");
      await fillSignupBasicInfo(page);
      await page.getByRole("button", { name: "Send Verification Code" }).click();

      await expect(page.getByText("Street address is required")).toBeVisible();
    });

    test("details step validates email format", async ({ page }) => {
      await page.goto("/signup");
      await fillSignupBasicInfo(page);
      await fillSignupRequiredDetails(page, "not-an-email");
      await page.getByRole("button", { name: "Send Verification Code" }).click();

      await expect(
        page.getByText("Please enter a valid email address"),
      ).toBeVisible();
    });

    test("details submit sends normalized phone for sender signup", async ({
      page,
    }) => {
      let requestBody: OtpPayload | null = null;

      await page.route("**/api/auth/send-otp", async (route) => {
        requestBody = route.request().postDataJSON();
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true }),
        });
      });

      await page.goto("/signup");
      await page.getByLabel("Full Name *").fill("Test User");
      await page.getByLabel("Phone Number *").fill("03-2249abc16205");
      await page.getByRole("button", { name: "Next" }).click();
      await fillSignupRequiredDetails(page);

      await page.getByRole("button", { name: "Send Verification Code" }).click();

      expect(requestBody).toEqual({
        phoneNumber: "+3723224916205",
        isSignup: true,
      });
      await expect(
        page.getByRole("heading", { name: "Verify your phone number" }),
      ).toBeVisible();
    });

    test("existing account response redirects signup user to login", async ({
      page,
    }) => {
      await page.route("**/api/auth/send-otp", async (route) => {
        await route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({ userExists: true }),
        });
      });

      await page.goto("/signup");
      await fillSignupBasicInfo(page);
      await fillSignupRequiredDetails(page);
      await page.getByRole("button", { name: "Send Verification Code" }).click();

      await expect(page).toHaveURL(/\/login$/, { timeout: 5_000 });
    });

    test("signup verify button stays disabled until six digits", async ({
      page,
    }) => {
      await page.route("**/api/auth/send-otp", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true }),
        });
      });

      await page.goto("/signup");
      await fillSignupBasicInfo(page);
      await fillSignupRequiredDetails(page);
      await page.getByRole("button", { name: "Send Verification Code" }).click();
      await expect(
        page.getByRole("heading", { name: "Verify your phone number" }),
      ).toBeVisible();

      const verifyButton = page.getByRole("button", { name: "Verify & Sign Up" });
      await expect(verifyButton).toBeDisabled();
      await page.getByLabel("Verification Code").fill("99999");
      await expect(verifyButton).toBeDisabled();
      await page.getByLabel("Verification Code").fill("999999");
      await expect(verifyButton).toBeEnabled();
    });

    test("signup resend code sends another request in otp step", async ({
      page,
    }) => {
      const requests: OtpPayload[] = [];

      await page.route("**/api/auth/send-otp", async (route) => {
        requests.push(route.request().postDataJSON());
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true }),
        });
      });

      await page.goto("/signup");
      await fillSignupBasicInfo(page);
      await fillSignupRequiredDetails(page);
      await page.getByRole("button", { name: "Send Verification Code" }).click();
      await page.getByRole("button", { name: "Resend Code" }).click();

      expect(requests).toHaveLength(2);
      expect(requests[0]).toEqual({
        phoneNumber: "+3723224916205",
        isSignup: true,
      });
      expect(requests[1]).toEqual({
        phoneNumber: "+3723224916205",
        isSignup: true,
      });
    });
  });
});
