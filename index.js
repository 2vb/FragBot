const mineflayer = require('mineflayer');
const config = require('./config.json');
require('console-stamp')(console, {
    format: ':date(mm/dd/yyyy HH:MM:ss)',
});
require('dotenv').config();
const env = process.env
const fs = require('fs');

let commands = {};

function loadCommands() {
    commands = {};
    const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
        const command = require(`./commands/${file}`);
        commands[command.name] = command.execute;
    }
}

loadCommands();

function wait(seconds) {
    return new Promise((resolve) => {
        setTimeout(resolve, seconds * 1000);
    });
}

function createBot() {
    const bot = mineflayer.createBot({
        host: "proxy.hypixel.net",
        version: '1.8.9',
        username: process.env.EMAIL,
        password: process.env.PASSWORD,
        auth: 'microsoft',
    });

    let partyStatus = 'disbanded'
    let queue = []

    bot.once('spawn', () => {
        console.log(`Connected.`);
        bot.addChatPatternSet(
            'PRIVATE_MESSAGE',
            [/^From (?:\[(.+\+?\+?)\] )?(.+): (.+)$/],
            { parse: true }
        );

        bot.addChatPatternSet(
            'PARTY_INVITE',
            [/(?:\[(.+\+?\+?)\] )?(.+) has invited you to join their party!/],
            { parse: true }
        )
    });

    bot.on('message', (msg) => {
        if (msg.toString() == `The party was disbanded because all invites expired and the party was empty.`) {
            partyStatus = 'disbanded'
        }
    })
    bot.on('error', (error) => {
        console.log(error)
    })
    bot.on('kicked', async (reason) => {
        console.log(`Kicked for ${reason}. Not restarting.`)
        process.exit();
    })
    bot.on('end', async (reason) => {
        console.log(`Disconnected.`)
        console.log(`${reason}`)
        if (config.autoRestart) {
            await wait(5)
            createBot();
        }
    })

    bot.on('chat:PRIVATE_MESSAGE', async ([
        [rank, username, message]
    ]) => {
        function reply(username, message) {
            bot.chat(`/msg ${username} ${message}`);
        }
        const msg = message.toString();
        if (msg.startsWith(`${config.prefix}`)) {
            if (msg in commands) {
                commands[msg](bot);
            } else {
                await wait(1)
                reply(username, `Command ${msg} not found.`)
            }
        }
    });

    bot.on('chat:PARTY_INVITE', ([
        [rank, username]
    ]) => {
        async function joinParty(username) {
            await wait(1)
            bot.chat(`/p accept ${username}`)
            partyStatus = "busy"
            console.log(`Joined ${username}'s party.`)
            await wait(config.timeInParty)
            bot.chat(`/p leave`)
            console.log(`Left ${username}'s party.`)
            partyStatus = "disbanded"
            if (queue.length > 0) {
                await wait(1)
                const nextPlayer = queue.shift();
                joinParty(nextPlayer);
            }
        }
        if (partyStatus === "busy") {
            queue.push(username);
        } else {
            joinParty(username);
        }
    });

}

createBot();
