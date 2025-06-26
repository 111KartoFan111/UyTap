from sqlalchemy import create_engine, MetaData
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import QueuePool
import os

# Получаем URL базы данных из переменных окружения
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://rental_admin:rental_pass_2024@postgres:5432/rental_system")

# Создаем движок с пулом соединений
engine = create_engine(
    DATABASE_URL,
    poolclass=QueuePool,
    pool_size=20,
    max_overflow=30,
    pool_pre_ping=True,
    pool_recycle=300,
    echo=os.getenv("SQL_ECHO", "false").lower() == "true"  # Используем переменную окружения
)

# Создаем сессию
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Метаданные и базовый класс
metadata = MetaData()
Base = declarative_base(metadata=metadata)

# Dependency для получения сессии БД
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()