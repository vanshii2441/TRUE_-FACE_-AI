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
