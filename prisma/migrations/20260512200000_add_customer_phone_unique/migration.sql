-- AlterTable: add unique constraint on customers.phone
CREATE UNIQUE INDEX IF NOT EXISTS "customers_phone_key" ON "customers"("phone");
ALTER TABLE "customers" ADD CONSTRAINT "customers_phone_key" UNIQUE USING INDEX "customers_phone_key";
