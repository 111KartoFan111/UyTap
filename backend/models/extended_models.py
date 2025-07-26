# backend/models/extended_models.py
from sqlalchemy import (
    Column, String, Text, Boolean, DateTime, Integer, Float, 
    ForeignKey, Enum, TIMESTAMP, JSON, CheckConstraint, Index
)
from sqlalchemy.dialects.postgresql import UUID, INET, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime, timezone
import uuid
import enum
from .database import Base
from models.models import User, UserRole , Organization, OrganizationStatus # Импортируем базовые модели
from models.payment_models import Payment

# Enums


# Дополнительные Enums
class PropertyStatus(str, enum.Enum):
    AVAILABLE = "available"
    OCCUPIED = "occupied"
    MAINTENANCE = "maintenance"
    CLEANING = "cleaning"
    SUSPENDED = "suspended"
    OUT_OF_ORDER = "out_of_order"


class PropertyType(str, enum.Enum):
    APARTMENT = "apartment"
    ROOM = "room"
    STUDIO = "studio"
    VILLA = "villa"
    OFFICE = "office"


class RentalType(str, enum.Enum):
    HOURLY = "hourly"
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    YEARLY = "yearly"


class PaymentMethod(str, enum.Enum):
    CASH = "cash"
    CARD = "card"
    TRANSFER = "transfer"
    QR_CODE = "qr_code"


class TaskStatus(str, enum.Enum):
    PENDING = "pending"
    ASSIGNED = "assigned"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    FAILED = "failed"


class TaskPriority(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class TaskType(str, enum.Enum):
    CLEANING = "cleaning"
    MAINTENANCE = "maintenance"
    CHECK_IN = "check_in"
    CHECK_OUT = "check_out"
    DELIVERY = "delivery"
    LAUNDRY = "laundry"


class PayrollType(str, enum.Enum):
    MONTHLY_SALARY = "monthly_salary"
    HOURLY = "hourly"
    PIECE_WORK = "piece_work"  # Сдельная


class DocumentType(str, enum.Enum):
    CONTRACT = "contract"
    INVOICE = "invoice"
    ACT_OF_WORK = "act_of_work"
    RECEIPT = "receipt"
    ESF = "esf"  # Электронная счет-фактура


class OrderStatus(str, enum.Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    IN_PROGRESS = "in_progress"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"


# Модель помещений
class Property(Base):
    __tablename__ = "properties"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    
    # Основная информация
    name = Column(String(255), nullable=False)
    number = Column(String(50), nullable=False)
    floor = Column(Integer)
    building = Column(String(100))
    address = Column(Text)
    
    # Характеристики
    property_type = Column(Enum(PropertyType), nullable=False)
    area = Column(Float)  # площадь в м²
    rooms_count = Column(Integer)
    max_occupancy = Column(Integer)
    
    # Статус и доступность
    status = Column(Enum(PropertyStatus), nullable=False, default=PropertyStatus.AVAILABLE)
    is_active = Column(Boolean, default=True)
    
    # Тарифы
    hourly_rate = Column(Float)
    daily_rate = Column(Float)
    weekly_rate = Column(Float)
    monthly_rate = Column(Float)
    yearly_rate = Column(Float)
    
    # Описание и удобства
    description = Column(Text)
    amenities = Column(JSONB, default=list)  # ["wifi", "tv", "kitchen", "parking"]
    photos = Column(JSONB, default=list)  # список URL фотографий
    
    # Даты
    created_at = Column(TIMESTAMP(timezone=True), default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), default=func.now(), onupdate=func.now())
    
    # Отношения
    organization = relationship("Organization", back_populates="properties")
    rentals = relationship("Rental", back_populates="property", cascade="all, delete-orphan")
    tasks = relationship("Task", back_populates="property")
    orders = relationship("RoomOrder", back_populates="property")

    __table_args__ = (
        CheckConstraint("area > 0", name="check_positive_area"),
        CheckConstraint("max_occupancy > 0", name="check_positive_occupancy"),
        Index("idx_property_org_number", "organization_id", "number", unique=True),
        Index("idx_property_status", "status"),
    )


# Модель клиентов
class Client(Base):
    __tablename__ = "clients"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    
    # Персональная информация
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    middle_name = Column(String(100))
    
    # Контакты
    phone = Column(String(50))
    email = Column(String(255))
    
    # Документы
    document_type = Column(String(50))  # passport, id_card
    document_number = Column(String(50))
    document_issued_by = Column(String(255))
    document_issued_date = Column(DateTime)
    
    # Адрес
    country = Column(String(100))
    city = Column(String(100))
    address = Column(Text)
    postal_code = Column(String(20))
    
    # Источник привлечения
    source = Column(String(100))  # walk-in, instagram, booking, referral
    
    # Предпочтения и заметки
    preferences = Column(JSONB, default=dict)
    notes = Column(Text)
    
    # Даты
    date_of_birth = Column(DateTime)
    created_at = Column(TIMESTAMP(timezone=True), default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), default=func.now(), onupdate=func.now())
    last_visit = Column(TIMESTAMP(timezone=True))
    
    # Статистика
    total_rentals = Column(Integer, default=0)
    total_spent = Column(Float, default=0)
    
    # Отношения
    organization = relationship("Organization", back_populates="clients")
    rentals = relationship("Rental", back_populates="client")
    orders = relationship("RoomOrder", back_populates="client")

    __table_args__ = (
        Index("idx_client_org_phone", "organization_id", "phone"),
        Index("idx_client_org_email", "organization_id", "email"),
        Index("idx_client_document", "document_type", "document_number"),
    )


# Модель аренды
class Rental(Base):
    __tablename__ = "rentals"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    property_id = Column(UUID(as_uuid=True), ForeignKey("properties.id", ondelete="CASCADE"), nullable=False)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    
    # Тип и период аренды
    rental_type = Column(Enum(RentalType), nullable=False)
    start_date = Column(TIMESTAMP(timezone=True), nullable=False)
    end_date = Column(TIMESTAMP(timezone=True), nullable=False)
    
    # Финансы
    rate = Column(Float, nullable=False)  # тариф
    total_amount = Column(Float, nullable=False)
    deposit = Column(Float, default=0)
    paid_amount = Column(Float, default=0)
    payment_method = Column(Enum(PaymentMethod))
    
    # Гости
    guest_count = Column(Integer, default=1)
    additional_guests = Column(JSONB, default=list)  # список дополнительных гостей
    
    # Статус
    is_active = Column(Boolean, default=True)
    checked_in = Column(Boolean, default=False)
    checked_out = Column(Boolean, default=False)
    check_in_time = Column(TIMESTAMP(timezone=True))
    check_out_time = Column(TIMESTAMP(timezone=True))
    
    # Заметки
    notes = Column(Text)
    special_requests = Column(Text)
    
    # Даты
    created_at = Column(TIMESTAMP(timezone=True), default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), default=func.now(), onupdate=func.now())
    
    # Отношения
    organization = relationship("Organization")
    property = relationship("Property", back_populates="rentals")
    client = relationship("Client", back_populates="rentals")
    orders = relationship("RoomOrder", back_populates="rental")
    documents = relationship("Document", back_populates="rental")
    payments = relationship("Payment", back_populates="rental", cascade="all, delete-orphan")
    __table_args__ = (
        CheckConstraint("end_date > start_date", name="check_rental_dates"),
        CheckConstraint("total_amount >= 0", name="check_positive_amount"),
        CheckConstraint("guest_count > 0", name="check_positive_guests"),
        Index("idx_rental_dates", "start_date", "end_date"),
        Index("idx_rental_property", "property_id"),
    )


# Модель задач
class Task(Base):
    __tablename__ = "tasks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    property_id = Column(UUID(as_uuid=True), ForeignKey("properties.id", ondelete="CASCADE"))
    assigned_to = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    
    # Основная информация
    title = Column(String(255), nullable=False)
    description = Column(Text)
    task_type = Column(Enum(TaskType), nullable=False)
    priority = Column(Enum(TaskPriority), default=TaskPriority.MEDIUM)
    status = Column(Enum(TaskStatus), default=TaskStatus.PENDING)
    
    # Время
    estimated_duration = Column(Integer)  # в минутах
    actual_duration = Column(Integer)  # в минутах
    due_date = Column(TIMESTAMP(timezone=True))
    started_at = Column(TIMESTAMP(timezone=True))
    completed_at = Column(TIMESTAMP(timezone=True))
    
    # Оплата
    payment_amount = Column(Float, default=0)
    payment_type = Column(String(20))  # "fixed", "percentage", "none"
    is_paid = Column(Boolean, default=False)
    
    # Результат
    completion_notes = Column(Text)
    quality_rating = Column(Integer)  # 1-5
    
    # Даты
    created_at = Column(TIMESTAMP(timezone=True), default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), default=func.now(), onupdate=func.now())
    
    # Отношения
    organization = relationship("Organization")
    property = relationship("Property", back_populates="tasks")
    assignee = relationship("User", foreign_keys=[assigned_to])
    creator = relationship("User", foreign_keys=[created_by])

    __table_args__ = (
        Index("idx_task_assignee", "assigned_to"),
        Index("idx_task_status", "status"),
        Index("idx_task_property", "property_id"),
    )


# Модель заказов в номер
class RoomOrder(Base):
    __tablename__ = "room_orders"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    property_id = Column(UUID(as_uuid=True), ForeignKey("properties.id", ondelete="CASCADE"), nullable=False)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id"))
    rental_id = Column(UUID(as_uuid=True), ForeignKey("rentals.id"))
    assigned_to = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    
    # Основная информация
    order_number = Column(String(50), unique=True)
    order_type = Column(String(50))  # "food", "service", "delivery"
    title = Column(String(255), nullable=False)
    description = Column(Text)
    
    # Статус
    status = Column(Enum(OrderStatus), default=OrderStatus.PENDING)
    
    # Финансы
    total_amount = Column(Float, default=0)
    payment_method = Column(Enum(PaymentMethod))
    is_paid = Column(Boolean, default=False)
    
    # Исполнитель
    executor_type = Column(String(20))  # "employee", "department"
    payment_to_executor = Column(Float, default=0)
    payment_type = Column(String(20))  # "fixed", "percentage", "none"
    
    # Время
    requested_at = Column(TIMESTAMP(timezone=True), default=func.now())
    scheduled_for = Column(TIMESTAMP(timezone=True))
    completed_at = Column(TIMESTAMP(timezone=True))
    
    # Детали заказа
    items = Column(JSONB, default=list)  # список товаров/услуг
    special_instructions = Column(Text)
    
    # Даты
    created_at = Column(TIMESTAMP(timezone=True), default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), default=func.now(), onupdate=func.now())
    
    # Отношения
    organization = relationship("Organization")
    property = relationship("Property", back_populates="orders")
    client = relationship("Client", back_populates="orders")
    rental = relationship("Rental", back_populates="orders")
    assignee = relationship("User")

    __table_args__ = (
        Index("idx_order_property", "property_id"),
        Index("idx_order_status", "status"),
        Index("idx_order_number", "order_number", unique=True),
    )


# Модель документов
class Document(Base):
    __tablename__ = "documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    rental_id = Column(UUID(as_uuid=True), ForeignKey("rentals.id"))
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id"))
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    
    # Основная информация
    document_type = Column(Enum(DocumentType), nullable=False)
    document_number = Column(String(100))
    title = Column(String(255), nullable=False)
    
    # Содержимое
    content = Column(JSONB)  # структурированные данные документа
    file_path = Column(String(500))  # путь к PDF файлу
    template_used = Column(String(100))
    
    # Статус
    is_signed = Column(Boolean, default=False)
    signed_at = Column(TIMESTAMP(timezone=True))
    signature_data = Column(JSONB)  # данные о подписи
    
    # ESF статус
    esf_status = Column(String(50))  # для электронных счет-фактур
    esf_sent_at = Column(TIMESTAMP(timezone=True))
    esf_response = Column(JSONB)
    
    # Даты
    created_at = Column(TIMESTAMP(timezone=True), default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), default=func.now(), onupdate=func.now())
    
    # Отношения
    organization = relationship("Organization")
    rental = relationship("Rental", back_populates="documents")
    client = relationship("Client")
    creator = relationship("User")

    __table_args__ = (
        Index("idx_document_type", "document_type"),
        Index("idx_document_number", "document_number"),
    )


# Модель зарплаты
class Payroll(Base):
    __tablename__ = "payrolls"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    # Период
    period_start = Column(DateTime, nullable=False)
    period_end = Column(DateTime, nullable=False)
    
    # Тип оплаты
    payroll_type = Column(Enum(PayrollType), nullable=False)
    
    # Базовая ставка
    base_rate = Column(Float)  # оклад/час/за задачу
    
    # Отработанное время (для почасовиков)
    hours_worked = Column(Float, default=0)
    
    # Выполненные задачи (для сдельщиков)
    tasks_completed = Column(Integer, default=0)
    tasks_payment = Column(Float, default=0)
    
    # Дополнительные доходы
    bonus = Column(Float, default=0)
    tips = Column(Float, default=0)
    other_income = Column(Float, default=0)
    
    # Вычеты
    deductions = Column(Float, default=0)
    taxes = Column(Float, default=0)
    
    # Итого
    gross_amount = Column(Float, nullable=False)
    net_amount = Column(Float, nullable=False)
    
    # Статус выплаты
    is_paid = Column(Boolean, default=False)
    paid_at = Column(TIMESTAMP(timezone=True))
    payment_method = Column(String(50))
    
    # Заметки
    notes = Column(Text)
    
    # Даты
    created_at = Column(TIMESTAMP(timezone=True), default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), default=func.now(), onupdate=func.now())
    
    # Отношения
    organization = relationship("Organization")
    user = relationship("User")

    __table_args__ = (
        CheckConstraint("period_end > period_start", name="check_payroll_period"),
        CheckConstraint("gross_amount >= 0", name="check_positive_gross"),
        Index("idx_payroll_user_period", "user_id", "period_start", "period_end"),
    )


# Модель материалов/инвентаря
class Inventory(Base):
    __tablename__ = "inventory"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    
    # Основная информация
    name = Column(String(255), nullable=False)
    description = Column(Text)
    category = Column(String(100))
    sku = Column(String(100))  # артикул
    
    # Единицы измерения
    unit = Column(String(50))  # шт, кг, л, м2
    
    # Остатки
    current_stock = Column(Float, default=0)
    min_stock = Column(Float, default=0)
    max_stock = Column(Float)
    
    # Стоимость
    cost_per_unit = Column(Float)
    total_value = Column(Float, default=0)
    
    # Поставщик
    supplier = Column(String(255))
    supplier_contact = Column(String(255))
    
    # Статус
    is_active = Column(Boolean, default=True)
    
    # Даты
    created_at = Column(TIMESTAMP(timezone=True), default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), default=func.now(), onupdate=func.now())
    last_restock_date = Column(TIMESTAMP(timezone=True))
    
    # Отношения
    organization = relationship("Organization")
    movements = relationship("InventoryMovement", back_populates="inventory_item")

    __table_args__ = (
        CheckConstraint("current_stock >= 0", name="check_positive_stock"),
        Index("idx_inventory_org_sku", "organization_id", "sku", unique=True),
    )


# Модель движения материалов
class InventoryMovement(Base):
    __tablename__ = "inventory_movements"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    inventory_id = Column(UUID(as_uuid=True), ForeignKey("inventory.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    task_id = Column(UUID(as_uuid=True), ForeignKey("tasks.id"))
    
    # Тип движения
    movement_type = Column(String(50), nullable=False)  # "in", "out", "adjustment", "writeoff"
    
    # Количество
    quantity = Column(Float, nullable=False)
    unit_cost = Column(Float)
    total_cost = Column(Float)
    
    # Причина
    reason = Column(String(255))
    notes = Column(Text)
    
    # Остаток после операции
    stock_after = Column(Float, nullable=False)
    
    # Даты
    created_at = Column(TIMESTAMP(timezone=True), default=func.now())
    
    # Отношения
    organization = relationship("Organization")
    inventory_item = relationship("Inventory", back_populates="movements")
    user = relationship("User")
    task = relationship("Task")

    __table_args__ = (
        Index("idx_movement_inventory", "inventory_id"),
        Index("idx_movement_date", "created_at"),
    )


# Обновляем существующие модели
# Добавляем отношения в Organization
Organization.properties = relationship("Property", back_populates="organization", cascade="all, delete-orphan")
Organization.clients = relationship("Client", back_populates="organization", cascade="all, delete-orphan")

# Добавляем отношения в User
User.assigned_tasks = relationship("Task", foreign_keys=[Task.assigned_to], back_populates="assignee")
User.created_tasks = relationship("Task", foreign_keys=[Task.created_by], back_populates="creator")
User.payrolls = relationship("Payroll", back_populates="user")