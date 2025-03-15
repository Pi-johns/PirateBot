const {
    useMultiFileAuthState,
    makeWASocket,
    DisconnectReason,
    downloadMediaMessage
} = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const ytdl = require('ytdl-core');
const ytsr = require('ytsr'); // Added for YouTube search
const sharp = require('sharp');

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

async function startBot() {
    console.log("🏴‍☠️ Hoisting the Jolly Roger! PirateBot awakening...");

    const { state, saveCreds } = await useMultiFileAuthState('pirate_auth');

    socket = makeWASocket({
        printQRInTerminal: true,
        auth: state,
        syncFullHistory: false,
        browser: ['PirateBot', 'Black Pearl', '1.0']
    });

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
        // Save both original and lowercased text for commands and arguments
        const originalText = (msg.message.conversation || msg.message.extendedTextMessage?.text || '').trim();
        const text = originalText.toLowerCase();

        console.log(`📜 Sea scroll received: ${originalText}`);

        try {
            // Magical Command Grimoire
            switch (true) {
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

                case text.startsWith('.cursemap '): // User info (basic)
                    await sendCursedMap(jid, msg, sender);
                    break;

                case text.startsWith('.keelhaul '): // Kick
                    await keelhaulCrewmate(jid, msg);
                    break;

                case text.startsWith('.firstmate '): // Promote
                    await adjustCrewRank(jid, msg, 'promote');
                    break;

                case text.startsWith('.swabbie '): // Demote
                    await adjustCrewRank(jid, msg, 'demote');
                    break;

                case text.startsWith('.davyjones '): // Block
                    await handleLocker(jid, msg, 'block');
                    break;

                case text.startsWith('.parley '): // Unblock
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

                // New Commands
                case text === '.giff':
                    await sendMysticGiff(jid);
                    break;

                case text.startsWith('.wizardinfo'):
                    await sendWizardInfo(jid, msg, sender);
                    break;

                case text === '.blackspot':
                    await sendMessage(jid, "❌ Arr! The Black Spot be not implemented yet!");
                    break;

                default:
                    // Silence is golden
                    break;
            }
        } catch (error) {
            console.error('🌊 Stormy seas ahead:', error);
            await sendMessage(jid, '☠️ Blimey! The kraken attacked that command!');
        }
    });
}

// Command: Play a sea shanty (audio from YouTube) with search integration using ytsr
async function handleSeaShanty(jid, query) {
    if (!query) return sendMessage(jid, "⚠️ Need a sea shanty name, ye scallywag!");
    let videoUrl = query.trim();
    if (!/^https?:\/\//i.test(videoUrl)) {
        try {
            const searchResults = await ytsr(videoUrl, { limit: 1 });
            if (searchResults && searchResults.items && searchResults.items.length > 0) {
                const video = searchResults.items.find(item => item.type === 'video');
                if (video) {
                    videoUrl = video.url;
                } else {
                    return sendMessage(jid, "❌ Couldn't find a sea shanty for that query!");
                }
            } else {
                return sendMessage(jid, "❌ No sea shanty found for that query!");
            }
        } catch (err) {
            console.error("Error searching YouTube:", err);
            return sendMessage(jid, "❌ The Kraken prevents me from finding that shanty!");
        }
    }
    try {
        const stream = ytdl(videoUrl, { filter: 'audioonly', quality: 'highest' });
        await socket.sendMessage(jid, {
            audio: { stream },
            mimetype: 'audio/mpeg',
            ptt: false,
            caption: "🎶 Yo-ho-ho and a bottle of rum!"
        });
    } catch (error) {
        console.error("Error in handleSeaShanty:", error);
        await sendMessage(jid, "❌ Davy Jones took that shanty!");
    }
}

// Command: Play ship logs (video from YouTube) with search integration using ytsr
async function handleShipLogs(jid, query) {
    if (!query) return sendMessage(jid, "⚠️ Need a video URL, ye scallywag!");
    let videoUrl = query.trim();
    if (!/^https?:\/\//i.test(videoUrl)) {
        try {
            const searchResults = await ytsr(videoUrl, { limit: 1 });
            if (searchResults && searchResults.items && searchResults.items.length > 0) {
                const video = searchResults.items.find(item => item.type === 'video');
                if (video) {
                    videoUrl = video.url;
                } else {
                    return sendMessage(jid, "❌ Couldn't find a video for that query!");
                }
            } else {
                return sendMessage(jid, "❌ No video found for that query!");
            }
        } catch (err) {
            console.error("Error searching YouTube:", err);
            return sendMessage(jid, "❌ The Kraken prevents me from fetching that video!");
        }
    }
    try {
        const stream = ytdl(videoUrl, { quality: 'highestvideo' });
        await socket.sendMessage(jid, {
            video: { stream },
            caption: "🎥 Captured ship logs!"
        });
    } catch {
        await sendMessage(jid, "❌ Davy Jones couldn't fetch that video!");
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

const PIRATE_SCROLL = `🏴‍☠️ *PirateBot's Arcane Command Scroll* 🌊

⚓ *Crew & Realm Management*
.firstmate @user - Elevate a crew member to First Mate
.swabbie @user - Demote a crew member to Swabbie
.keelhaul @user - Make a scallywag walk the plank
.davyjones @user - Banish a miscreant to the Locker
.parley @user - Free a soul from the Locker
.cursemap @user - Reveal basic arcane secrets of a crewman
.wizardinfo [@user] - Unveil verbose mystical details about a crewman

🎶 *Mystic Summons*
.song <url or query> - Summon the audio spirit
.video <url or query> - Invoke visual omens

🌌 *Enchanted Arts*
.hex <image> - Craft a voodoo sticker
.ghostship - Conjure a spectral galleon
.giff - Summon a mystic GIF
.magicconch <question> - Consult the enchanted shell
.dice - Cast fate's bones

⚡ *Celestial Navigation*
.stormwatch <city> - Prophesy the weather
.plunder <query> - Raid the image treasure trove

Use .help for this scroll of commands
❌ Requires Captain's privileges for realm management commands`;

async function sendMessage(jid, text, options = {}) {
    await socket.sendMessage(jid, { text, ...options });
}

startBot().catch(err => {
    console.error("💀 The kraken destroyed our ship:", err);
    process.exit(1);
});
