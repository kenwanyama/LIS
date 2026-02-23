from sqlalchemy import Column, Integer, String, Enum
from backend.database import Base   
from backend.models.enums import UserRole


class User(Base):
    __tablename__ = 'users'

    id = Column(String(3), primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    role = Column(Enum(UserRole), index=True)
    password = Column(String, nullable=False) 