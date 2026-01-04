import { NextRequest, NextResponse } from "next/server";
import {
  createSupabaseServerClient,
  createSupabaseAdminClient,
} from "@/lib/supabase/client";
import { createWhatsAppClient } from "@/lib/whatsapp/client";
import {
  normalizePhoneNumber,
  normalizePhoneForComparison,
} from "@/lib/utils/phone";

/**
 * POST /api/auth/send-otp
 * Send OTP via WhatsApp using Supabase Auth + Twilio
 */
export async function POST(request: NextRequest) {
  try {
    const { phoneNumber, isSignup } = await request.json();

    if (!phoneNumber) {
      return NextResponse.json(
        { error: "Phone number is required" },
        { status: 400 }
      );
    }

    // Normalize phone number (remove spaces, dashes, etc.)
    const formattedPhone = normalizePhoneNumber(phoneNumber);

    // Check if user already exists
    const adminSupabase = createSupabaseAdminClient();
    const { data: usersData } = await adminSupabase.auth.admin.listUsers();

    const phoneForComparison = normalizePhoneForComparison(formattedPhone);
    const existingUser = usersData?.users?.find((u: any) => {
      const userPhone = u.phone || u.user_metadata?.phone || "";
      return normalizePhoneForComparison(userPhone) === phoneForComparison;
    });

    const userExists = !!existingUser;

    // If it's a signup request and user already exists, don't send OTP
    if (isSignup && userExists) {
      return NextResponse.json(
        {
          success: false,
          error:
            "An account already exists with this phone number. Please sign in instead.",
          userExists: true,
        },
        { status: 400 }
      );
    }

    const supabase = createSupabaseServerClient();

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Send OTP via WhatsApp using approved template
    // Templates bypass 24-hour window restriction and are required for authentication
    try {
      const whatsappClient = createWhatsAppClient();
      const contentSid = process.env.TWILIO_CONTENT_SID;

      if (!contentSid) {
        console.error("TWILIO_CONTENT_SID not configured");
        return NextResponse.json(
          {
            error:
              "WhatsApp template not configured. Please set TWILIO_CONTENT_SID environment variable.",
          },
          { status: 500 }
        );
      }

      console.log("Sending OTP via WhatsApp template:", {
        to: formattedPhone,
        otpLength: otp.length,
        contentSid,
      });

      // Use Content API template - bypasses 24-hour window
      // Template variables format: { "1": value1, "2": value2, ... }
      // Most 2FA templates use a single variable for the OTP code
      const result = await whatsappClient.sendContentTemplate(
        formattedPhone,
        contentSid,
        { "1": otp } // Pass OTP as first template variable
      );

      console.log("OTP sent successfully via template:", {
        messageSid: result.sid,
        status: result.status,
        note: "Template message sent - can bypass 24-hour window once approved by Meta",
      });
    } catch (whatsappError: any) {
      console.error("WhatsApp send error details:", {
        message: whatsappError.message,
        error: whatsappError,
        phoneNumber: formattedPhone,
      });

      // Return user-friendly error message
      const userMessage = whatsappError.userMessage || whatsappError.message || "Failed to send OTP via WhatsApp"
      
      // Check for specific error codes
      if (whatsappError.code === '21211') {
        // Invalid phone number
        return NextResponse.json(
          {
            error: "Invalid phone number",
            message: "The phone number you entered is not valid. Please check the number format and try again. Make sure to include the country code (e.g., +92 for Pakistan).",
            code: whatsappError.code,
          },
          { status: 400 }
        );
      } else if (whatsappError.code === '21608' || whatsappError.code === '21610') {
        // Unsubscribed recipient
        return NextResponse.json(
          {
            error: "Phone number not registered",
            message: "This phone number is not registered to receive WhatsApp messages. For testing, please join the WhatsApp Sandbox by sending the join code to the Twilio WhatsApp number.",
            code: whatsappError.code,
          },
          { status: 400 }
        );
      } else if (whatsappError.code === '21614') {
        // Invalid WhatsApp number
        return NextResponse.json(
          {
            error: "Not a WhatsApp number",
            message: "This phone number does not have WhatsApp installed or is not a valid WhatsApp number. Please use a different number.",
            code: whatsappError.code,
          },
          { status: 400 }
        );
      }

      // Generic error
      return NextResponse.json(
        {
          error: userMessage,
          message: userMessage,
          details: whatsappError.message || "Unknown error",
        },
        { status: 500 }
      );
    }

    // Store OTP in Supabase using a custom approach
    // Since Supabase doesn't allow custom OTP, we'll use a workaround:
    // Store OTP in a temporary table or use Supabase's phone auth with custom provider

    // Option 1: Use Supabase's built-in phone auth (requires SMS provider setup)
    // Option 2: Store OTP ourselves and verify manually

    // For now, we'll store OTP in a simple way and verify manually
    // In production, use Supabase's phone auth with custom SMS provider

    // Store OTP with expiration (10 minutes)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // Clean up old OTPs first (optional - function might not exist yet)
    try {
      await adminSupabase.rpc("cleanup_expired_otps");
    } catch (error) {
      // Function might not exist yet, that's okay - continue
      console.log("Cleanup function not available (this is okay)");
    }

    // Store new OTP
    const { error: storeError } = await (adminSupabase
      .from("otp_codes") as any)
      .insert({
        phone_number: formattedPhone,
        otp_code: otp,
        expires_at: expiresAt,
        used: false,
      });

    if (storeError) {
      console.error("Error storing OTP:", storeError);
      // Continue anyway - OTP was sent via WhatsApp
    }

    // Return success with OTP (for development/testing)
    // In production, don't return OTP - user should receive it via WhatsApp
    return NextResponse.json({
      success: true,
      message: "OTP sent via WhatsApp",
      userExists: userExists,
      // Only return OTP in development for testing
      ...(process.env.NODE_ENV === "development" && {
        otp,
        note: userExists
          ? "User already exists - this is a login attempt"
          : "OTP shown only in development mode",
      }),
    });
  } catch (error: any) {
    console.error("Send OTP error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to send OTP" },
      { status: 500 }
    );
  }
}
