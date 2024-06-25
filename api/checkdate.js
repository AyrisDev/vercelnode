import express from "express";
import {
  fetchNotionDatabase,
  parseDatesAndRoomsFromNotion,
  findEmptyDatesByRoom,
} from "../utils.js";
const router = express.Router();

router.get("/checkdate", async (req, res) => {
  try {
    const notionApiKey = process.env.NOTION_API_KEY;
    const mainDatabaseId = process.env.MAIN_DATABASE_ID;
    const data = await fetchNotionDatabase(notionApiKey, mainDatabaseId);
    const parsedData = parseDatesAndRoomsFromNotion(data);
    const dateRangesByRoom = {};

    parsedData.forEach(({ roomId, startDate, endDate }) => {
      if (!dateRangesByRoom[roomId]) {
        dateRangesByRoom[roomId] = [];
      }
      dateRangesByRoom[roomId].push({ startDate, endDate });
    });

    const emptyDates = findEmptyDatesByRoom(dateRangesByRoom);
    res.json(emptyDates);
  } catch (error) {
    console.error("Error fetching data from Notion:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
