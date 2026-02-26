import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/client";

/**
 * POST /api/auth/update-profile
 * Update user profile with additional information (address, email, documents)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      fullName,
      role,
      streetAddress,
      addressLine2,
      city,
      state,
      postcode,
      country,
      email,
      documentPath,
      documentType,
      userId,
      phoneNumber,
    } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Validate required fields for both sender and courier
    if (fullName !== undefined && !fullName?.trim()) {
      return NextResponse.json(
        { error: "Full name is required" },
        { status: 400 }
      );
    }

    const adminSupabase = createSupabaseAdminClient();

    // Prepare update data
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    // Always update these fields if provided (even if empty string for optional fields)
    // These fields apply to both sender and courier
    if (fullName !== undefined && fullName !== null)
      updateData.full_name = fullName.trim();
    if (role !== undefined && role !== null) updateData.role = role;
    if (streetAddress !== undefined && streetAddress !== null)
      updateData.street_address = streetAddress.trim();
    if (addressLine2 !== undefined)
      updateData.address_line_2 = addressLine2?.trim() || null;
    if (city !== undefined && city !== null) updateData.city = city.trim();
    if (state !== undefined && state !== null) updateData.state = state.trim();
    if (postcode !== undefined && postcode !== null)
      updateData.postcode = postcode.trim();
    if (country !== undefined && country !== null)
      updateData.country = country.trim();
    if (email !== undefined && email !== null) {
      updateData.email = email.trim();
    }
    if (
      phoneNumber !== undefined &&
      phoneNumber !== null &&
      String(phoneNumber).trim()
    ) {
      updateData.phone_number = String(phoneNumber).trim();
      updateData.whatsapp_number = String(phoneNumber).trim();
    }

    // Check if profile exists first
    const { data: existingProfile, error: checkError } = await (
      adminSupabase.from("profiles") as any
    )
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (checkError) {
      console.error("Error checking profile existence:", checkError);
      return NextResponse.json(
        { error: `Failed to check profile: ${checkError.message}` },
        { status: 500 }
      );
    }

    console.log("Profile check result:", {
      userId,
      profileExists: !!existingProfile,
      existingRole: existingProfile?.role,
      updateDataKeys: Object.keys(updateData),
    });

    // If profile doesn't exist, we need to create it
    // But we need phone_number from auth.users first
    if (!existingProfile) {
      console.log("Profile does not exist, fetching user phone from auth...");
      const { data: userData, error: userError } =
        await adminSupabase.auth.admin.getUserById(userId);

      if (userError || !userData?.user) {
        console.error("Error fetching user:", userError);
        return NextResponse.json(
          {
            error: `Failed to fetch user data: ${
              userError?.message || "User not found"
            }`,
          },
          { status: 404 }
        );
      }

      const userPhone =
        userData.user.phone || userData.user.user_metadata?.phone;
      if (!userPhone) {
        return NextResponse.json(
          { error: "User phone number not found" },
          { status: 400 }
        );
      }

      // Create new profile
      const newProfileData: any = {
        id: userId,
        phone_number: userPhone,
        whatsapp_number: userPhone,
        updated_at: new Date().toISOString(),
        ...updateData,
      };

      // Set defaults
      if (!newProfileData.role) newProfileData.role = "sender";

      console.log("Creating new profile:", {
        userId,
        phoneNumber: userPhone,
        role: newProfileData.role,
      });

      let { data: newProfile, error: createError } = await (
        adminSupabase.from("profiles") as any
      )
        .insert(newProfileData)
        .select();

      // If creation failed because email column doesn't exist, retry without email
      if (
        createError &&
        "email" in newProfileData &&
        (createError.message?.includes("email") ||
          createError.message?.includes("column") ||
          createError.message?.includes("schema cache"))
      ) {
        console.warn(
          "Email column may not exist, retrying profile creation without email field:",
          createError.message
        );

        const { email, ...newProfileDataWithoutEmail } = newProfileData;
        const retryResult = await (adminSupabase.from("profiles") as any)
          .insert(newProfileDataWithoutEmail)
          .select();

        newProfile = retryResult.data;
        createError = retryResult.error;

        if (createError) {
          console.error("Profile creation error (retry without email):", {
            error: createError,
            message: createError.message,
            details: createError.details,
            hint: createError.hint,
            code: createError.code,
          });
        } else {
          console.warn(
            "Profile created successfully without email field. Email column may not exist in database."
          );
        }
      }

      if (createError) {
        console.error("Profile creation error:", {
          error: createError,
          message: createError.message,
          details: createError.details,
          hint: createError.hint,
          code: createError.code,
        });
        return NextResponse.json(
          {
            error: `Failed to create profile: ${createError.message}`,
            details: createError.details,
            hint: createError.hint,
          },
          { status: 500 }
        );
      }

      console.log("Profile created successfully:", {
        userId,
        newProfile: newProfile?.[0]
          ? {
              full_name: newProfile[0].full_name,
              role: newProfile[0].role,
              street_address: newProfile[0].street_address,
            }
          : null,
      });

      // Continue with courier KYC if needed
      if (role === "courier" && documentPath) {
        const { error: kycError } = await (
          adminSupabase.from("courier_kyc") as any
        ).upsert(
          {
            courier_id: userId,
            id_document_url: documentPath,
            id_document_type: documentType || "national_id",
            verification_status: "pending",
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "courier_id",
          }
        );

        if (kycError) {
          console.error("KYC update error:", kycError);
          console.warn("Profile created but KYC document update failed");
        }
      }

      return NextResponse.json({
        success: true,
        message: "Profile created successfully",
      });
    }

    // Profile exists, update it
    console.log("Updating existing profile with data:", {
      userId,
      hasFullName: !!fullName,
      hasRole: !!role,
      hasStreetAddress: !!streetAddress,
      hasAddressLine2: addressLine2 !== undefined,
      hasCity: !!city,
      hasState: !!state,
      hasPostcode: !!postcode,
      hasCountry: !!country,
      hasEmail: email !== undefined,
      updateDataKeys: Object.keys(updateData),
    });

    // If only updated_at is in updateData, that's fine - just update the timestamp
    if (Object.keys(updateData).length === 1 && updateData.updated_at) {
      console.log("Only timestamp update needed");
    }

    // If email is in updateData but column doesn't exist, try without it
    let updateDataToUse = { ...updateData };
    const hasEmail = "email" in updateDataToUse;

    // First try with all fields
    let { data: updatedProfile, error: updateError } = await (
      adminSupabase.from("profiles") as any
    )
      .update(updateDataToUse)
      .eq("id", userId)
      .select();

    // If update failed because email column doesn't exist, retry without email
    if (
      updateError &&
      hasEmail &&
      (updateError.message?.includes("email") ||
        updateError.message?.includes("column") ||
        updateError.message?.includes("schema cache"))
    ) {
      console.warn(
        "Email column may not exist, retrying update without email field:",
        updateError.message
      );

      // Remove email from update data and try again
      const { email, ...updateDataWithoutEmail } = updateDataToUse;
      updateDataToUse = updateDataWithoutEmail;

      const retryResult = await (adminSupabase.from("profiles") as any)
        .update(updateDataToUse)
        .eq("id", userId)
        .select();

      updatedProfile = retryResult.data;
      updateError = retryResult.error;

      if (retryResult.error) {
        console.error("Profile update error (retry without email):", {
          error: retryResult.error,
          message: retryResult.error.message,
          details: retryResult.error.details,
          hint: retryResult.error.hint,
          code: retryResult.error.code,
        });
      } else {
        console.warn(
          "Profile updated successfully without email field. Email column may not exist in database."
        );
        // Don't fail - just log a warning that email wasn't saved
      }
    }

    if (updateError) {
      console.error("Profile update error:", {
        error: updateError,
        message: updateError.message,
        details: updateError.details,
        hint: updateError.hint,
        code: updateError.code,
        userId,
        updateData: updateDataToUse,
      });
      return NextResponse.json(
        {
          error: `Failed to update profile: ${updateError.message}`,
          details: updateError.details,
          hint: updateError.hint,
        },
        { status: 500 }
      );
    }

    console.log("Profile updated successfully:", {
      userId,
      updatedFields: Object.keys(updateData),
      updatedProfile: updatedProfile?.[0]
        ? {
            full_name: updatedProfile[0].full_name,
            role: updatedProfile[0].role,
            street_address: updatedProfile[0].street_address,
            city: updatedProfile[0].city,
            country: updatedProfile[0].country,
          }
        : null,
    });

    // If courier and document provided, update courier_kyc table
    if (role === "courier" && documentPath) {
      const { error: kycError } = await (
        adminSupabase.from("courier_kyc") as any
      ).upsert(
        {
          courier_id: userId,
          id_document_url: documentPath,
          id_document_type: documentType || "national_id",
          verification_status: "pending",
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "courier_id",
        }
      );

      if (kycError) {
        console.error("KYC update error:", kycError);
        // Don't fail the whole request if KYC update fails
        console.warn("Profile updated but KYC document update failed");
      }
    }

    return NextResponse.json({
      success: true,
      message: "Profile updated successfully",
    });
  } catch (error: any) {
    console.error("Update profile error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update profile" },
      { status: 500 }
    );
  }
}
