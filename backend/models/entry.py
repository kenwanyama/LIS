from sqlalchemy import Column, Integer, ForeignKey, DateTime, Enum, String
from sqlalchemy.sql import func
from backend.database import Base
from backend.models.enums import TestName, ResultStatus, SampleStatus

class Entry(Base):
    __tablename__ = 'entries'


    id = Column(Integer, primary_key=True, index=True)

    patient_id = Column(String(3), ForeignKey("patients.id"))
    technician_id = Column(String(3), ForeignKey("users.id"), nullable=True)
    supervisor_id = Column(String(3), ForeignKey("users.id"), nullable=True)

    test_name = Column(Enum(TestName), nullable=False)
    status = Column(Enum(SampleStatus), nullable=False, default="Pending")
    result = Column(Enum(ResultStatus), nullable=True) 

    created_at = Column(DateTime(timezone=True), server_default=func.now())
