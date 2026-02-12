import amqplib from "amqplib";
import 'dotenv/config';
import express from "express";
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";
import cors from "cors";


const prisma = new PrismaClient();
const app = express(); 
app.use(cors({
  origin: "*", 
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

const PORT = 3003;
const EXCHANGE_NAME = 'friends-exchange';
const CHARACTER_NAME = "Rachel";
const characters = ["Joey", "Ross"];
let channel;    

// --- AI ALTERNATIVE: FIXED RESPONSES ---
// This replaces the talkToCharacter AI function for now.
// import talkToCharacter from "./characterAI.js"

async function getFixedResponse(charName, recipient, userMessage) {
    const responses = [
        "Oh, that's interesting! Tell me more.",
        "I was just thinking the same thing.",
        "Wait, we should totally grab coffee at Central Perk and talk about this.",
        "I'm not sure, what do you think?",
        "That is SO typical of you!"
    ];
    
    // Pick a random response to simulate "thinking"
    const randomIndex = Math.floor(Math.random() * responses.length);
    
    // Simulate a small delay for realism
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return responses[randomIndex];
}

/* ACTIVATE AI VERSION:
  1. Uncomment the 'talkToCharacter' import at the top.
  2. Replace 'getFixedResponse' calls with 'talkToCharacter'.
  3. Ensure your API keys are set in your .env file.
*/

async function connect() {
    try {
        const conn = await amqplib.connect(process.env.RABITMQ_URL);
        channel = await conn.createChannel();

        await channel.assertExchange(EXCHANGE_NAME, 'direct', { durable: true });
        const Q = await channel.assertQueue(`q-${CHARACTER_NAME}`, { durable: true });
        await channel.bindQueue(Q.queue, EXCHANGE_NAME, CHARACTER_NAME);

        console.log(`[*] ${CHARACTER_NAME} is ready...`);
        await channel.purgeQueue(`q-${CHARACTER_NAME}`);

        channel.consume(Q.queue, async(msg) => {
            if(!msg) return;

            const { conversationId, from, to, message } = JSON.parse(msg.content.toString());

            if (!conversationId || to !== CHARACTER_NAME || from === CHARACTER_NAME) {
                channel.ack(msg);
                return;
            }

            await prisma.logs.create({
                data: { conversationId, characterFrom: from, characterTo: to, message },
            });

            console.log(`[*] ${CHARACTER_NAME} received: "${message}" from ${from}`);

            let context = await prisma.logs.findMany({
                where: {
                    conversationId,
                    OR: [{ characterFrom: CHARACTER_NAME }, { characterTo: CHARACTER_NAME }],
                },
                orderBy: { createdAt: "asc" },
                take: 5,
            });

            // Prevent infinite loops
            if (context.length >= 10) {
                console.log(`[*] ${CHARACTER_NAME} stopping conversation ${conversationId}`);
                channel.ack(msg);
                return;
            }

            // --- AI SWITCH POINT ---
            // Swap 'getFixedResponse' with your AI function here later
            const responseMessage = await getFixedResponse(CHARACTER_NAME, from, message);

            const reply = {
                conversationId, 
                from: CHARACTER_NAME,
                to: from,
                message: responseMessage,
            };

            channel.publish(EXCHANGE_NAME, from, Buffer.from(JSON.stringify(reply)), { persistent: true });

            // 10% chance to ping another character
            if (Math.random() < 0.1 && context.length < 4) {
                const otherChar = characters.find((c) => c !== from);
                if (otherChar) {
                    const sideMsg = await getFixedResponse(CHARACTER_NAME, otherChar, "Side talk");
                    
                    channel.publish(EXCHANGE_NAME, otherChar, Buffer.from(JSON.stringify({
                        conversationId,
                        from: CHARACTER_NAME,
                        to: otherChar,
                        message: sideMsg,
                    })), { persistent: true });

                    console.log(`[*] ${CHARACTER_NAME} side-talked to ${otherChar}`);
                }
            }

            channel.ack(msg);
        });

    } catch (error) {
        console.log("Error connecting to RabbitMQ:", error);
    }
}

app.get("/start-convo-bro", async (req, res) => {
    try {
        const char = characters[Math.floor(Math.random() * characters.length)];
        const conversationId = crypto.randomUUID();

        const message = {
            conversationId,
            from: CHARACTER_NAME,
            to: char,
            message: "Hey! How you doin'?",
        };

        channel.publish(EXCHANGE_NAME, char, Buffer.from(JSON.stringify(message)), { persistent: true });
        res.send({ status: "success", conversationId, with: char });
    } catch (error) {
        res.status(500).send("Failed to start.");
    }
});

app.listen(PORT, () => {
    console.log(`[*] ${CHARACTER_NAME} running on port ${PORT}`);
    connect();
});