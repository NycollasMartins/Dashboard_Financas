/*
 * Payloads no FORMATO REAL da Bot API do Telegram (campos e aninhamento como o
 * Telegram envia; ids e textos fictícios). Base: https://core.telegram.org/bots/api#update
 */
// Base aleatória: update_id nunca repete entre execuções (a idempotência descartaria).
let seq = 900_000_000 + Math.floor(Math.random() * 90_000_000);
const nextId = () => ++seq;
const user = (chatId: number) => ({ id: chatId, is_bot: false, first_name: "Bruno", username: "bruno_teste", language_code: "pt-br" });
const privateChat = (chatId: number) => ({ id: chatId, first_name: "Bruno", username: "bruno_teste", type: "private" });

export const tgText = (chatId: number, text: string, updateId = nextId()) => ({
  update_id: updateId,
  message: {
    message_id: updateId % 100000, from: user(chatId), chat: privateChat(chatId), date: 1795000000, text,
    ...(text.startsWith("/") ? { entities: [{ offset: 0, length: text.split(" ")[0].length, type: "bot_command" }] } : {}),
  },
});

export const tgPhoto = (chatId: number, caption?: string, updateId = nextId()) => ({
  update_id: updateId,
  message: {
    message_id: updateId % 100000, from: user(chatId), chat: privateChat(chatId), date: 1795000000,
    photo: [
      { file_id: "AgACAgEAAxkBAAIBc2_small", file_unique_id: "AQADs1", file_size: 1520, width: 90, height: 120 },
      { file_id: "AgACAgEAAxkBAAIBc2_medium", file_unique_id: "AQADs2", file_size: 21480, width: 240, height: 320 },
      { file_id: "AgACAgEAAxkBAAIBc2_large", file_unique_id: "AQADs3", file_size: 98760, width: 600, height: 800 },
      { file_id: "AgACAgEAAxkBAAIBc2_xl", file_unique_id: "AQADs4", file_size: 187220, width: 960, height: 1280 },
    ],
    ...(caption ? { caption } : {}),
  },
});

export const tgVoice = (chatId: number, duration = 4, updateId = nextId()) => ({
  update_id: updateId,
  message: {
    message_id: updateId % 100000, from: user(chatId), chat: privateChat(chatId), date: 1795000000,
    voice: { duration, mime_type: "audio/ogg", file_id: "AwACAgEAAxkBAAIBdGvoice", file_unique_id: "AgADv1", file_size: 9821 },
  },
});

export const tgCallback = (chatId: number, data: string, messageId = 4242, updateId = nextId()) => ({
  update_id: updateId,
  callback_query: {
    id: `48217${updateId}`,
    from: user(chatId),
    message: {
      message_id: messageId, from: { id: 7000000001, is_bot: true, first_name: "Lar+", username: "LarMaisBot" },
      chat: privateChat(chatId), date: 1795000000, text: "Confira antes de gravar.",
    },
    chat_instance: "-5163541880236471234",
    data,
  },
});

export const tgGroupText = (chatId: number, text: string, updateId = nextId()) => ({
  update_id: updateId,
  message: {
    message_id: updateId % 100000, from: user(777), chat: { id: chatId, title: "Família", type: "group", all_members_are_administrators: true },
    date: 1795000000, text,
  },
});
