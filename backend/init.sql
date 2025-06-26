-- Инициализация базы данных для Rental System

-- Создаем схему для аудита
CREATE SCHEMA IF NOT EXISTS audit;

-- Создаем расширения (если доступны)
-- uuid-ossp для генерации UUID
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'uuid-ossp') THEN
        CREATE EXTENSION "uuid-ossp";
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Игнорируем ошибки, если нет прав на создание расширений
    NULL;
END$$;

-- pg_trgm для полнотекстового поиска  
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
        CREATE EXTENSION pg_trgm;
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Игнорируем ошибки, если нет прав на создание расширений
    NULL;
END$$;

-- Комментарии к схемам
COMMENT ON SCHEMA public IS 'Основная схема для данных приложения';
COMMENT ON SCHEMA audit IS 'Схема для аудита и логирования действий пользователей';

-- Права доступа для пользователя rental_admin
GRANT ALL PRIVILEGES ON SCHEMA public TO rental_admin;
GRANT ALL PRIVILEGES ON SCHEMA audit TO rental_admin;

-- Права по умолчанию для будущих объектов
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO rental_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA audit GRANT ALL ON TABLES TO rental_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO rental_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA audit GRANT ALL ON SEQUENCES TO rental_admin;