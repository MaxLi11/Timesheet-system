from sqlalchemy import create_engine, Column, Integer, String, Float, Date, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

# Ensure database is stored on D drive in the project folder
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "timesheet.db")
SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

class Employee(Base):
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    employee_id = Column(String, unique=True, index=True)
    department = Column(String)
    company = Column(String)
    position = Column(String)

class TimeEntry(Base):
    __tablename__ = "time_entries"

    id = Column(Integer, primary_key=True, index=True)
    employee_name = Column(String, index=True)
    employee_id = Column(String, index=True)
    project_name = Column(String, index=True)
    category = Column(String) # Project vs Non-Project (Leave, etc)
    start_date = Column(Date)
    end_date = Column(Date)
    hours = Column(Float)
    task_details = Column(String)
    approval_status = Column(String)

def init_db():
    Base.metadata.create_all(bind=engine)
