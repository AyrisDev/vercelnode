// utils.js
import fetch from "node-fetch";
import {
  parse,
  isValid,
  addHours,
  parseISO,
  eachDayOfInterval,
  isWithinInterval,
  format,
  isBefore,
} from "date-fns";
import fs from "fs";

export async function fetchNotionDatabase(apiKey, databaseId) {
  const url = `https://api.notion.com/v1/databases/${databaseId}/query`;
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "Notion-Version": "2022-06-28",
  };
  const response = await fetch(url, { method: "POST", headers });
  if (!response.ok) {
    throw new Error(`Error fetching database: ${response.statusText}`);
  }
  return response.json();
}

export async function addPersonToNotion(
  name,
  phone,
  notionApiKey,
  personDatabaseId
) {
  const url = "https://api.notion.com/v1/pages";
  const headers = {
    Authorization: `Bearer ${notionApiKey}`,
    "Content-Type": "application/json",
    "Notion-Version": "2022-06-28",
  };
  const payload = {
    parent: { database_id: personDatabaseId },
    properties: {
      Name: {
        title: [{ text: { content: name } }],
      },
      Phone: {
        rich_text: [{ text: { content: phone } }],
      },
    },
  };
  console.log(
    "Adding person to Notion with payload:",
    JSON.stringify(payload, null, 2)
  );
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  const responseText = await response.text();
  console.log("Response from adding person to Notion:", responseText);
  if (!response.ok) {
    throw new Error(`Error adding person: ${responseText}`);
  }
  const data = JSON.parse(responseText);
  return data.id;
}

export async function fetchListingsFromNotion(
  notionApiKey,
  listingsDatabaseId
) {
  const data = await fetchNotionDatabase(notionApiKey, listingsDatabaseId);
  return data.results.map((listing) => ({
    id: listing.id,
    name: listing.properties.Name.title[0].text.content,
  }));
}

export async function addReservationToNotion(
  data,
  notionApiKey,
  mainDatabaseId
) {
  const url = "https://api.notion.com/v1/pages";
  const headers = {
    Authorization: `Bearer ${notionApiKey}`,
    "Content-Type": "application/json",
    "Notion-Version": "2022-06-28",
  };
  const payload = {
    parent: { database_id: mainDatabaseId },
    properties: {
      Name: {
        title: [{ text: { content: data.name } }],
      },
      Person: {
        relation: [{ id: data.person }],
      },
      Listings: {
        relation: [{ id: data.listing }],
      },
      "Total Price": {
        number: parseFloat(data.total_price),
      },
      Kapora: {
        number: parseFloat(data.kapora),
      },
      "Check Date": {
        date: {
          start: convertToIsoDate(data.start_date),
          end: convertToIsoDate(data.end_date),
        },
      },
    },
  };
  console.log(
    "Adding reservation to Notion with payload:",
    JSON.stringify(payload, null, 2)
  );
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  const responseText = await response.text();
  console.log("Response from adding reservation to Notion:", responseText);
  if (!response.ok) {
    throw new Error(`Error adding reservation: ${responseText}`);
  }
}

export function convertToIsoDate(dateStr) {
  const parsedDate = parse(dateStr, "dd/MM/yyyy", new Date());
  if (!isValid(parsedDate)) {
    throw new Error(`Invalid date format: ${dateStr}`);
  }
  const utcDate = addHours(parsedDate, 3); // 3 saat ekleyerek UTC+3'e dönüştürme
  return utcDate.toISOString().split("T")[0];
}

export async function getRoomNames(apiKey, roomsDatabaseId) {
  const data = await fetchNotionDatabase(apiKey, roomsDatabaseId);
  const roomNames = {};
  data.results.forEach((result) => {
    const roomId = result.id;
    const roomName = result.properties.Name.title[0].text.content;
    roomNames[roomId] = roomName;
  });
  return roomNames;
}

// Boş tarihleri bulun ve bloklar halinde gruplayın

export async function addOksanaToNotion(
  notionApiKey,
  oksanaDatabaseId,
  listingId
) {
  const url = "https://api.notion.com/v1/pages";
  const headers = {
    Authorization: `Bearer ${notionApiKey}`,
    "Content-Type": "application/json",
    "Notion-Version": "2022-06-28",
  };

  const payload = {
    parent: { database_id: oksanaDatabaseId },
    properties: {
      Amount: {
        number: 750,
      },
      "Temizlik Zamanı": {
        date: {
          start: new Date().toISOString(),
        },
      },
      Listings: {
        relation: [{ id: listingId }],
      },
    },
  };
  console.log(
    "Adding Oksana to Notion with payload:",
    JSON.stringify(payload, null, 2)
  );
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  const responseText = await response.text();
  console.log("Response from adding Oksana to Notion:", responseText);
  if (!response.ok) {
    throw new Error(`Error adding Oksana: ${responseText}`);
  }
}

export async function fetchCheckInData(apiKey, databaseId) {
  const url = `https://api.notion.com/v1/databases/${databaseId}/query`;
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "Notion-Version": "2022-06-28",
  };

  const today = new Date().toISOString().split("T")[0];
  const tomorrow = new Date(new Date().setDate(new Date().getDate() + 1))
    .toISOString()
    .split("T")[0];

  const payload = {
    filter: {
      or: [
        {
          property: "Check Date",
          date: {
            equals: today,
          },
        },
        {
          property: "Check Date",
          date: {
            equals: tomorrow,
          },
        },
      ],
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Error fetching data from Notion: ${response.statusText}`);
  }

  const data = await response.json();
  return data.results.map((result) => {
    const personId = result.properties.Person.relation?.[0]?.id || "Unknown";
    const checkDate = result.properties["Check Date"].date?.start || "Unknown";
    const listings = result.properties.Listings.relation?.[0]?.id || "Unknown";

    return { personId, checkDate, listings };
  });
}

export async function getPersonNames(apiKey, personDatabaseId) {
  const data = await fetchNotionDatabase(apiKey, personDatabaseId);
  const personNames = {};
  data.results.forEach((result) => {
    const personId = result.id;
    const personName =
      result.properties.Name.title?.[0]?.text?.content || "Unknown";
    personNames[personId] = personName;
  });
  return personNames;
}

export function parseDatesAndRoomsFromNotion(data) {
  const entries = [];
  data.results.forEach((result) => {
    try {
      const roomId = result.properties.Listings.relation[0].id;
      const startDate = result.properties["Check Date"].date.start;
      const endDate = result.properties["Check Date"].date.end || startDate;
      entries.push({ roomId, startDate, endDate });
    } catch (error) {
      console.error("Error parsing date or room data from Notion:", error);
    }
  });
  console.log("Parsed date entries from Notion:", entries);
  return entries;
}

export function findEmptyDatesByRoom(dateRangesByRoom) {
  const emptyDatesByRoom = {};

  Object.keys(dateRangesByRoom).forEach((room) => {
    const dateRanges = dateRangesByRoom[room];
    const allDates = [];

    dateRanges.forEach(({ startDate, endDate }) => {
      const start = parseISO(startDate);
      const end = parseISO(endDate);

      if (
        isValid(start) &&
        isValid(end) &&
        (!isBefore(end, start) || start.getTime() === end.getTime())
      ) {
        allDates.push({ start, end });
      } else {
        console.error(`Geçersiz tarih aralığı: ${startDate} - ${endDate}`);
      }
    });

    allDates.sort((a, b) => a.start - b.start);

    const emptyRanges = [];
    for (let i = 0; i < allDates.length - 1; i++) {
      const currentEnd = allDates[i].end;
      const nextStart = allDates[i + 1].start;
      if (isBefore(currentEnd, nextStart)) {
        emptyRanges.push({ start: currentEnd, end: nextStart });
      }
    }

    emptyDatesByRoom[room] = emptyRanges;
  });

  console.log("Empty dates by room:", emptyDatesByRoom);
  return emptyDatesByRoom;
}
