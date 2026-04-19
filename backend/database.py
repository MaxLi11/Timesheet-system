import os

from sqlalchemy import Column, Date, DateTime, Float, ForeignKey, Integer, String, create_engine, inspect, text, UniqueConstraint
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, sessionmaker


SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL")

if SQLALCHEMY_DATABASE_URL:
    if SQLALCHEMY_DATABASE_URL.startswith("postgres://"):
        SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("postgres://", "postgresql://", 1)
    engine = create_engine(SQLALCHEMY_DATABASE_URL)
else:
    db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "timesheet.db")
    SQLALCHEMY_DATABASE_URL = f"sqlite:///{db_path}"
    engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


class Employee(Base):
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    employee_id = Column(String, unique=True, index=True)
    department = Column(String)       # 部门全称
    department_abbr = Column(String)  # 部门简称，如 AE / Digital / Analog
    company = Column(String)
    position = Column(String)
    status = Column(String)
    team_leader = Column(String)


class TimeEntry(Base):
    __tablename__ = "time_entries"

    id = Column(Integer, primary_key=True, index=True)
    employee_name = Column(String, index=True)
    employee_id = Column(String, index=True)
    employee_status = Column(String, index=True)
    department = Column(String, index=True)
    department_full = Column(String)
    position = Column(String)
    project_name = Column(String, index=True)
    category = Column(String)
    start_date = Column(Date)
    end_date = Column(Date)
    hours = Column(Float)
    task_details = Column(String)
    approval_status = Column(String)
    current_node = Column(String)
    pending_approver = Column(String)


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


class WorkWeek(Base):
    __tablename__ = "work_weeks"

    id = Column(Integer, primary_key=True, index=True)
    week_start = Column(Date, nullable=False)
    week_end = Column(Date, nullable=False)
    week_code = Column(String, nullable=False)  # e.g. "202601-W1"
    work_month = Column(String, nullable=False)  # e.g. "2026-01"

    __table_args__ = (UniqueConstraint("week_start", name="uq_work_weeks_week_start"),)


class AppState(Base):
    """Single-row style key/value for small persisted UI state."""

    __tablename__ = "app_state"

    key = Column(String(64), primary_key=True)
    value_json = Column(String, nullable=False, default="{}")
    updated_at = Column(DateTime, nullable=True)


def init_db():
    Base.metadata.create_all(bind=engine)
    _backfill_time_entry_columns()
    _backfill_employee_columns()


def _backfill_time_entry_columns():
    inspector = inspect(engine)
    if "time_entries" not in inspector.get_table_names():
        return

    existing_columns = {column["name"] for column in inspector.get_columns("time_entries")}
    required_columns = {
        "department_full": "VARCHAR",
        "position": "VARCHAR",
        "employee_status": "VARCHAR",
    }

    with engine.begin() as connection:
        for column_name, column_type in required_columns.items():
            if column_name in existing_columns:
                continue
            connection.execute(
                text(f"ALTER TABLE time_entries ADD COLUMN {column_name} {column_type}")
            )


def _backfill_employee_columns():
    inspector = inspect(engine)
    if "employees" not in inspector.get_table_names():
        return

    existing_columns = {column["name"] for column in inspector.get_columns("employees")}
    required_columns = {
        "status": "VARCHAR",
        "department_abbr": "VARCHAR",
        "team_leader": "VARCHAR",
    }

    with engine.begin() as connection:
        for column_name, column_type in required_columns.items():
            if column_name in existing_columns:
                continue
            connection.execute(
                text(f"ALTER TABLE employees ADD COLUMN {column_name} {column_type}")
            )
