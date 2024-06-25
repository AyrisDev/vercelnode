import express from "express";
import { parseISO, isValid, isBefore, format } from "date-fns";
import {
  fetchNotionDatabase,
  parseDatesAndRoomsFromNotion,
  getRoomNames,
  findEmptyDatesByRoom,
} from "../utils.js";

const router = express.Router();

router.get("/", async (req, res) => {
  const NOTION_API_KEY = process.env.NOTION_API_KEY;
  const MAIN_DATABASE_ID = process.env.MAIN_DATABASE_ID;
  const LISTINGS_DATABASE_ID = process.env.LISTINGS_DATABASE_ID;

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
      const parsedStartDate = parseISO(startDate);
      const parsedEndDate = parseISO(endDate);

      console.log(
        `Room: ${roomName}, Start Date: ${startDate}, End Date: ${endDate}`
      );

      if (
        !isValid(parsedStartDate) ||
        !isValid(parsedEndDate) ||
        isBefore(parsedEndDate, parsedStartDate)
      ) {
        const errorMessage = `Geçersiz tarih aralığı: ${startDate} - ${endDate}`;
        console.error(errorMessage);
        return;
      }

      if (!dateRangesByRoom[roomName]) {
        dateRangesByRoom[roomName] = [];
      }

      dateRangesByRoom[roomName].push({ startDate, endDate });
    });

    console.log("Date ranges by room:", dateRangesByRoom);

    const emptyDatesByRoom = findEmptyDatesByRoom(dateRangesByRoom);

    res.status(200).json({ emptyDatesByRoom });
  } catch (error) {
    const errorMessage = `Error fetching data from Notion: ${error.message}`;
    console.error(errorMessage);
    res.status(500).json({ error: errorMessage });
  }
});

export default router;
