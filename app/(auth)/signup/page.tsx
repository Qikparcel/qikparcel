"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import toast from "react-hot-toast";
import { createSupabaseClient } from "@/lib/supabase/client";
import CountryCodeSelector from "@/components/CountryCodeSelector";
import { normalizePhoneNumber } from "@/lib/utils/phone";

type SignupStep = "basic" | "details" | "otp";

export default function SignUpPage() {
  const router = useRouter();

  // Basic info
  const [fullName, setFullName] = useState("");
  const [countryCode, setCountryCode] = useState("+92"); // Default to Pakistan
  const [phoneNumber, setPhoneNumber] = useState("");
  const [role, setRole] = useState<"sender" | "courier">("sender");

  // Role-specific details - Structured Address Fields
  const [streetAddress, setStreetAddress] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postcode, setPostcode] = useState("");
  const [country, setCountry] = useState("");
  const [email, setEmail] = useState(""); // For sender only
  const [documentFile, setDocumentFile] = useState<File | null>(null); // For courier only
  const [documentType, setDocumentType] = useState("national_id");

  // OTP step
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<SignupStep>("basic");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Load saved form data from localStorage on mount
  useEffect(() => {
    const savedData = localStorage.getItem("signup_form_data");
    if (savedData) {
      try {
        const data = JSON.parse(savedData);
        setFullName(data.fullName || "");
        setPhoneNumber(data.phoneNumber || "");
        setRole(data.role || "sender");
        setStreetAddress(data.streetAddress || "");
        setAddressLine2(data.addressLine2 || "");
        setCity(data.city || "");
        setState(data.state || "");
        setPostcode(data.postcode || "");
        setCountry(data.country || "");
        setEmail(data.email || "");
        setDocumentType(data.documentType || "national_id");
        // Note: documentFile cannot be restored from localStorage, but we'll upload it before redirect
      } catch (err) {
        console.error("Error loading saved form data:", err);
      }
    }
  }, []);

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

  const updateProfileFromSavedData = async (userId: string, data: any) => {
    try {
      // Update profile with saved data (document should already be uploaded)
      const updateResponse = await fetch("/api/auth/update-profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          fullName: data.fullName,
          role: data.role,
          streetAddress: data.streetAddress,
          addressLine2: data.addressLine2,
          city: data.city,
          state: data.state,
          postcode: data.postcode,
          country: data.country,
          email: data.role === "sender" ? data.email : undefined,
          documentPath: data.documentPath, // Should be set if document was uploaded before redirect
          documentType: data.documentType,
        }),
      });

      if (!updateResponse.ok) {
        const errorData = await updateResponse.json();
        throw new Error(errorData.error || "Failed to update profile");
      }
    } catch (err: any) {
      console.error("Error updating profile from saved data:", err);
      throw err;
    }
  };

  const updateProfileWithDetails = async (userId: string) => {
    try {
      let documentPath: string | null = null;

      // Upload document if courier and file provided
      if (role === "courier" && documentFile) {
        const formData = new FormData();
        formData.append("file", documentFile);
        formData.append("userId", userId);

        const uploadResponse = await fetch("/api/auth/upload-document", {
          method: "POST",
          body: formData,
        });

        const uploadData = await uploadResponse.json();
        if (uploadResponse.ok && uploadData.filePath) {
          documentPath = uploadData.filePath;
        } else {
          console.error("Document upload failed:", uploadData.error);
          toast.error("Profile saved but document upload failed");
        }
      }

      // Update profile with all collected data
      const updateResponse = await fetch("/api/auth/update-profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          fullName,
          role,
          streetAddress,
          addressLine2,
          city,
          state,
          postcode,
          country,
          email: role === "sender" ? email : undefined,
          documentPath,
          documentType,
        }),
      });

      if (!updateResponse.ok) {
        const errorData = await updateResponse.json();
        throw new Error(errorData.error || "Failed to update profile");
      }
    } catch (err: any) {
      console.error("Error updating profile:", err);
      throw err;
    }
  };

  const handleBasicInfoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validate full name - must be provided and not just whitespace
    if (!fullName || !fullName.trim()) {
      setError("Full name is required");
      return;
    }

    // Validate phone number - must be provided and have at least some digits
    if (!phoneNumber || !phoneNumber.trim() || phoneNumber.trim().length < 5) {
      setError("Please enter a valid phone number");
      return;
    }

    // Validate role is selected
    if (!role) {
      setError("Please select your role");
      return;
    }

    setStep("details");
  };

  const handleDetailsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Validate full name again (in case user navigated back)
      if (!fullName || !fullName.trim()) {
        setError("Full name is required");
        setLoading(false);
        return;
      }

      // Validate phone number again
      if (
        !phoneNumber ||
        !phoneNumber.trim() ||
        phoneNumber.trim().length < 5
      ) {
        setError("Please enter a valid phone number");
        setLoading(false);
        return;
      }

      // Validate address fields - all required
      if (!streetAddress || !streetAddress.trim()) {
        setError("Street address is required");
        setLoading(false);
        return;
      }
      if (!city || !city.trim()) {
        setError("City is required");
        setLoading(false);
        return;
      }
      if (!state || !state.trim()) {
        setError("State/Province is required");
        setLoading(false);
        return;
      }
      if (!postcode || !postcode.trim()) {
        setError("Postcode is required");
        setLoading(false);
        return;
      }
      if (!country || !country.trim()) {
        setError("Country is required");
        setLoading(false);
        return;
      }

      // Validate role-specific fields
      if (role === "sender") {
        if (!email || !email.trim()) {
          setError("Email address is required for senders");
          setLoading(false);
          return;
        }
        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
          setError("Please enter a valid email address");
          setLoading(false);
          return;
        }
      }

      if (role === "courier") {
        if (!documentFile) {
          setError("Please upload an ID document");
          setLoading(false);
          return;
        }
        if (!documentType) {
          setError("Please select a document type");
          setLoading(false);
          return;
        }
      }

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

      // Send OTP
      const response = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phoneNumber: finalFormatted, isSignup: true }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.userExists) {
          setError("");
          toast.error(
            "An account already exists with this phone number. Please sign in instead.",
            {
              duration: 5000,
            }
          );
          setTimeout(() => {
            router.push("/login");
          }, 2000);
          return;
        }
        // Show user-friendly error message
        const errorMessage = data.message || data.error || "Failed to send OTP";
        setError(errorMessage);
        toast.error(errorMessage, {
          duration: 5000,
        });
        setLoading(false);
        return;
      }

      toast.success("Verification code sent to your WhatsApp!");
      setStep("otp");
    } catch (err: any) {
      setError(err.message || "Failed to send OTP");
      toast.error(err.message || "Failed to send OTP");
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

      // Upload document if courier (using admin client, so no auth needed)
      let documentPath: string | null = null;
      if (role === "courier" && documentFile && data.user?.id) {
        try {
          const uploadFormData = new FormData();
          uploadFormData.append("file", documentFile);
          uploadFormData.append("userId", data.user.id);

          const uploadResponse = await fetch("/api/auth/upload-document", {
            method: "POST",
            body: uploadFormData,
          });

          const uploadData = await uploadResponse.json();
          if (uploadResponse.ok && uploadData.filePath) {
            documentPath = uploadData.filePath;
            console.log("Document uploaded successfully:", documentPath);
          } else {
            console.error("Document upload failed:", uploadData.error);
            toast.error("Document upload failed, but you can upload it later");
          }
        } catch (uploadErr: any) {
          console.error("Document upload error:", uploadErr);
          toast.error("Document upload failed, but you can upload it later");
        }
      }

      // Save form data to localStorage before redirect
      const formDataToSave = {
        fullName,
        phoneNumber: finalFormatted,
        role,
        streetAddress,
        addressLine2,
        city,
        state,
        postcode,
        country,
        email,
        documentType,
        documentPath, // Include uploaded document path if available
      };
      localStorage.setItem("signup_form_data", JSON.stringify(formDataToSave));

      // Redirect to magic link - profile will be updated when redirect completes
      if (data.redirectUrl) {
        toast.success("Verifying...");
        window.location.href = data.redirectUrl;
      } else {
        throw new Error("No redirect URL received from server");
      }
    } catch (err: any) {
      setError(err.message || "Verification failed");
      toast.error(err.message || "Verification failed");
      setLoading(false);
    }
  };

  const handleDocumentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/jpg",
        "application/pdf",
      ];
      if (!allowedTypes.includes(file.type)) {
        toast.error("Please upload a JPEG, PNG, or PDF file");
        return;
      }
      // Validate file size (5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error("File size must be less than 5MB");
        return;
      }
      setDocumentFile(file);
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
          {step === "basic" && "Sign up"}
          {step === "details" &&
            (role === "sender" ? "Sender Details" : "Courier Details")}
          {step === "otp" && "Verify your phone number"}
        </h2>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {error}
          </div>
        )}

        {step === "basic" && (
          <form onSubmit={handleBasicInfoSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="fullName"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Full Name *
              </label>
              <input
                type="text"
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="John Doe"
                required
                minLength={2}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-black"
              />
            </div>

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
                  minLength={5}
                  className="flex-1 px-4 py-2 border border-gray-300 border-l-0 rounded-r-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-black"
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                We&apos;ll send verification code via WhatsApp
              </p>
            </div>

            <div>
              <label
                htmlFor="role"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                I am a *
              </label>
              <select
                id="role"
                value={role}
                onChange={(e) =>
                  setRole(e.target.value as "sender" | "courier")
                }
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-black"
              >
                <option value="sender">Sender (I want to send parcels)</option>
                <option value="courier">
                  Courier (I want to deliver parcels)
                </option>
              </select>
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
              {loading ? "Processing..." : "Next"}
            </button>
          </form>
        )}

        {step === "details" && (
          <form onSubmit={handleDetailsSubmit} className="space-y-4">
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="streetAddress"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Street Address *
                </label>
                <input
                  type="text"
                  id="streetAddress"
                  value={streetAddress}
                  onChange={(e) => setStreetAddress(e.target.value)}
                  placeholder="123 Main Street"
                  required
                  minLength={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-black"
                />
              </div>

              <div>
                <label
                  htmlFor="addressLine2"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Address Line 2 (Optional)
                </label>
                <input
                  type="text"
                  id="addressLine2"
                  value={addressLine2}
                  onChange={(e) => setAddressLine2(e.target.value)}
                  placeholder="Apartment, suite, unit, etc."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-black"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="city"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    City *
                  </label>
                  <input
                    type="text"
                    id="city"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="City"
                    required
                    minLength={2}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-black"
                  />
                </div>

                <div>
                  <label
                    htmlFor="state"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    State/Province *
                  </label>
                  <input
                    type="text"
                    id="state"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="State"
                    required
                    minLength={2}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-black"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="postcode"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Postcode/ZIP *
                  </label>
                  <input
                    type="text"
                    id="postcode"
                    value={postcode}
                    onChange={(e) => setPostcode(e.target.value)}
                    placeholder="12345"
                    required
                    minLength={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-black"
                  />
                </div>

                <div>
                  <label
                    htmlFor="country"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Country *
                  </label>
                  <input
                    type="text"
                    id="country"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    placeholder="Country"
                    required
                    minLength={2}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-black"
                  />
                </div>
              </div>
            </div>

            {role === "sender" && (
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Email Address *
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your.email@example.com"
                  required
                  minLength={5}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-black"
                />
              </div>
            )}

            {role === "courier" && (
              <>
                <div>
                  <label
                    htmlFor="documentType"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    ID Document Type *
                  </label>
                  <select
                    id="documentType"
                    value={documentType}
                    onChange={(e) => setDocumentType(e.target.value)}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-black"
                  >
                    <option value="national_id">National ID</option>
                    <option value="passport">Passport</option>
                    <option value="drivers_license">
                      Driver&apos;s License
                    </option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="document"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Upload ID Document * (JPEG, PNG, or PDF, max 5MB)
                  </label>
                  <input
                    type="file"
                    id="document"
                    accept="image/jpeg,image/png,image/jpg,application/pdf"
                    onChange={handleDocumentChange}
                    required={!documentFile}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-black"
                  />
                  {documentFile && (
                    <p className="mt-1 text-xs text-green-600">
                      Selected: {documentFile.name} (
                      {(documentFile.size / 1024 / 1024).toFixed(2)} MB)
                    </p>
                  )}
                </div>
              </>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep("basic")}
                className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-300 transition"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 text-white py-2 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition"
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
            </div>
          </form>
        )}

        {step === "otp" && (
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
                onClick={() => setStep("details")}
                className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-300 transition"
              >
                Back
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
                {loading ? "Verifying..." : "Verify & Sign Up"}
              </button>
            </div>

            <button
              type="button"
              onClick={async () => {
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
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      phoneNumber: finalFormatted,
                      isSignup: true,
                    }),
                  });
                  if (response.ok) {
                    toast.success("Verification code resent!");
                  } else {
                    const data = await response.json();
                    toast.error(data.error || "Failed to resend code");
                  }
                } catch (err) {
                  toast.error("Failed to resend code");
                } finally {
                  setLoading(false);
                }
              }}
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

        <p className="mt-6 text-center text-sm text-gray-600">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium"
            style={{ color: "#29772F" }}
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
