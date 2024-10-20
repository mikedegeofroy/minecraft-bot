import { Bot } from 'mineflayer';

export const configureFight = (bot: Bot) => {
  bot.on('physicsTick', () => {
    const nearest = bot.nearestEntity();
    if (nearest) bot.attack(nearest);
  });
};
