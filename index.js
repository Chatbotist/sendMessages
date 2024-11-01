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
    const {
        bot_token,
        chat_ids,
        message_thread_id,
        text,
        photo,
        parse_mode,
        link_preview_options,
        disable_notification,
        protect_content,
        allow_paid_broadcast,
        message_effect_id,
        reply_markup
    } = req.body;

    // Проверяем обязательные параметры
    if (!bot_token || !chat_ids || !Array.isArray(chat_ids)) {
        return res.status(400).json({ error: 'Бот токен и список chat_ids обязательны.' });
    }

    let successCount = 0;
    let failureCount = 0;
    const errors = []; // Для хранения ошибок

    try {
        // Обработка каждого chat_id
        const promises = chat_ids.map(async (chat_id) => {
            let response;

            try {
                // Подготовка общего объекта для отправки
                const baseData = {
                    chat_id,
                    parse_mode,
                    disable_notification,
                    protect_content,
                    allow_paid_broadcast,
                    message_effect_id,
                    reply_markup,
                };

                // Если есть фото, используем метод sendPhoto
                if (photo) {
                    response = await axios.post(`https://api.telegram.org/bot${bot_token}/sendPhoto`, {
                        ...baseData,
                        caption: text || '', // Используем text в качестве caption
                        photo,
                        link_preview_options // Добавление параметра link_preview_options, если передан
                    });
                } 
                // Если текст есть (и фото нет), используем метод sendMessage
                else if (text) {
                    response = await axios.post(`https://api.telegram.org/bot${bot_token}/sendMessage`, {
                        ...baseData,
                        text,
                        message_thread_id // Добавляем message_thread_id к методу отправки
                    });
                } else {
                    failureCount++;
                    errors.push({ chat_id, error: 'Не указаны ни текст сообщения, ни фото.' });
                    return;
                }

                if (response.data.ok) {
                    successCount++;
                } else {
                    failureCount++;
                    errors.push({ chat_id, error: response.data.description });
                }
            } catch (error) {
                console.error(`Ошибка при отправке сообщения пользователю ${chat_id}:`, error.message);
                failureCount++;
                errors.push({ chat_id, error: error.message });
            }
        });

        // Ожидаем завершения всех промисов
        await Promise.all(promises);

        // Формируем и отправляем результат на клиент
        res.json({
            users: chat_ids.length,
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
