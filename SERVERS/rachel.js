import amqplib from "amqplib";
import 'dotenv/config';
import express from "express";
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";
import cors from "cors";


import cleanupOldLogs from "./dbcleanup.js";

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

// --- FIXED RESPONSES ---
async function getFixedResponse() {
    const responses = [
        "Oh, that's interesting! Tell me more.",
        "I was just thinking the same thing.",
        "Wait, we should totally grab coffee at Central Perk and talk about this.",
        "I'm not sure, what do you think?",
        "That is SO typical of you!"
    ];
    const randomIndex = Math.floor(Math.random() * responses.length);
    await new Promise(resolve => setTimeout(resolve, 1000)); 
    return responses[randomIndex];
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

            // 1. Extract the step counter from the message
            const { conversationId, from, to, message, step = 0 } = JSON.parse(msg.content.toString());

            // 2. The Stop Condition: Check if we've hit the limit
            if (step >= 10) {
                console.log(`[!] Max steps reached. ${CHARACTER_NAME} is hanging up.`);
                channel.ack(msg);
                return;
            }

            if (to !== CHARACTER_NAME || from === CHARACTER_NAME) {
                channel.ack(msg);
                return;
            }

            // Log to DB
            await prisma.logs.create({
                data: { conversationId, characterFrom: from, characterTo: to, message },
            });

            console.log(`[*] ${CHARACTER_NAME} (Step ${step}) received from ${from}: ${message}`);

            // 3. Prepare the reply with an incremented step
            const responseMessage = await getFixedResponse();

            const reply = {
                conversationId, 
                from: CHARACTER_NAME,
                to: from,
                message: responseMessage,
                step: step + 1 // INCREMENT STEP
            };

            channel.publish(EXCHANGE_NAME, from, Buffer.from(JSON.stringify(reply)), { persistent: true });

            // Side-talk logic (also respects step limit)
            if (Math.random() < 0.1 && step < 4) {
                const otherChar = characters.find((c) => c !== from);
                if (otherChar) {
                    const sideMsg = await getFixedResponse();
                    channel.publish(EXCHANGE_NAME, otherChar, Buffer.from(JSON.stringify({
                        conversationId,
                        from: CHARACTER_NAME,
                        to: otherChar,
                        message: `(Side talk) ${sideMsg}`,
                        step: step + 1 
                    })), { persistent: true });
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
        await cleanupOldLogs();
        const char = characters[Math.floor(Math.random() * characters.length)];
        const conversationId = crypto.randomUUID();

        const message = {
            conversationId,
            from: CHARACTER_NAME,
            to: char,
            message: "Hey! How you doin'?",
            step: 1 // INITIALIZE STEP
        };

        channel.publish(EXCHANGE_NAME, char, Buffer.from(JSON.stringify(message)), { persistent: true });
        res.send({ status: "success", conversationId, with: char });
    } catch (error) {
        res.status(500).send("Failed to start.");
    }
});


app.listen(PORT, () => {
    console.log(`Server for ${CHARACTER_NAME} running on port ${PORT}`);
    connect();
});
