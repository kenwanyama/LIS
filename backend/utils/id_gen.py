import random

ROLE_PREFIX = {
    "Admin": "A",
    "Technician": "T",
    "Supervisor": "S",
}

def generate_user_id(role: str, db) -> str:
    from backend.models.user import User
    prefix = ROLE_PREFIX.get(role, "U")
    while True:
        candidate = f"{prefix}{random.randint(10, 99)}"
        if not db.query(User).filter(User.id == candidate).first():
            return candidate

def generate_patient_id(db) -> str:
    from backend.models.patient import Patient
    while True:
        candidate = f"P{random.randint(10, 99)}"
        if not db.query(Patient).filter(Patient.id == candidate).first():
            return candidate