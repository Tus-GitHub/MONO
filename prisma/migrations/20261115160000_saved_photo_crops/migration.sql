ALTER TABLE "users" ADD COLUMN "avatarCrop" JSONB;
ALTER TABLE "couples" ADD COLUMN "photoCrop" JSONB;
ALTER TABLE "date_photos" ADD COLUMN "crop" JSONB;
ALTER TABLE "chat_images" ADD COLUMN "crop" JSONB;
