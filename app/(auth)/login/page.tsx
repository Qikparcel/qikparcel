"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import toast from "react-hot-toast";
import { createSupabaseClient } from "@/lib/supabase/client";
import CountryCodeSelector from "@/components/CountryCodeSelector";
import { normalizePhoneNumber } from "@/lib/utils/phone";

export default function LoginPage() {
  const router = useRouter();
  const [countryCode, setCountryCode] = useState("+92"); // Default to Pakistan
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [otp, setOtp] = useState("");

  // Check if user is already authenticated
  useEffect(() => {
    const checkSession = async () => {
      if (typeof window === "undefined") return;

      // Check if user is already authenticated
      const supabase = createSupabaseClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        router.push("/dashboard");
        router.refresh();
      }
    };

    checkSession();
  }, [router]);

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Normalize phone number - remove leading 0 if present, then combine with country code
      let normalizedPhone = phoneNumber;
      
      // If phone number starts with 0 (like 03224916205), remove it
      if (normalizedPhone.startsWith("0")) {
        normalizedPhone = normalizedPhone.substring(1);
      }
      
      // Combine country code with phone number
      const formatted = phoneNumber.startsWith("+")
        ? phoneNumber
        : `${countryCode}${normalizedPhone}`;
      
      // Normalize the final phone number to ensure consistent format
      const finalFormatted = normalizePhoneNumber(formatted);

      const response = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phoneNumber: finalFormatted, isSignup: false }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Show user-friendly error message
        const errorMessage = data.message || data.error || "Failed to send OTP";
        setError(errorMessage);
        toast.error(errorMessage, {
          duration: 5000,
        });
        setLoading(false);
        return;
      }

      // Show success message
      toast.success("Verification code sent to your WhatsApp!");

      // Move to OTP verification step (userExists is just for info, we still send OTP for login)
      setStep("otp");
    } catch (err: any) {
      setError(err.message || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Normalize phone number - remove leading 0 if present, then combine with country code
      let normalizedPhone = phoneNumber;
      
      // If phone number starts with 0 (like 03224916205), remove it
      if (normalizedPhone.startsWith("0")) {
        normalizedPhone = normalizedPhone.substring(1);
      }
      
      // Combine country code with phone number
      const formatted = phoneNumber.startsWith("+")
        ? phoneNumber
        : `${countryCode}${normalizedPhone}`;
      
      // Normalize the final phone number to ensure consistent format
      const finalFormatted = normalizePhoneNumber(formatted);

      const response = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phoneNumber: finalFormatted,
          otp: otp,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Invalid OTP");
      }

      // The API returns a redirectUrl (recovery link) that will set auth cookies
      // Simply redirect to it - Supabase will handle setting the session and redirecting to dashboard
      if (data.redirectUrl) {
        toast.success("Verifying...");
        // Redirect to the recovery link - it will set cookies and redirect to dashboard
        window.location.href = data.redirectUrl;
      } else {
        throw new Error("No redirect URL received from server");
      }
    } catch (err: any) {
      setError(err.message || "Verification failed");
      toast.error(err.message || "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8">
        <div className="flex justify-center mb-2">
          <Image
            src="/logo.jpeg"
            alt="QikParcel Logo"
            width={200}
            height={200}
            priority
            className="object-contain"
          />
        </div>
        <h2
          className="text-4xl font-bold text-center mb-8"
          style={{ color: "#29772F" }}
        >
          {step === "phone" ? "Sign in" : "Enter verification code"}
        </h2>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {error}
          </div>
        )}

        {step === "phone" ? (
          <form onSubmit={handleSendOTP} className="space-y-4">
            <div>
              <label
                htmlFor="phone"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Phone Number *
              </label>
              <div className="flex">
                <CountryCodeSelector
                  value={countryCode}
                  onChange={setCountryCode}
                  className="flex-shrink-0"
                />
                <input
                  type="tel"
                  id="phone"
                  value={phoneNumber}
                  onChange={(e) => {
                    // Only allow digits
                    const value = e.target.value.replace(/\D/g, "");
                    setPhoneNumber(value);
                  }}
                  placeholder="1234567890"
                  required
                  className="flex-1 px-4 py-2 border border-gray-300 border-l-0 rounded-r-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-black"
                />
              </div>
              <p className="mt-1 text-xs text-gray-500 ">
                Include country code (e.g., +1234567890)
              </p>
              <p className="mt-1 text-xs text-gray-500 font-bold">
                Verification code will be sent to Whatsapp
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full text-white py-2 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition"
              style={{ backgroundColor: "#29772F" }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor = "#1f5f25")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = "#29772F")
              }
            >
              {loading ? "Sending..." : "Send Verification Code"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOTP} className="space-y-4">
            <div>
              <label
                htmlFor="otp"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Verification Code
              </label>
              <input
                type="text"
                id="otp"
                value={otp}
                onChange={(e) =>
                  setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                placeholder="000000"
                maxLength={6}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-center text-2xl tracking-widest text-black"
              />
              <p className="mt-2 text-sm text-gray-600">
                We sent a code to {countryCode}
                {phoneNumber} via WhatsApp
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep("phone")}
                className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-300 transition"
              >
                Change Number
              </button>
              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="flex-1 text-white py-2 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition"
                style={{ backgroundColor: "#29772F" }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor = "#1f5f25")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = "#29772F")
                }
              >
                {loading ? "Verifying..." : "Verify"}
              </button>
            </div>

            <button
              type="button"
              onClick={handleSendOTP}
              disabled={loading}
              className="w-full text-sm disabled:opacity-50"
              style={{ color: "#29772F" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#1f5f25")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#29772F")}
            >
              Resend Code
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-xs text-gray-500">
          By continuing, you agree to{' '}
          <Link
            href="/terms/general"
            className="text-primary-600 hover:text-primary-700 underline"
            style={{ color: '#29772F' }}
          >
            QikParcel&apos;s Terms of Service
          </Link>
        </p>

        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-center text-sm text-gray-600">
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
              className="font-medium"
              style={{ color: "#29772F" }}
            >
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
