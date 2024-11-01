import { NextResponse } from 'next/server';
import axios from 'axios';

export async function POST(req) {
    const { bot_token, chat_ids, message_thread_id, text, photo } = await req.json();

    const failedChatIds = [];

    if (!bot_token || !chat_ids || !Array.isArray(chat_ids)) {
        return NextResponse.json({ error: 'Бот токен и список chat_ids обязательны.' }, { status: 400 });
    }

    const sendBatchMessages = async (batch) => {
        return Promise.all(batch.map(async (chat_id) => {
            const data = { chat_id, text, message_thread_id };
            try {
                let url = `https://api.telegram.org/bot${bot_token}/sendMessage`;
                if (photo) {
                    url = `https://api.telegram.org/bot${bot_token}/sendPhoto`;
                    data.photo = photo;
                }
                const response = await axios.post(url, data);
                return response.data.ok;
            } catch (error) {
                console.error(`Ошибка отправки сообщения для ${chat_id}: ${error.message}`);
                failedChatIds.push(chat_id);
                return false;
            }
        }));
    };

    for (let i = 0; i < chat_ids.length; i += 10) {
        const batch = chat_ids.slice(i, i + 10);
        await sendBatchMessages(batch);
    }

    return NextResponse.json({
        total: chat_ids.length,
        failedChatIds,
    });
}
