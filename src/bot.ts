import mineflayer from 'mineflayer';
import { pathfinder, Movements, goals } from 'mineflayer-pathfinder';
import ollama, { ToolCall } from 'ollama';

const bot = mineflayer.createBot({
  host: 'localhost',
  port: 25565,
  username: 'bot',
});

bot.loadPlugin(pathfinder);

const systemPrompt = {
  role: 'system',
  content:
    'You are a Minecraft player, a bot. Your username is "bot", you can use it with commands. You will receive information on what is happening in the game and the result of your functions. You have functions at your disposal, and you can execute multiple commands like chatting, moving, or finding a player’s location. You can also chain commands. The game is constantly changing, so when you act, try to refetch the data you are using. When a player asks you to come here, it means to come to their coordinates.',
};

let conversationHistory = [systemPrompt];

async function askOllama(command: string) {
  try {
    conversationHistory.push({ role: 'user', content: command });

    const response = await ollama.chat({
      model: 'llama3.2',
      messages: conversationHistory,
      tools: [
        {
          type: 'function',
          function: {
            name: 'idle',
            description: 'Stay idle for some time.',
            parameters: {
              type: 'object',
              properties: {},
              required: [],
            },
          },
        },
        {
          type: 'function',
          function: {
            name: 'chat',
            description: 'Send a chat message to the Minecraft server.',
            parameters: {
              type: 'object',
              properties: {
                message: {
                  type: 'string',
                  description: 'The message to send in the chat.',
                },
              },
              required: ['message'],
            },
          },
        },
        {
          type: 'function',
          function: {
            name: 'move',
            description:
              'Move to specified coordinates (x, y, z) in the Minecraft world.',
            parameters: {
              type: 'object',
              properties: {
                x: {
                  type: 'number',
                  description: 'The x coordinate to move to.',
                },
                y: {
                  type: 'number',
                  description: 'The y coordinate to move to.',
                },
                z: {
                  type: 'number',
                  description: 'The z coordinate to move to.',
                },
              },
              required: ['x', 'y', 'z'],
            },
          },
        },
        {
          type: 'function',
          function: {
            name: 'get_player_location',
            description: 'Get the location of a player by their username.',
            parameters: {
              type: 'object',
              properties: {
                username: {
                  type: 'string',
                  description:
                    'The username of the player to get the location of.',
                },
              },
              required: ['username'],
            },
          },
        },
      ],
    });

    conversationHistory.push(response.message);

    if (response.message.tool_calls) {
      for (const tool_call of response.message.tool_calls) {
        handleBotAction(tool_call);
      }
    }
  } catch (error) {
    console.error('Error communicating with Ollama:', error);
  }
}

async function handleBotAction(call: ToolCall) {
  console.log(call.function);
  switch (call.function.name) {
    case 'chat':
      bot.chat(call.function.arguments.message);
      break;
    case 'move':
      const { x, y, z } = call.function.arguments;
      moveToLocation(x, y, z).then(async () => {
        await askOllama(
          JSON.stringify({
            moved_to: {
              x,
              y,
              z,
            },
          })
        );
      });
      break;
    case 'get_player_location':
      const { username } = call.function.arguments;
      const location = getPlayerLocation(username);
      if (location) {
        await askOllama(
          JSON.stringify({
            player_location: {
              username,
              location,
            },
          })
        );
      } else {
        bot.chat(`Could not find player ${username}`);
      }
      break;
    default:
      console.log('Unknown action:', call.function.name);
  }
}

function moveToLocation(x: number, y: number, z: number) {
  return new Promise<void>((resolve, reject) => {
    const targetPosition = new goals.GoalBlock(x, y, z);
    const defaultMove = new Movements(bot);

    bot.pathfinder.setMovements(defaultMove);
    bot.pathfinder.setGoal(targetPosition);

    bot.once('goal_reached', () => {
      resolve();
    });

    bot.once('path_update', (r) => {
      if (r.status === 'noPath') {
        reject(new Error('No path to target location'));
      }
    });
  });
}

function getPlayerLocation(username: string) {
  const player = bot.players[username]?.entity;
  if (player) {
    return {
      x: player.position.x,
      y: player.position.y,
      z: player.position.z,
    };
  }
  return null;
}

bot.on('chat', async (username, message) => {
  if (username === bot.username) return;

  console.log(`Received message from ${username}: ${message}`);

  await askOllama(
    JSON.stringify({
      chat: {
        username,
        message,
      },
    })
  );
});
