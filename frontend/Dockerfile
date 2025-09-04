FROM node:20-alpine AS build

WORKDIR /app

# Копируем package.json и package-lock.json
COPY package*.json ./

# Устанавливаем зависимости
RUN npm ci

# Копируем исходный код
COPY . .

# Собираем приложение для продакшена
RUN npm run build

# Используем простой HTTP сервер для статических файлов
FROM node:20-alpine

WORKDIR /app

# Устанавливаем serve для раздачи статических файлов
RUN npm install -g serve

# Копируем собранное приложение
COPY --from=build /app/dist ./dist

# Открываем порт 3000
EXPOSE 3000

# Запускаем serve
CMD ["serve", "-s", "dist", "-l", "3000"]
