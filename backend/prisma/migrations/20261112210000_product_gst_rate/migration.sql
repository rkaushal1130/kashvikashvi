-- GST rate per product, in percent (e.g. 0, 5, 18 or a custom rate). Selling prices are
-- GST-inclusive; existing products keep 18% (the rate the invoice previously hard-coded).
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "gstRate" DECIMAL(5,2) NOT NULL DEFAULT 18.00;
ALTER TABLE "products" ALTER COLUMN "gstRate" TYPE DECIMAL(5,2);
ALTER TABLE "products" ALTER COLUMN "gstRate" SET DEFAULT 18.00;

-- GST rate snapshot on each order line, so later product changes never alter past invoices.
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "gstRate" DECIMAL(5,2);
ALTER TABLE "order_items" ALTER COLUMN "gstRate" TYPE DECIMAL(5,2);
