import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function cleanupOldLogs() {
    try {
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
        
        const deleted = await prisma.logs.deleteMany({
            where: {
                createdAt: {
                    lt: tenMinutesAgo,
                },
            },
        });
        
        if (deleted.count > 0) {
            console.log(`[🧹] Cleanup: Deleted ${deleted.count} old messages.`);
        }
    } catch (error) {
        console.error("[!] Cleanup Error:", error);
    }
}

export default cleanupOldLogs;