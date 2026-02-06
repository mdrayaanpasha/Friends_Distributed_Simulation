/*
  Warnings:

  - Added the required column `conversationId` to the `logs` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "logs" ADD COLUMN     "conversationId" TEXT NOT NULL;
