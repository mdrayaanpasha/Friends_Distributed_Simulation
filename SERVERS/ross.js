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

const PORT = 3001;
const EXCHANGE_NAME = 'friends-exchange';
const CHARACTER_NAME = "Ross";
const characters = ["Rachel", "Joey"];
let channel;    

// --- FIXED RESPONSES ---
async function getRossResponse() {
    const lines = [
        "We were on a break!",
        "Pivot! PIVOT!",
        "I'm fine. Totally fine.",
        "Unagi is a state of total awareness.",
        "I'm the Holiday Armadillo!"
    ];
    await new Promise(resolve => setTimeout(resolve, 1000)); 
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

        channel.consume(Q.queue, async(msg) => {
            if(!msg) return;

            // 1. Extract step from the message
            const { conversationId, from, to, message, step = 0 } = JSON.parse(msg.content.toString());

            // 2. Global Stop Condition
            if (step >= 10) {
                console.log(`[!] Max steps reached. ${CHARACTER_NAME} is hanging up.`);
                channel.ack(msg);
                return;
            }

            if (to !== CHARACTER_NAME || from === CHARACTER_NAME) {
                channel.ack(msg);
                return;
            }

            await prisma.logs.create({
                data: { conversationId, characterFrom: from, characterTo: to, message },
            });

            console.log(`[*] ${CHARACTER_NAME} (Step ${step}) received from ${from}: ${message}`);

            // 3. Increment step for the reply
            const rossReply = await getRossResponse();

            const reply = {
                conversationId, 
                from: CHARACTER_NAME,
                to: from,
                message: rossReply,
                step: step + 1 // INCREMENT STEP
            };

            channel.publish(EXCHANGE_NAME, from, Buffer.from(JSON.stringify(reply)), { persistent: true });

            // Side-talk chance
            if (Math.random() < 0.1 && step < 4) {
                const otherChar = characters.find((c) => c !== from);
                if (otherChar) {
                    channel.publish(EXCHANGE_NAME, otherChar, Buffer.from(JSON.stringify({
                        conversationId, 
                        from: CHARACTER_NAME, 
                        to: otherChar, 
                        message: `(Side talk) I was just talking to ${from}. Do you know about Unagi?`,
                        step: step + 1
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
        const message = { 
            conversationId, 
            from: CHARACTER_NAME, 
            to: char, 
            message: "Hi... 👋",
            step: 1 // INITIALIZE STEP
        };

        channel.publish(EXCHANGE_NAME, char, Buffer.from(JSON.stringify(message)), { persistent: true });
        res.send({ status: "Ross started it.", conversationId, with: char });
    } catch (error) {
        res.status(500).send("Failed to start.");
    }
});

// GET /api/sync
app.get('/api/sync', async (req, res) => {
  try {
    const freshLogs = await prisma.logs.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20
    });
    res.json(freshLogs);
  } catch (error) {
    res.status(500).json({ error: "Database error." });
  }
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`[*] Ross running on port ${PORT}`);
    connect();
});