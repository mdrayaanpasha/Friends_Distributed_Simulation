import amqplib from "amqplib";
import 'dotenv/config';
import express from "express";
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";
import cors from "cors"


// --- AI CONFIG ---
// import { talkToCharacter } from "./characterAI.js"; 
// To use AI: Uncomment above and swap getRossResponse() with talkToCharacter() below.

const prisma = new PrismaClient();
const app = express(); 
app.use(cors({
  origin: "*", 
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

const PORT = 3001;
const EXCHANGE_NAME = 'friends-exchange';
const CHARACTER_NAME = "Ross";
const characters = ["Rachel", "Joey"];
let channel;    

// --- FIXED RESPONSES ---
async function getRossResponse(from) {
    const lines = [
        "We were on a break!",
        "Pivot! PIVOT!",
        "I'm fine. Totally fine.",
        "Unagi is a state of total awareness.",
        "I'm the Holiday Armadillo!"
    ];
    return lines[Math.floor(Math.random() * lines.length)];
}

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

            console.log(`[*] ${CHARACTER_NAME} received from ${from}: ${message}`);

            let context = await prisma.logs.findMany({
                where: {
                    conversationId,
                    OR: [{ characterFrom: CHARACTER_NAME }, { characterTo: CHARACTER_NAME }],
                },
                orderBy: { createdAt: "asc" },
                take: 5,
            });

            if (context.length >= 10) {
                console.log(`[*] ${CHARACTER_NAME} stopping loop for ${conversationId}`);
                channel.ack(msg);
                return;
            }

            // USE FIXED RESPONSE INSTEAD OF AI
            const rossReply = await getRossResponse(from);

            const reply = {
                conversationId, 
                from: CHARACTER_NAME,
                to: from,
                message: rossReply,
            };

            channel.publish(EXCHANGE_NAME, from, Buffer.from(JSON.stringify(reply)), { persistent: true });

            // 10% side-talk chance
            if (Math.random() < 0.1 && context.length < 4) {
                const otherChar = characters.find((c) => c !== from);
                if (otherChar) {
                    const sideLine = `I was just talking to ${from}. Do you know about Unagi?`;
                    channel.publish(EXCHANGE_NAME, otherChar, Buffer.from(JSON.stringify({
                        conversationId, from: CHARACTER_NAME, to: otherChar, message: sideLine,
                    })), { persistent: true });
                }
            }
            channel.ack(msg);
        });
    } catch (error) {
        console.log("Connection error:", error);
    }
}

app.get("/start-convo-bro", async (req, res) => {
    try {
        const char = characters[Math.floor(Math.random() * characters.length)];
        const conversationId = crypto.randomUUID();
        const message = { conversationId, from: CHARACTER_NAME, to: char, message: "Hi... 👋" };

        channel.publish(EXCHANGE_NAME, char, Buffer.from(JSON.stringify(message)), { persistent: true });
        res.send({ status: "Ross started it.", conversationId, with: char });
    } catch (error) {
        res.status(500).send("Failed to start.");
    }
});

// GET /api/sync
app.get('/api/sync', async (req, res) => {
  const fiveSecondsAgo = new Date(Date.now() - 5000);

  try {
    const freshLogs = await prisma.logs.findMany({
      where: {
        createdAt: {
          gte: fiveSecondsAgo,
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
    res.json(freshLogs);
  } catch (error) {
    res.status(500).json({ error: "Database is being a 'Ross' right now." });
  }
});

app.listen(PORT, () => {
    console.log(`[*] Ross running on port ${PORT}`);
    connect();
});