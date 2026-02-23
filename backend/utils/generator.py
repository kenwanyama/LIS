import random
from backend.models.patient import Patient
from backend.models.enums import TestName

FIRST_NAMES = [
    "James", "Mary", "John", "Patricia",
    "David", "Linda", "Michael", "Jennifer"
]

LAST_NAMES = [
    "Smith", "Johnson", "Brown", "Williams",
    "Jones", "Garcia", "Miller", "Davis"
]

def generate_random_name():
    first = random.choice(FIRST_NAMES)
    last = random.choice(LAST_NAMES)
    return f"{first} {last}"

def generate_list(n=10, db=None):
    from backend.utils.id_gen import generate_patient_id
    
    used_in_batch = set()  # track IDs used in THIS batch
    patients = []
    
    for _ in range(n):
        while True:
            pid = generate_patient_id(db)
            if pid not in used_in_batch:
                used_in_batch.add(pid)
                break
        
        patients.append(Patient(
            id=pid,
            name=generate_random_name(),
            test_name=random.choice(list(TestName)).value
        ))
    
    return patients