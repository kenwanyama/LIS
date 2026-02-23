import uuid
from fastapi import FastAPI, Depends, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import random
import bcrypt
from datetime import datetime, timedelta
import secrets


from backend.database import SessionLocal, engine, Base
from backend.models.user import User
from backend.models.enums import UserRole, TestName, SampleStatus, ResultStatus
from backend.models.patient import Patient
from backend.models.entry import Entry
from backend.auth.roles import can_verify_entry, can_manage_users
from backend.utils.generator import generate_list
from backend.utils.id_gen import generate_user_id, generate_patient_id

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Laboratory Information System")
active_sessions = {}

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.on_event("startup")
@app.on_event("startup")
def create_default_users():
    db = SessionLocal()
    
    # Create admin if not exists
    if not db.query(User).filter(User.name == "admin").first():
        admin = User(
            id="A01",
            name="admin",
            password=bcrypt.hashpw("admin123".encode('utf-8'), bcrypt.gensalt()).decode('utf-8'),
            role=UserRole.ADMIN.value
        )
        db.add(admin)
    
    # Create technician if not exists
    if not db.query(User).filter(User.name == "tech").first():
        tech = User(
            id="T01",
            name="tech",
            password=bcrypt.hashpw("tech123".encode('utf-8'), bcrypt.gensalt()).decode('utf-8'),
            role=UserRole.TECHNICIAN.value
        )
        db.add(tech)
    
    # Create supervisor if not exists
    if not db.query(User).filter(User.name == "super").first():
        supervisor = User(
            id="S01",
            name="super",
            password=bcrypt.hashpw("super123".encode('utf-8'), bcrypt.gensalt()).decode('utf-8'),
            role=UserRole.SUPERVISOR.value
        )
        db.add(supervisor)
    
    db.commit()
    db.close()


@app.post("/login/")
def login(name: str, password: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.name == name).first()

    if not user or not bcrypt.checkpw(password.encode('utf-8'), user.password.encode('utf-8')):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(hours=1)

    active_sessions[token] = {  
        "user_id": user.id,
        "expires_at": expires_at
    }

    return {
        "message": "Login successful",
        "token": token,
        "role": user.role,
        "user_id": user.id,
        "name": user.name
    }


def get_current_user(token: str = Header(...), db: Session = Depends(get_db)):
    session_data = active_sessions.get(token)

    if not session_data:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    if session_data["expires_at"] < datetime.utcnow():
        del active_sessions[token]
        raise HTTPException(status_code=401, detail="Session expired")
    
    user_id = session_data["user_id"]

    user = db.query(User).filter(User.id == user_id).first()
    return user

@app.post("/Users/")
def create_user(name: str, password: str, role: UserRole, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    if not can_manage_users(current_user.role):
        raise HTTPException(status_code=403, detail="Only admins can create users")

    user = User(
        id=generate_user_id(role.value, db),
        name=name,
        password=bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8'),        
        role=role.value,
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return user

@app.post("/Patients/")
@app.post("/Patients/")
def generate_patient(db: Session = Depends(get_db)):
    used_ids = {e.patient_id for e in db.query(Entry).all()}
    unused = db.query(Patient).filter(~Patient.id.in_(used_ids)).all()
    for p in unused:
        db.delete(p)
    db.commit()

    patients = generate_list(db=db)
    db.add_all(patients)
    db.commit()
    for p in patients:
        db.refresh(p)
    
    return [{"id": p.id, "name": p.name, "test_name": p.test_name} for p in patients]

@app.get("/Patients/")
def list_patients(db: Session = Depends(get_db)):
    return db.query(Patient).all()


@app.post("/Entry/")
def create_entry(patient_id: str, test_name: TestName, user_id: str, user_name: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id, User.name == user_name).first()
    if not user:
        raise HTTPException(status_code=403, detail="Not authorized to create entries")
    
    valid_entry = db.query(Patient).filter(Patient.id == patient_id, Patient.test_name == test_name.value).first()
    if not valid_entry:
        raise HTTPException(status_code=404, detail="Invalid patient or test name")

    existing_entry = db.query(Entry).filter(Entry.patient_id == patient_id,Entry.test_name == test_name.value).first()
    if existing_entry:
        raise HTTPException(status_code=400, detail="This test has already been ordered for this patient")    
    
    entry = Entry(patient_id=patient_id,
                  technician_id=user_id,
                test_name=test_name.value, 
                status=SampleStatus.PENDING,
                result=ResultStatus.PENDING)
    db.add(entry)

    
    db.commit()
    db.refresh(entry)
    return entry

@app.get("/Entry/")
def list_entries(db: Session = Depends(get_db)):
    return db.query(Entry).all()

@app.post("/Entry/{entry_id}/process")
def process_entry(entry_id: int, user_id: str, db: Session = Depends(get_db)):
    entry = db.query(Entry).filter(Entry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=403, detail="Not authorized to process entries")
    
    entry.status = SampleStatus.PROCESSED
    db.commit()
    db.refresh(entry)
    return entry


@app.post("/Entry/{entry_id}/verify")
def verify_entry(entry_id: int, result: ResultStatus, user_id: str, db: Session = Depends(get_db)):
    # Get user
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=403, detail="User not found")

 
    if not can_verify_entry(user.role):
        raise HTTPException(status_code=403, detail="User not authorized to verify entries")

    # Get entry
    entry = db.query(Entry).filter(Entry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    # Only allow verification if processed
    if entry.status != SampleStatus.PROCESSED:
        raise HTTPException(status_code=400, detail="Entry must be processed before verification")

    # Verify entry
    entry.result = result.value
    entry.status = SampleStatus.VERIFIED
    entry.supervisor_id = user.id

    db.commit()
    db.refresh(entry)

    return entry

@app.delete("/Users/{target_user_id}")
def delete_user(target_user_id: str, admin_id: str, db: Session = Depends(get_db)):
    admin = db.query(User).filter(User.id == admin_id).first()
    if not admin:
        raise HTTPException(status_code=403, detail="Admin not found")

    if not can_manage_users(admin.role):
        raise HTTPException(status_code=403, detail="Only admins can delete users")

    user = db.query(User).filter(User.id == target_user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    db.delete(user)
    db.commit()

    return {"detail": "User deleted successfully"}

@app.post("/Users/{target_user_id}/promote")
def promote_user(target_user_id: str, new_role: UserRole, admin_id: str, db: Session = Depends(get_db)):
    admin = db.query(User).filter(User.id == admin_id).first()
    if not admin or not can_manage_users(admin.role):
        raise HTTPException(status_code=403, detail="Only admins can promote users")

    user = db.query(User).filter(User.id == target_user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.role = new_role.value
    db.commit()
    db.refresh(user)
    return {"detail": f"User {user.name} promoted to {new_role.value}", "user": user}

@app.get("/Users/")
def list_users(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not can_manage_users(current_user.role):
        raise HTTPException(status_code=403, detail="Only admins can view users")
    return db.query(User).all()