"""
TRUE FACE AI — Email OTP Schemas

Pydantic request models for Email OTP sending and verification.
"""

from pydantic import BaseModel, EmailStr, Field


class OTPSendRequest(BaseModel):
    """Request schema for initiating an Email OTP send request."""

    email: EmailStr = Field(
        ...,
        description="Target user email address for OTP delivery",
        examples=["user@example.com"],
    )


class OTPVerifyRequest(BaseModel):
    """Request schema for verifying a received Email OTP code."""

    email: EmailStr = Field(
        ...,
        description="User email address associated with the OTP code",
        examples=["user@example.com"],
    )
    otp: str = Field(
        ...,
        min_length=6,
        max_length=6,
        pattern=r"^\d{6}$",
        description="6-digit numeric One-Time Password (OTP)",
        examples=["123456"],
    )


class OTPSendResponse(BaseModel):
    """Response schema for successful Email OTP dispatch."""

    success: bool = Field(default=True, description="Status of OTP delivery")
    message: str = Field(..., description="Confirmation message")
    email: EmailStr = Field(..., description="Recipient email address")
    expires_in_minutes: int = Field(..., description="OTP expiration duration in minutes")
    cooldown_seconds: int = Field(..., description="Seconds to wait before next resend")


class OTPVerifyResponse(BaseModel):
    """Response schema for successful Email OTP verification."""

    success: bool = Field(default=True, description="Verification status")
    message: str = Field(..., description="Result message")
    email: EmailStr = Field(..., description="Verified email address")

