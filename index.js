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

const BATCH_SIZE = 10; // Размер пакета для отправки сообщений
const DELAY_BETWEEN_BATCHES = 2000; // Задержка между пакетами

// Функция для отправки сообщения с временной задержкой
const sendMessage = async (chat_id, bot_token, data) => {
    try {
        const response = await axios.post(`https://api.telegram.org/bot${bot_token}/sendMessage`, {
            chat_id,
            ...data
        });
        return { success: response.data.ok };
    } catch (error) {
        return { error: error.response.data.description || error.message };
    }
};

const sendPhoto = async (chat_id, bot_token, data) => {
    try {
        const response = await axios.post(`https://api.telegram.org/bot${bot_token}/sendPhoto`, {
            chat_id,
            ...data
        });
        return { success: response.data.ok };
    } catch (error) {
        return { error: error.response.data.description || error.message };
    }
};

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
    const errors = [];

    try {
        // Разбиваем chat_ids на чанки
        for (let i = 0; i < chat_ids.length; i += BATCH_SIZE) {
            const batch = chat_ids.slice(i, i + BATCH_SIZE);

            const promises = batch.map(async (chat_id) => {
                const baseData = {
                    parse_mode,
                    disable_notification,
                    protect_content,
                    allow_paid_broadcast,
                    message_effect_id,
                    reply_markup,
                };

                let result;

                // Если передано фото
                if (photo) {
                    const photoData = { caption: text || '', photo, link_preview_options };
                    result = await sendPhoto(chat_id, bot_token, photoData);
                } else if (text) {
                    const messageData = { text, message_thread_id };
                    result = await sendMessage(chat_id, bot_token, messageData);
                } else {
                    failureCount++;
                    errors.push({ chat_id, error: 'Не указаны ни текст сообщения, ни фото.' });
                    return;
                }

                // Обработка результата
                if (result.success) {
                    successCount++;
                } else {
                    failureCount++;
                    errors.push({ chat_id, error: result.error });
                }
            });

            // Ожидаем завершения всех промисов в текущем пакете
            await Promise.all(promises);

            // Задержка между пакетами отправленных запросов
            if (i + BATCH_SIZE < chat_ids.length) {
                await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
            }
        }

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
