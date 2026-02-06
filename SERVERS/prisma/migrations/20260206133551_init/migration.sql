-- CreateTable
CREATE TABLE "logs" (
    "id" SERIAL NOT NULL,
    "characterFrom" TEXT NOT NULL,
    "characterTo" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "logs_pkey" PRIMARY KEY ("id")
);
