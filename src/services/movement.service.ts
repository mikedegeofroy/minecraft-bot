import { Bot } from 'mineflayer';
import { Movements, goals, pathfinder } from 'mineflayer-pathfinder';

export const configureMovement = (bot: Bot) => {
  bot.loadPlugin(pathfinder);

  bot.once('spawn', () => {
    const defaultMove = new Movements(bot);

    bot.on('chat', () => {
      const nearest = bot.nearestEntity();
      if (!nearest) return;

      bot.pathfinder.setMovements(defaultMove);
      bot.pathfinder.setGoal(new goals.GoalFollow(nearest, 1));
    });
  });
};
