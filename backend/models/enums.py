from enum import Enum

class UserRole(str, Enum):
    TECHNICIAN = "Technician"
    SUPERVISOR = "Supervisor"
    ADMIN = "Admin"

class TestName(str, Enum):
    BLOOD_TEST = "Blood Test"
    URINE_TEST = "Urine Test"
    XRAY = "X-Ray"
    MRI = "MRI"

class ResultStatus(str, Enum):
    PENDING = "Pending"
    POSITIVE = "Positive"
    NEGATIVE = "Negative"
    


class SampleStatus(str, Enum):
    PENDING = "Pending"
    PROCESSED = "Processed"
    VERIFIED = "Verified"
    

    