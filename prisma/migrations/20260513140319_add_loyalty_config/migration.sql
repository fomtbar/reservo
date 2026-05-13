-- CreateTable
CREATE TABLE "loyalty_config" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "silverMinBookings" INTEGER NOT NULL DEFAULT 10,
    "goldMinBookings" INTEGER NOT NULL DEFAULT 25,
    "silverDiscountPct" INTEGER NOT NULL DEFAULT 5,
    "goldDiscountPct" INTEGER NOT NULL DEFAULT 10,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "loyalty_config_pkey" PRIMARY KEY ("id")
);
