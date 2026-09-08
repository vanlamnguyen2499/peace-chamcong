import { prisma } from './prisma';

/**
 * Send notification to Telegram bot if configured in SystemSetting or .env
 */
export async function sendTelegramNotification(message: string): Promise<boolean> {
  try {
    let token = process.env.TELEGRAM_BOT_TOKEN;
    let chatId = process.env.TELEGRAM_CHAT_ID;

    // Check system settings from DB if not in env
    if (!token || !chatId) {
      const tokenSetting = await prisma.systemSetting.findUnique({ where: { key: 'TELEGRAM_BOT_TOKEN' } });
      const chatSetting = await prisma.systemSetting.findUnique({ where: { key: 'TELEGRAM_CHAT_ID' } });
      if (tokenSetting?.value) token = tokenSetting.value;
      if (chatSetting?.value) chatId = chatSetting.value;
    }

    if (!token || !chatId) {
      // Telegram not configured
      return false;
    }

    // Skip actual HTTP request for test/mock tokens or disabled mode
    if (token.startsWith('mock_') || token.includes('MOCK') || process.env.DISABLE_TELEGRAM === 'true') {
      return true;
    }

    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
      }),
      signal: AbortSignal.timeout(3000),
    });

    return res.ok;
  } catch (error) {
    console.error('Failed to send Telegram notification:', error);
    return false;
  }
}
