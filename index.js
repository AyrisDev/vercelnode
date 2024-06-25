import { Telegraf, session } from "telegraf";
import express from "express";
import { format } from "date-fns";
import dotenv from "dotenv";
import {
  fetchNotionDatabase,
  addPersonToNotion,
  fetchListingsFromNotion,
  addReservationToNotion,
  convertToIsoDate,
  parseDatesAndRoomsFromNotion,
  getRoomNames,
  findEmptyDatesByRoom,
  addOksanaToNotion,
  fetchCheckInData,
  getPersonNames,
} from "./utils.js";

dotenv.config();

const TELEGRAM_API_KEY = process.env.TELEGRAM_API_KEY;
const NOTION_API_KEY = process.env.NOTION_API_KEY;
const MAIN_DATABASE_ID = process.env.MAIN_DATABASE_ID;
const PERSON_DATABASE_ID = process.env.PERSON_DATABASE_ID;
const LISTINGS_DATABASE_ID = process.env.LISTINGS_DATABASE_ID;
const OKSANA_DATABASE_ID = process.env.OKSANA_DATABASE_ID;
const PORT = process.env.PORT || 3000;
const WEBHOOK_URL = process.env.WEBHOOK_URL;

const bot = new Telegraf(TELEGRAM_API_KEY);

// Oturum yönetimini etkinleştir
bot.use(session());

bot.start((ctx) => {
  ctx.reply(
    'Merhaba! "/addReservation" komutunu kullanarak yeni bir rezervasyon ekleyebilirsiniz.'
  );
});

bot.command("addreservation", async (ctx) => {
  ctx.session = ctx.session || {};
  ctx.reply("Rezervasyon eklemeye başlayalım. Lütfen isim girin:");
  ctx.session.state = "waiting_for_name";
});

bot.command("checkdate", async (ctx) => {
  ctx.session = ctx.session || {};
  try {
    const mainData = await fetchNotionDatabase(
      NOTION_API_KEY,
      MAIN_DATABASE_ID
    );
    const dateEntries = parseDatesAndRoomsFromNotion(mainData);

    const roomNames = await getRoomNames(NOTION_API_KEY, LISTINGS_DATABASE_ID);

    const dateRangesByRoom = {};
    dateEntries.forEach(({ roomId, startDate, endDate }) => {
      const roomName = roomNames[roomId] || "Unknown Room";
      if (!dateRangesByRoom[roomName]) {
        dateRangesByRoom[roomName] = [];
      }
      dateRangesByRoom[roomName].push({ startDate, endDate });
    });

    const emptyDatesByRoom = findEmptyDatesByRoom(dateRangesByRoom);

    let message = "*Boş Tarihler:*\n";
    Object.keys(emptyDatesByRoom).forEach((room) => {
      message += `*${room} için boş tarihler:*\n`;
      emptyDatesByRoom[room].forEach((block) => {
        message += `${format(block.start, "dd/MM/yyyy")} → ${format(
          block.end,
          "dd/MM/yyyy"
        )}\n`;
      });
      message += "\n";
    });

    ctx.reply(message, { parse_mode: "Markdown" });
  } catch (error) {
    console.error("Error fetching data from Notion:", error);
    ctx.reply(`Hata: ${error.message}`);
  }
});

bot.command("oksana", async (ctx) => {
  ctx.session = ctx.session || {};
  try {
    const listings = await fetchListingsFromNotion(
      NOTION_API_KEY,
      LISTINGS_DATABASE_ID
    );
    ctx.session.listings = listings;
    const listingsText = listings
      .map((listing, i) => `${i + 1}. ${listing.name}`)
      .join("\n");
    ctx.reply(`Mevcut odalar:\n${listingsText}\n\nOda numarasını girin:`);
    ctx.session.state = "waiting_for_listing_oksana";
  } catch (error) {
    ctx.reply(`Bir hata oluştu: ${error.message}`);
  }
});

bot.command("checkin", async (ctx) => {
  try {
    const checkInData = await fetchCheckInData(
      NOTION_API_KEY,
      MAIN_DATABASE_ID
    );
    const roomNames = await getRoomNames(NOTION_API_KEY, LISTINGS_DATABASE_ID);
    const personNames = await getPersonNames(
      NOTION_API_KEY,
      PERSON_DATABASE_ID
    );

    if (checkInData.length === 0) {
      ctx.reply("Bugün ve yarın için herhangi bir check-in bulunmamaktadır.");
      return;
    }

    let message = "*Check-in Listesi:*\n";
    checkInData.forEach((data) => {
      const roomName = roomNames[data.listings] || "Unknown Room";
      const personName = personNames[data.personId] || "Unknown Person";
      message += `*Person:* ${personName}\n`;
      message += `*Check Date:* ${data.checkDate}\n`;
      message += `*Listings:* ${roomName}\n\n`;
    });

    ctx.reply(message, { parse_mode: "Markdown" });
  } catch (error) {
    console.error("Error fetching check-in data from Notion:", error);
    ctx.reply(`Hata: ${error.message}`);
  }
});

bot.on("text", async (ctx) => {
  const text = ctx.message.text;
  ctx.session = ctx.session || {};
  switch (ctx.session.state) {
    case "waiting_for_name":
      ctx.session.name = text;
      ctx.reply("Lütfen kişinin adını girin:");
      ctx.session.state = "waiting_for_person_name";
      break;
    case "waiting_for_person_name":
      ctx.session.person_name = text;
      ctx.reply("Lütfen kişinin telefon numarasını girin:");
      ctx.session.state = "waiting_for_person_phone";
      break;
    case "waiting_for_person_phone":
      ctx.session.person_phone = text;
      const listings = await fetchListingsFromNotion(
        NOTION_API_KEY,
        LISTINGS_DATABASE_ID
      );
      ctx.session.listings = listings;
      const listingsText = listings
        .map((listing, i) => `${i + 1}. ${listing.name}`)
        .join("\n");
      ctx.reply(`Mevcut odalar:\n${listingsText}\n\nOda numarasını girin:`);
      ctx.session.state = "waiting_for_listing";
      break;
    case "waiting_for_listing":
      const listingIndex = parseInt(text, 10) - 1;
      if (listingIndex >= 0 && listingIndex < ctx.session.listings.length) {
        ctx.session.listing = ctx.session.listings[listingIndex].id;
        ctx.reply("Lütfen toplam fiyatı girin:");
        ctx.session.state = "waiting_for_total_price";
      } else {
        ctx.reply("Geçersiz seçim. Lütfen tekrar deneyin:");
      }
      break;
    case "waiting_for_total_price":
      ctx.session.total_price = text;
      ctx.reply("Lütfen kapora miktarını girin:");
      ctx.session.state = "waiting_for_kapora";
      break;
    case "waiting_for_kapora":
      ctx.session.kapora = text;
      ctx.reply("Lütfen rezervasyon başlangıç tarihini girin (dd/mm/yyyy):");
      ctx.session.state = "waiting_for_start_date";
      break;
    case "waiting_for_start_date":
      try {
        ctx.session.start_date = text;
        // Tarih formatını kontrol et ve geçerli değilse hata fırlat
        convertToIsoDate(ctx.session.start_date);
        ctx.reply("Lütfen rezervasyon bitiş tarihini girin (dd/mm/yyyy):");
        ctx.session.state = "waiting_for_end_date";
      } catch (error) {
        ctx.reply(
          `Geçersiz tarih formatı: ${text}. Lütfen tekrar deneyin (dd/mm/yyyy):`
        );
      }
      break;
    case "waiting_for_end_date":
      try {
        ctx.session.end_date = text;
        // Tarih formatını kontrol et ve geçerli değilse hata fırlat
        convertToIsoDate(ctx.session.end_date);
        // Kişiyi Notion'a ekle
        const personId = await addPersonToNotion(
          ctx.session.person_name,
          ctx.session.person_phone,
          NOTION_API_KEY,
          PERSON_DATABASE_ID
        );
        ctx.session.person = personId;
        // Rezervasyonu Notion'a ekle
        await addReservationToNotion(
          ctx.session,
          NOTION_API_KEY,
          MAIN_DATABASE_ID
        );
        ctx.reply("Rezervasyon başarıyla eklendi!");
      } catch (error) {
        ctx.reply(`Bir hata oluştu: ${error.message}`);
      }
      ctx.session.state = null;
      break;
    case "waiting_for_listing_oksana":
      const listingIndexOksana = parseInt(text, 10) - 1;
      if (
        listingIndexOksana >= 0 &&
        listingIndexOksana < ctx.session.listings.length
      ) {
        const listingId = ctx.session.listings[listingIndexOksana].id;
        try {
          await addOksanaToNotion(
            NOTION_API_KEY,
            OKSANA_DATABASE_ID,
            listingId
          );
          ctx.reply("Oksana veritabanına başarıyla eklendi!");
        } catch (error) {
          ctx.reply(`Bir hata oluştu: ${error.message}`);
        }
        ctx.session.state = null;
      } else {
        ctx.reply("Geçersiz seçim. Lütfen tekrar deneyin:");
      }
      break;
    default:
      ctx.reply(
        "Anlaşılmayan bir durum. Lütfen /addReservation komutunu tekrar deneyin."
      );
      break;
  }
});

// Express.js Sunucusu Başlatma
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Telegram bot ve API çalışıyor...");
});

// API Uç Noktası: /api/checkin
app.get("/api/checkin", async (req, res) => {
  try {
    const checkInData = await fetchCheckInData(
      NOTION_API_KEY,
      MAIN_DATABASE_ID
    );
    const roomNames = await getRoomNames(NOTION_API_KEY, LISTINGS_DATABASE_ID);
    const personNames = await getPersonNames(
      NOTION_API_KEY,
      PERSON_DATABASE_ID
    );

    if (checkInData.length === 0) {
      res
        .status(200)
        .json({
          message: "Bugün ve yarın için herhangi bir check-in bulunmamaktadır.",
        });
      return;
    }

    const response = checkInData.map((data) => {
      const roomName = roomNames[data.listings] || "Unknown Room";
      const personName = personNames[data.personId] || "Unknown Person";
      return {
        person: personName,
        checkDate: data.checkDate,
        listings: roomName,
      };
    });

    res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching check-in data from Notion:", error);
    res.status(500).json({ error: error.message });
  }
});

// Webhook ayarı
app.use(bot.webhookCallback("/bot"));

bot.telegram.setWebhook(`${WEBHOOK_URL}/bot`).then(() => {
  console.log(`Webhook ${WEBHOOK_URL}/bot olarak ayarlandı`);
});

// Sunucuyu başlatma
app.listen(PORT, () => {
  console.log(`Sunucu çalışıyor: http://localhost:${PORT}`);
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
