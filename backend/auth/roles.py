from backend.models.enums import UserRole

def can_verify_entry(user_role: str) -> bool:
    return user_role in [UserRole.SUPERVISOR.value, UserRole.ADMIN.value]

def can_manage_users(user_role: str) -> bool:
    return user_role == UserRole.ADMIN.value