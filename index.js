const {
    useMultiFileAuthState,
    makeWASocket,
    DisconnectReason,
    downloadMediaMessage
} = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const ytdl = require('ytdl-core');
const ytsr = require('ytsr');
const sharp = require('sharp');

// API Config (Replace with your keys)


let socket = null;
const TREASURE_CHEST = [
    'https://media.giphy.com/media/l0HlQ7LRal9pN6nGo/giphy.mp4',
    'https://media.giphy.com/media/3o7aD2d7hy9ktXNDP2/giphy.mp4',
    'https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.mp4'
];

const MYSTIC_GIFS = [
    'https://media.giphy.com/media/3o6ZsZmFxv8x9Vb8is/giphy.gif',
    'https://media.giphy.com/media/3orieXYy9QJZ2XgYLu/giphy.gif',
    'https://media.giphy.com/media/26n6WywJyh39n1pBu/giphy.gif'
];

const muteTimers = new Map();

async function startBot() {
    console.log("🏴‍☠️ Hoisting the Jolly Roger! PirateBot awakening...");

    const { state, saveCreds } = await useMultiFileAuthState('pirate_auth');

    socket = makeWASocket({
        printQRInTerminal: true,
        auth: state,
        syncFullHistory: false,
        browser: ['PirateBot', 'Black Pearl', '1.0']
    });

    // Existing connection handlers remain unchanged
    socket.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            qrcode.generate(qr, { small: true });
            console.log("🔮 Scan the magical QR rune with yer WhatsApp spyglass!");
        }

        if (connection === 'close') {
            if (lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut) {
                console.log('⚓ Shipwreck detected! Replenishing supplies...');
                startBot();
            } else {
                console.log('❌ Walked the plank! Device logged out.');
            }
        } else if (connection === 'open') {
            console.log('✅ Anchors aweigh! Connected to the Seven Seas!');
        }
    });

    socket.ev.on('creds.update', saveCreds);

    socket.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg?.message || msg.key.fromMe) return;

        const jid = msg.key.remoteJid;
        const isGroup = jid.endsWith('@g.us');
        const sender = isGroup ? msg.key.participant : jid;
        const originalText = (msg.message.conversation || msg.message.extendedTextMessage?.text || '').trim();
        const text = originalText.toLowerCase();

        console.log(`📜 Sea scroll received: ${originalText}`);

        try {
            switch (true) {
                // Original Commands (No changes)
                case text === '.ping':
                    await sendMessage(jid, '🏴‍☠️ Avast! The ship responds!');
                    break;

                case text === '.help':
                    await sendMessage(jid, PIRATE_SCROLL);
                    break;

                case text.startsWith('.song '):
                    await handleSeaShanty(jid, originalText.slice(6));
                    break;

                case text.startsWith('.video '):
                    await handleShipLogs(jid, originalText.slice(7));
                    break;

                case text.startsWith('.cursemap '):
                    await sendCursedMap(jid, msg, sender);
                    break;

                case text.startsWith('.keelhaul '):
                    await keelhaulCrewmate(jid, msg);
                    break;

                case text.startsWith('.firstmate '):
                    await adjustCrewRank(jid, msg, 'promote');
                    break;

                case text.startsWith('.swabbie '):
                    await adjustCrewRank(jid, msg, 'demote');
                    break;

                case text.startsWith('.davyjones '):
                    await handleLocker(jid, msg, 'block');
                    break;

                case text.startsWith('.parley '):
                    await handleLocker(jid, msg, 'unblock');
                    break;

                case text === '.ghostship':
                    await summonGhostShip(jid);
                    break;

                case text === '.seadog':
                    await tellPirateJoke(jid);
                    break;

                case text.startsWith('.magicconch '):
                    await consultMagicConch(jid, originalText.slice(12));
                    break;

                case text === '.dice':
                    await rollDoubloons(jid);
                    break;

                case text.startsWith('.stormwatch '):
                    await predictStorms(jid, originalText.slice(12));
                    break;

                case text.startsWith('.plunder '):
                    await plunderImages(jid, originalText.slice(9));
                    break;

                case text.startsWith('.hex'):
                    await createVoodooCharm(jid, msg);
                    break;

                case text === '.giff':
                    await sendMysticGiff(jid);
                    break;

                case text.startsWith('.wizardinfo'):
                    await sendWizardInfo(jid, msg, sender);
                    break;

                // New Commands Added Below
                case text === '.time':
                    await sendTime(jid);
                    break;

                case text.startsWith('.mute '):
                    await handleMute(jid, originalText.slice(6).trim());
                    break;

                case text === '.unmute':
                    await handleUnmute(jid);
                    break;

                case text.startsWith('.ban '):
                    await handleBan(jid, msg);
                    break;

                case text.startsWith('.unban '):
                    await handleUnban(jid, msg);
                    break;

                case text.startsWith('.wiki '):
                    await handleWiki(jid, originalText.slice(6).trim());
                    break;

                case text.startsWith('.translate '):
                    await handleTranslate(jid, originalText.slice(11).trim());
                    break;

                case text.startsWith('.define '):
                    await handleDefine(jid, originalText.slice(8).trim());
                    break;

                case text.startsWith('.currency '):
                    await handleCurrency(jid, originalText.slice(10).trim());
                    break;

                case text.startsWith('.weather '):
                    await handleWeather(jid, originalText.slice(9).trim());
                    break;

                default:
                    break;
            }
        } catch (error) {
            console.error('🌊 Stormy seas ahead:', error);
            await sendMessage(jid, '☠️ Blimey! The kraken attacked that command!');
        }
    });
}

// =====================
// NEW COMMAND HANDLERS
// =====================

async function sendTime(jid) {
    const now = new Date();
    await sendMessage(jid, `🕰️ Ship's Time: ${now.toLocaleTimeString()}`);
}

async function handleMute(jid, timeString) {
    const duration = parseTime(timeString);
    if (!duration) return sendMessage(jid, "⚠️ Invalid time! Use like .mute 30m");

    try {
        await socket.groupSettingUpdate(jid, 'announcement');
        const timer = setTimeout(async () => {
            await socket.groupSettingUpdate(jid, 'not_announcement');
            muteTimers.delete(jid);
        }, duration);
        muteTimers.set(jid, timer);
        await sendMessage(jid, `🔇 Group muted for ${timeString}!`);
    } catch {
        await sendMessage(jid, "❌ Failed to mute group!");
    }
}

async function handleUnmute(jid) {
    try {
        if (muteTimers.has(jid)) clearTimeout(muteTimers.get(jid));
        await socket.groupSettingUpdate(jid, 'not_announcement');
        await sendMessage(jid, "🔊 Group unmuted!");
    } catch {
        await sendMessage(jid, "❌ Failed to unmute group!");
    }
}

async function handleBan(jid, msg) {
    const target = extractMention(msg);
    if (!target) return sendMessage(jid, "❌ Mark yer target!");
    try {
        await socket.groupParticipantsUpdate(jid, [target], 'remove');
        await socket.updateBlockStatus(target, 'block');
        await sendMessage(jid, `⛔ @${target.split('@')[0]} be banned!`, { mentions: [target] });
    } catch {
        await sendMessage(jid, "❌ Ban failed!");
    }
}

async function handleUnban(jid, msg) {
    const target = extractMention(msg);
    if (!target) return sendMessage(jid, "❌ Mark yer target!");
    try {
        await socket.updateBlockStatus(target, 'unblock');
        await sendMessage(jid, `🔓 @${target.split('@')[0]} be unbanned!`, { mentions: [target] });
    } catch {
        await sendMessage(jid, "❌ Unban failed!");
    }
}

async function handleWiki(jid, query) {
    try {
        const { data } = await axios.get(`https://en.wikipedia.org/w/api.php?action=query&format=json&prop=extracts&exintro&titles=${encodeURIComponent(query)}`);
        const page = Object.values(data.query.pages)[0];
        const text = page.extract?.replace(/<[^>]+>/g, '').slice(0, 500) + '...' || 'No treasure found!';
        await sendMessage(jid, `📚 ${text}`);
    } catch {
        await sendMessage(jid, "❌ Wikipedia search failed!");
    }
}

async function handleTranslate(jid, text) {
    const [content, lang] = text.split(/(?=\s+\w+$)/);
    try {
        const { data } = await axios.get(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(content)}&langpair=auto|${lang}`);
        await sendMessage(jid, `🌐 ${data.responseData.translatedText}`);
    } catch {
        await sendMessage(jid, "❌ Translation failed!");
    }
}

async function handleDefine(jid, word) {
    try {
        const { data } = await axios.get(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
        const definition = data[0].meanings[0].definitions[0].definition;
        await sendMessage(jid, `📖 ${word}: ${definition}`);
    } catch {
        await sendMessage(jid, "❌ Word not found!");
    }
}

async function handleCurrency(jid, text) {
    const [amount, from, to] = text.split(' ');
    try {
        const { data } = await axios.get(`https://v6.exchangerate-api.com/v6/${EXCHANGERATE_API_KEY}/pair/${from}/${to}/${amount}`);
        await sendMessage(jid, `💱 ${amount} ${from} = ${data.conversion_result} ${to}`);
    } catch {
        await sendMessage(jid, "❌ Conversion failed!");
    }
}

async function handleWeather(jid, city) {
    try {
        const { data } = await axios.get(`https://api.openweathermap.org/data/2.5/weather?q=${city}&units=metric&appid=${OPENWEATHER_API_KEY}`);
        const weather = `🌡️ ${data.main.temp}°C | 💨 ${data.wind.speed}m/s | ☁️ ${data.weather[0].description}`;
        await sendMessage(jid, `⛅ Weather in ${data.name}:\n${weather}`);
    } catch {
        await sendMessage(jid, "❌ Weather check failed!");
    }
}

function parseTime(timeString) {
    const units = { m: 60000, h: 3600000, d: 86400000 };
    const match = timeString.match(/(\d+)([mhd])/);
    return match ? parseInt(match[1]) * units[match[2]] : null;
}


// Command: Play a sea shanty (audio from YouTube) with search integration using ytsr
async function handleSeaShanty(jid, query) {
    if (!query) return sendMessage(jid, "⚠️ Need a sea shanty name, ye scallywag!");

    try {
        const info = await ytdl.getInfo(query, {
            requestOptions: {
                headers: {
                    'Cookie': process.env.YT_COOKIE || '', // Optional: Set your YouTube cookies
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            }
        });

        const format = ytdl.chooseFormat(info.formats, {
            quality: 'highestaudio',
            filter: 'audioonly'
        });

        if (!format) return sendMessage(jid, "❌ No suitable audio format found!");

        const stream = ytdl.downloadFromInfo(info, { format: format });

        await socket.sendMessage(jid, {
            audio: { stream },
            mimetype: 'audio/mpeg',
            caption: "🎶 Yo-ho-ho! Playing: " + info.videoDetails.title
        });

    } catch (error) {
        console.error("Error in handleSeaShanty:", error);
        await sendMessage(jid, "❌ Davy Jones blocked that shanty! Try another one.");
    }
}

// Modified handleShipLogs function
async function handleShipLogs(jid, query) {
    if (!query) return sendMessage(jid, "⚠️ Need a video URL, ye scallywag!");

    try {
        const info = await ytdl.getInfo(query, {
            requestOptions: {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            }
        });

        const format = ytdl.chooseFormat(info.formats, {
            quality: 'highestvideo',
            filter: 'audioandvideo'
        });

        if (!format) return sendMessage(jid, "❌ No suitable video format found!");

        const stream = ytdl.downloadFromInfo(info, { format: format });

        await socket.sendMessage(jid, {
            video: { stream },
            caption: "🎥 Playing: " + info.videoDetails.title
        });

    } catch (error) {
        console.error("Error in handleShipLogs:", error);
        await sendMessage(jid, "❌ Davy Jones sunk that video! Try another one.");
    }
}

// Command: Kick a crewmate (remove from group)
async function keelhaulCrewmate(jid, msg) {
    const target = extractMention(msg);
    if (!target) return sendMessage(jid, "☠️ Mark yer target with an @, ye scallywag!");
    try {
        await socket.groupParticipantsUpdate(jid, [target], 'remove');
        await sendMessage(jid, `⚓ ${target.split('@')[0]} has been made to walk the plank!`);
    } catch {
        await sendMessage(jid, "❌ The crew refuses to abandon ship!");
    }
}

// Command: Promote/Demote a crewmate (group admin update)
async function adjustCrewRank(jid, msg, action) {
    const target = extractMention(msg);
    if (!target) return sendMessage(jid, "☠️ Mark yer target with an @, ye landlubber!");
    try {
        await socket.groupParticipantsUpdate(jid, [target], action);
        const actionMsg = {
            promote: "🏴‍☠️ @1 promoted to First Mate!",
            demote: "🔻 @1 demoted to Swabbie!"
        }[action].replace('@1', `@${target.split('@')[0]}`);
        await sendMessage(jid, actionMsg, { mentions: [target] });
    } catch {
        await sendMessage(jid, "❌ The crew rebels against yer order!");
    }
}

// Command: Block or Unblock a user (Davy Jones' Locker / Parley)
async function handleLocker(jid, msg, action) {
    const target = extractMention(msg) || msg.key.remoteJid;
    if (target === msg.key.participant) return sendMessage(jid, "❌ Ye can't do that to yerself!");
    try {
        await socket.updateBlockStatus(target, action);
        await sendMessage(jid, `🔮 ${action === 'block' ? 'Sent to Davy Jones\' Locker!' : 'Parley accepted!'}`);
    } catch {
        await sendMessage(jid, "❌ The sea witch blocked yer magic!");
    }
}

// Command: Show user information in a cursed map format (basic info)
async function sendCursedMap(jid, msg, sender) {
    const target = extractMention(msg) || sender;
    try {
        const user = await socket.fetchStatus(target);
        const crew = await socket.groupMetadata(jid).catch(() => null);
        const rank = crew?.participants.find(p => p.id === target)?.admin ? 'Captain' : 'Deckhand';
        const map = `🧭 *Cursed Crew Manifest*
⚓ Name: ${target.split('@')[0]}
👑 Rank: ${rank}
🕰️ Last Spotted: ${user?.lastSeen || 'Lost to the mist'}
📜 Siren's Mark: ${user?.status || 'No cursed mark'}`;
        await sendMessage(jid, map);
    } catch {
        await sendMessage(jid, "❌ The sea fog obscures yer view!");
    }
}

// New Command: Send verbose wizard info about a user (more detailed info)
async function sendWizardInfo(jid, msg, sender) {
    const target = extractMention(msg) || sender;
    try {
        const user = await socket.fetchStatus(target);
        const crew = await socket.groupMetadata(jid).catch(() => null);
        const rank = crew?.participants.find(p => p.id === target)?.admin ? 'Captain' : 'Deckhand';
        // Try to get profile picture URL (if available)
        let profilePic = "Not available";
        try {
            profilePic = await socket.profilePictureUrl(target, 'image');
        } catch (e) {
            profilePic = "No profile picture";
        }
        const verboseInfo = `🔮 *Mystic User Details*
⚓ Name: ${target.split('@')[0]}
👑 Rank: ${rank}
🕰️ Last Seen: ${user?.lastSeen || 'Vanished in the fog'}
📜 Status Message: ${user?.status || 'None'}
🖼️ Profile Picture: ${profilePic}`;
        await sendMessage(jid, verboseInfo);
    } catch {
        await sendMessage(jid, "❌ The mystic forces cannot reveal that user's secrets!");
    }
}

// New Command: Send a random mystic GIF
async function sendMysticGiff(jid) {
    const gifUrl = MYSTIC_GIFS[Math.floor(Math.random() * MYSTIC_GIFS.length)];
    await socket.sendMessage(jid, {
        image: { url: gifUrl },
        gifPlayback: true,
        caption: "✨ Behold, a mystic GIF appears!"
    });
}

// Command: Summon a ghost ship (send a random video)
async function summonGhostShip(jid) {
    const ghostGif = TREASURE_CHEST[Math.floor(Math.random() * TREASURE_CHEST.length)];
    await socket.sendMessage(jid, {
        video: { url: ghostGif },
        gifPlayback: true,
        caption: "👻 A ghost ship appears from the mist!"
    });
}

// Command: Tell a pirate joke
async function tellPirateJoke(jid) {
    const jokes = [
        "Why couldn't the pirate learn the alphabet? Because he was always lost at C!",
        "What's a pirate's favorite exercise? The plank!",
        "Why do pirates not know the alphabet? They always get stuck at 'C'!"
    ];
    const joke = jokes[Math.floor(Math.random() * jokes.length)];
    await sendMessage(jid, joke);
}

// Command: Consult the Magic Conch (random answer)
async function consultMagicConch(jid, question) {
    if (!question) return sendMessage(jid, "⚠️ Ask the Magic Conch a question, ye scallywag!");
    const answers = [
        "It is certain.",
        "No way, matey!",
        "Ask again later.",
        "The winds say aye, the tides say nay.",
        "Better not tell ye now."
    ];
    const answer = answers[Math.floor(Math.random() * answers.length)];
    await sendMessage(jid, `🦀 The Magic Conch says: ${answer}`);
}

// Command: Roll fate's bones (dice roll)
async function rollDoubloons(jid) {
    const result = Math.floor(Math.random() * 6) + 1;
    await sendMessage(jid, `🎲 Ye rolled a ${result} out of 6 doubloons!`);
}

// Command: Predict storms (weather forecast)
async function predictStorms(jid, city) {
    if (!city) return sendMessage(jid, "⚠️ Specify a port of call (city), ye scallywag!");
    const forecasts = [
        "Clear skies with calm seas.",
        "A tempest brews on the horizon!",
        "Foggy and mysterious, tread carefully.",
        "Lightning and thunder, best batten down the hatches!"
    ];
    const forecast = forecasts[Math.floor(Math.random() * forecasts.length)];
    await sendMessage(jid, `⛈️ Weather report for ${city}: ${forecast}`);
}

// Command: Plunder images (fetch an image from Unsplash)
async function plunderImages(jid, query) {
    if (!query) return sendMessage(jid, "⚠️ Specify treasure to plunder, ye scallywag!");
    try {
        const imageUrl = `https://source.unsplash.com/featured/?${encodeURIComponent(query)}`;
        const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(response.data, 'binary');
        await socket.sendMessage(jid, { image: buffer, caption: `🏴‍☠️ Plundered image for ${query}` });
    } catch (error) {
        await sendMessage(jid, "❌ The image treasure be hidden, try again!");
    }
}

// Command: Create a voodoo sticker (convert image to sticker)
async function createVoodooCharm(jid, msg) {
    try {
        const messageContent = msg.message;
        // Check if the message (or quoted message) contains an image
        const imageMessage = messageContent.imageMessage ||
            (messageContent.extendedTextMessage &&
                messageContent.extendedTextMessage.contextInfo &&
                messageContent.extendedTextMessage.contextInfo.quotedMessage &&
                messageContent.extendedTextMessage.contextInfo.quotedMessage.imageMessage);
        if (!imageMessage) return sendMessage(jid, "⚠️ Ye need to provide an image for the voodoo charm!");

        const media = await downloadMediaMessage(msg, 'buffer', {}, { logger: null, reuploadRequest: false });
        const webpBuffer = await sharp(media).webp().toBuffer();
        await socket.sendMessage(jid, { sticker: webpBuffer });
    } catch (error) {
        console.error("Error creating voodoo charm:", error);
        await sendMessage(jid, "❌ The voodoo magic failed to manifest!");
    }
}

// Pirate Utilities
function extractMention(msg) {
    return msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
}
// =====================
// ORIGINAL FUNCTIONS 
// (Remain unchanged below)
// =====================

// [All your original functions remain here without modification]
// handleSeaShanty, handleShipLogs, keelhaulCrewmate, etc...

const PIRATE_SCROLL = `🏴‍☠️ *PirateBot's Complete Command Scroll* 🌊

⚖️ *Crew Justice*
.mute <time> - Silence crew (e.g .mute 30m)
.unmute - Restore voices
.ban @user - Banish & block
.unban @user - Remove from locker

⚓ *Original Crew Management*
.firstmate @user - Elevate to First Mate
.swabbie @user - Demote to Swabbie
.keelhaul @user - Walk the plank
.davyjones @user - Banish to Locker
.parley @user - Free from Locker
.cursemap @user - Crew secrets
.wizardinfo @user - Mystical details

🌐 *New Arcane Knowledge*
.wiki <query> - Search Wikipedia
.translate <text> <lang> - Translate text
.define <word> - Word definitions
.currency <amt> <from> <to> - Convert money
.weather <city> - Weather report

🎶 *Mystic Summons*
.song <url/query> - YouTube audio
.video <url/query> - YouTube video

🌌 *Enchanted Arts*
.hex <image> - Voodoo sticker
.ghostship - Spectral galleon
.giff - Mystic GIF
.magicconch <question> - Oracle answer
.dice - Roll bones

⚡ *Navigation*
.stormwatch <city> - Weather prophecy
.plunder <query> - Image treasure

🕰️ *Mystic Arts*
.time - Current ship time

Use .help for commands
❌ Requires Captain's privileges`;

async function sendMessage(jid, text, options = {}) {
    await socket.sendMessage(jid, { text, ...options });
}

startBot().catch(err => {
    console.error("💀 The kraken destroyed our ship:", err);
    process.exit(1);
});