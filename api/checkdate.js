import express from "express";
import {
  fetchNotionDatabase,
  getRoomNames,
  parseDatesAndRoomsFromNotion,
  findEmptyDatesByRoom,
} from "../utils.js";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();

const NOTION_API_KEY = process.env.NOTION_API_KEY;
const MAIN_DATABASE_ID = process.env.MAIN_DATABASE_ID;
const LISTINGS_DATABASE_ID = process.env.LISTINGS_DATABASE_ID;

router.get("/checkdate", async (req, res) => {
  try {
    const data = await fetchNotionDatabase(NOTION_API_KEY, MAIN_DATABASE_ID);
    const roomNames = await getRoomNames(NOTION_API_KEY, LISTINGS_DATABASE_ID);
    const parsedEntries = parseDatesAndRoomsFromNotion(data);
    const dateRangesByRoom = parsedEntries.reduce((acc, entry) => {
      if (!acc[entry.roomId]) acc[entry.roomId] = [];
      acc[entry.roomId].push({
        startDate: entry.startDate,
        endDate: entry.endDate,
      });
      return acc;
    }, {});
    const emptyDates = findEmptyDatesByRoom(dateRangesByRoom);

    // Oda isimlerini boş tarihlerle birlikte döndür
    const emptyDatesWithRoomNames = {};
    for (const roomId in emptyDates) {
      const roomName = roomNames[roomId] || roomId;
      emptyDatesWithRoomNames[roomName] = emptyDates[roomId];
    }

    res.status(200).json(emptyDatesWithRoomNames);
  } catch (error) {
    console.error("Error fetching data from Notion:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
