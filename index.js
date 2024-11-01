const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware для парсинга JSON
app.use(bodyParser.json());

// Отдаем статические файлы из папки public
app.use(express.static(path.join(__dirname, 'public')));

// Endpoint для отправки сообщений
app.post('/send', async (req, res) => {
    const { bot_token, telegram_ids, text, photo_url } = req.body;

    // Проверяем обязательные параметры
    if (!bot_token || !telegram_ids || !Array.isArray(telegram_ids)) {
        return res.status(400).json({ error: 'Бот токен и список telegram_ids обязательны.' });
    }

    let successCount = 0;
    let failureCount = 0;
    const errors = []; // Для хранения ошибок

    try {
        for (const id of telegram_ids) {
            try {
                if (photo_url) {
                    // Отправляем фото с текстом, если заполнено photo_url
                    const response = await axios.post(`https://api.telegram.org/bot${bot_token}/sendPhoto`, {
                        chat_id: id,
                        photo: photo_url,
                        caption: text || '' // Передаем текст, если он есть
                    });

                    if (response.data.ok) {
                        successCount++;
                    } else {
                        failureCount++;
                        errors.push({ id, error: response.data.description });
                    }
                } else if (text) {
                    // Отправляем текстовое сообщение, если photo_url не заполнено
                    const response = await axios.post(`https://api.telegram.org/bot${bot_token}/sendMessage`, {
                        chat_id: id,
                        text: text,
                    });

                    if (response.data.ok) {
                        successCount++;
                    } else {
                        failureCount++;
                        errors.push({ id, error: response.data.description });
                    }
                } else {
                    // Если ни одно из полей не заполнено (это не должно происходить из-за проверки на уровне формы)
                    failureCount++;
                    errors.push({ id, error: 'Не указаны ни текст сообщения, ни URL фото.' });
                }
            } catch (error) {
                console.error(`Ошибка при отправке сообщения пользователю ${id}:`, error.message);
                failureCount++;
                errors.push({ id, error: error.message });
            }
        }

        // Формируем и отправляем результат на клиент
        res.json({
            users: telegram_ids.length,
            success: successCount,
            errors: failureCount,
            errorDetails: errors
        });
    } catch (error) {
        console.error('Ошибка при обработке запроса:', error.message);
        res.status(500).json({ error: 'Не удалось отправить сообщение.' });
    }
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
