import express from "express";
import cors from "cors";
import { config } from "dotenv";

config();

const app = express();

app.use(cors());
app.use(express.json());

const APIS = [
  {
    name: "YummyRides",
    url: process.env.YUMMY_URL,
    headers: {
      "content-type": "application/json",
      token: process.env.YUMMY_TOKEN,
      bearer: process.env.YUMMY_BEARER,
    },
  },
];

app.post("/api/quotation", (req, res) => {
  console.log("Request received: ", req.body);
  const { origin, destination } = req.body;
  const { lat: originLat, lng: originLon } = origin;
  const {lat: destinationLat, lng: destinationLon} = destination;

  try {
    requests = APIS.map(async (api) => {
      const options = {
        method: "POST",
        headers: api.headers,
        body: 
      }
    })
  } catch (error) {
    console.error(`Error al obtener informacion de la api ${api.name}: ${error}`);
  }

});

/*
app.post("/quotation", (req, res) => {
  const { locations } = req.body;

  const getData = async () => {
        const response = await fetch(
          "https://api.yummyrides.com/api/v2/quotation",
          {
            method: "POST",
            headers: {
                contentType: "application/json",
                authorization: `Bearer ${process.env.YUMMY_BEARER}`,
                token: process.env.YUMMY_TOKEN,
            },
            body: JSON.stringify({ locations }),
          }
        );
    } 
});
*/

app.listen(3000, () => {
  console.log("Server started on http://localhost:3000");
});
