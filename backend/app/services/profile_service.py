from app.services.auth_service import serialize_user, update_user_profile, change_user_password

# Profile service delegates to auth_service for user-related operations.
# Add profile-specific logic here as the app grows (e.g., avatar upload, preferences).

__all__ = ["serialize_user", "update_user_profile", "change_user_password"]