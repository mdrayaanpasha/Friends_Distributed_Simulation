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


const PORT = 3002;
const EXCHANGE_NAME = 'friends-exchange';
const CHARACTER_NAME = "Joey";
const characters = ["Rachel", "Ross"];
let channel;    

async function getJoeyResponse() {
    const responses = [
        "How you doin'?",
        "Joey doesn't share food!",
        "Could I BE wearing any more clothes?",
        "I’m hungry. Let’s get pizza.",
        "I'm an actor. I can act like I'm listening!"
    ];
    const randomIndex = Math.floor(Math.random() * responses.length);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Delay to slow down the chat
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

            // Extract 'step' from the incoming message
            const { conversationId, from, to, message, step = 0 } = JSON.parse(msg.content.toString());

            // --- THE STOPPING LOGIC ---
            if (step >= 10) {
                console.log(`[!] Max steps (10) reached. ${CHARACTER_NAME} is stopping.`);
                channel.ack(msg);
                return;
            }

            if (to !== CHARACTER_NAME || from === CHARACTER_NAME) {
                channel.ack(msg);
                return;
            }

            // Log to Database
            await prisma.logs.create({
                data: { conversationId, characterFrom: from, characterTo: to, message },
            });

            console.log(`[*] ${CHARACTER_NAME} (Step ${step}) received: "${message}"`);

            // Generate response
            const responseMessage = await getJoeyResponse();

            const reply = {
                conversationId, 
                from: CHARACTER_NAME,
                to: from,
                message: responseMessage,
                step: step + 1 // INCREMENT THE STEP
            };

            channel.publish(EXCHANGE_NAME, from, Buffer.from(JSON.stringify(reply)), { persistent: true });

            channel.ack(msg);
        });

    } catch (error) {
        console.log("Joey connection error:", error);
    }
}

// Start a new conversation via HTTP
app.get("/start-convo-bro", async (req, res) => {
    try {
         await cleanupOldLogs();
        const char = characters[Math.floor(Math.random() * characters.length)];
        const conversationId = crypto.randomUUID();

        const message = {
            conversationId,
            from: CHARACTER_NAME,
            to: char,
            message: "How you doin'?",
            step: 1 // START AT STEP 1
        };

        channel.publish(EXCHANGE_NAME, char, Buffer.from(JSON.stringify(message)), { persistent: true });
        res.send({ status: "Joey started the chat", conversationId, with: char });
    } catch (error) {
        res.status(500).send("Error starting conversation.");
    }
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`[*] ${CHARACTER_NAME} running on port ${PORT}`);
    connect();
});

