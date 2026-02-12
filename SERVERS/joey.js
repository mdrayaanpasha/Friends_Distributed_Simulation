import amqplib from "amqplib";
import 'dotenv/config';
import express from "express";
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

const prisma = new PrismaClient();
const app = express(); 

const PORT = 3002; // Distinct port for Joey
const EXCHANGE_NAME = 'friends-exchange';
const CHARACTER_NAME = "Joey";
const characters = ["Rachel", "Ross"];
let channel;    

// --- AI ALTERNATIVE: FIXED RESPONSES ---
// import { talkToCharacter } from "./characterAI.js"; 

async function getJoeyResponse(recipient, userMessage) {
    const responses = [
        "How you doin'?",
        "Joey doesn't share food!",
        "Could I BE wearing any more clothes?",
        "I’m hungry. Let’s get pizza.",
        "Everything you said is true... but in a much more 'me' way.",
        "I'm an actor. I can act like I'm listening!"
    ];
    
    const randomIndex = Math.floor(Math.random() * responses.length);
    await new Promise(resolve => setTimeout(resolve, 600)); // Joey takes a second to think
    
    return responses[randomIndex];
}

/* 🚀 HOW TO USE AI VERSION:
  1. Uncomment 'import { talkToCharacter }' above.
  2. In the consumer below, swap 'getJoeyResponse' with 'talkToCharacter'.
  3. Ensure CharacterAI creds are in your .env.
*/

async function connect() {
    try {
        const conn = await amqplib.connect(process.env.RABITMQ_URL);
        channel = await conn.createChannel();

        await channel.assertExchange(EXCHANGE_NAME, 'direct', { durable: true });
        const Q = await channel.assertQueue(`q-${CHARACTER_NAME}`, { durable: true });
        await channel.bindQueue(Q.queue, EXCHANGE_NAME, CHARACTER_NAME);

        console.log(`[*] ${CHARACTER_NAME} (The Actor) is ready...`);
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

            console.log(`[*] ${CHARACTER_NAME} heard: "${message}" from ${from}`);

            let context = await prisma.logs.findMany({
                where: {
                    conversationId,
                    OR: [{ characterFrom: CHARACTER_NAME }, { characterTo: CHARACTER_NAME }],
                },
                orderBy: { createdAt: "asc" },
                take: 5,
            });

            if (context.length >= 10) {
                console.log(`[*] ${CHARACTER_NAME} is bored and stopping the convo.`);
                channel.ack(msg);
                return;
            }

            // --- SWITCH TO AI HERE LATER ---
            const responseMessage = await getJoeyResponse(from, message);

            const reply = {
                conversationId, 
                from: CHARACTER_NAME,
                to: from,
                message: responseMessage,
            };

            channel.publish(EXCHANGE_NAME, from, Buffer.from(JSON.stringify(reply)), { persistent: true });

            // Side-talk logic
            if (Math.random() < 0.1 && context.length < 4) {
                const otherChar = characters.find((c) => c !== from);
                if (otherChar) {
                    const sideMsg = "Hey, you want some pizza? I'm talking to " + from + " right now.";
                    
                    channel.publish(EXCHANGE_NAME, otherChar, Buffer.from(JSON.stringify({
                        conversationId,
                        from: CHARACTER_NAME,
                        to: otherChar,
                        message: sideMsg,
                    })), { persistent: true });
                }
            }

            channel.ack(msg);
        });

    } catch (error) {
        console.log("Joey connection error:", error);
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
            message: "How you doin'?",
        };

        channel.publish(EXCHANGE_NAME, char, Buffer.from(JSON.stringify(message)), { persistent: true });
        res.send({ status: "Joey started a conversation!", conversationId, with: char });
    } catch (error) {
        res.status(500).send("Joey forgot his lines (convo failed).");
    }
});

app.listen(PORT, () => {
    console.log(`[*] ${CHARACTER_NAME} service running on port ${PORT}`);
    connect();
});