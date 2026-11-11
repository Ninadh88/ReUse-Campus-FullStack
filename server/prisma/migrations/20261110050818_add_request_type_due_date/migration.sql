/*
  Warnings:

  - Added the required column `type` to the `Request` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Request" ADD COLUMN     "dueDate" TIMESTAMP(3),
ADD COLUMN     "type" "ItemMode" NOT NULL;
