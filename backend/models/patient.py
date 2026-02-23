from sqlalchemy import Column, Integer, String, Enum
from backend.database import Base
from backend.models.enums import TestName

class Patient(Base):
    __tablename__ = 'patients'

    id = Column(String(3), primary_key=True, index=True)
    name = Column(String, index=True)
    test_name = Column(Enum(TestName), nullable=False)