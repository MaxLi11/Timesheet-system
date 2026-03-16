from sqlalchemy import create_engine, Column, Integer, String, Float, Date, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, sessionmaker
import os

# Get database URL from environment variable, default to local SQLite
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL")

if SQLALCHEMY_DATABASE_URL:
    # Fix for SQLAlchemy 1.4+ which requires 'postgresql://' instead of 'postgres://'
    if SQLALCHEMY_DATABASE_URL.startswith("postgres://"):
        SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("postgres://", "postgresql://", 1)
    
    # Cloud PostgreSQL settings
    engine = create_engine(SQLALCHEMY_DATABASE_URL)
else:
    # Local SQLite settings
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
    department = Column(String, index=True)
    project_name = Column(String, index=True)
    category = Column(String) # Project vs Non-Project (Leave, etc)
    start_date = Column(Date)
    end_date = Column(Date)
    hours = Column(Float)
    task_details = Column(String)
    approval_status = Column(String)
    current_node = Column(String)    # T col: 当前节点 (e.g. 'Get Approval', 'PL Review', 'Close')
    pending_approver = Column(String) # U col: 未操作者

class ProjectSchedule(Base):
    __tablename__ = "project_schedules"

    id = Column(Integer, primary_key=True, index=True)
    project_name = Column(String, index=True, nullable=False)
    bu = Column(String)
    status = Column(String)
    project_order = Column(Integer, nullable=False, default=0)
    planned_days = Column(Float)
    actual_days = Column(Float)
    delta_days = Column(Float)

    milestones = relationship(
        "ProjectScheduleMilestone",
        back_populates="project",
        cascade="all, delete-orphan",
        order_by="ProjectScheduleMilestone.milestone_order",
    )


class ProjectScheduleMilestone(Base):
    __tablename__ = "project_schedule_milestones"

    id = Column(Integer, primary_key=True, index=True)
    schedule_id = Column(Integer, ForeignKey("project_schedules.id"), nullable=False, index=True)
    milestone_name = Column(String, nullable=False)
    milestone_order = Column(Integer, nullable=False, default=0)
    planned_date = Column(Date)
    actual_date = Column(Date)
    delta_days = Column(Float)

    project = relationship("ProjectSchedule", back_populates="milestones")


def init_db():
    Base.metadata.create_all(bind=engine)
