import express from "express";
import cors from "cors";
import { config } from "dotenv";

config();

const app = express();

app.use(cors());
app.use(express.json());

function getCurrentTimeInTimezone() {
  const now = new Date();

  const formatter = new Intl.DateTimeFormat("es-ES", {
    weekday: "narrow",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Caracas",
  });

  // Devolver la hora formateada
  return formatter.format(now);
}
app.post(`/api/autocompletation`, async (req, res) => {
  const { text } = req.body;

  if (!text) {
    return res.status(400).send("El parámetro 'text' es requerido.");
  }

  const apiKey = process.env.GEOAPIFY_API_KEY;

  try {
    const response = await fetch(`https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(text)}&apiKey=${apiKey}&filter=countrycode:ve`, {
      method: "GET",
    });

    if (!response.ok) {
      throw new Error(`Error: ${response.status}`);
    }

    const data = await response.json();
    res.send(data);
  } catch (error) {
    console.error(`Error al obtener la autocompletacion: ${error}`);
    res.status(500).send("Error al obtener la autocompletacion");
  }
});

const APIS = [
  {
    name: "YummyRides",
    url: process.env.YUMMY_URL,
    headers: {
      "content-type": "application/json",
      token: process.env.YUMMY_TOKEN,
      authorization: process.env.YUMMY_BEARER,
    },
    getBody: async (originLat, originLon, destinationLat, destinationLon) => ({
      destinationLatitude: destinationLat,
      destinationLongitude: destinationLon,
      pickupLatitude: originLat,
      pickupLongitude: originLon,
      stops: [
        {
          lat: destinationLat,
          lng: destinationLon,
        },
      ],
    }),
    quotation: "response.trip_services[0].subcategories",

    getQuotation: (services) => {
      
      let quotationResult = {
        Automovil: {
          services: [],
        },
        Moto: {
          services: []
        },
      };
        services.map((service) =>  {
          try {
            if(service.subcategory_title_es === "Motto") 
              quotationResult.Moto.services.push({name: service.subcategory_title_es, price: service.service_types[0].estimated_fare})
            else if (service.subcategory_title_es !== "LaWawa") 
              quotationResult.Automovil.services.push({name: service.subcategory_title_es, price: service.service_types[0].estimated_fare})
          } catch (error) {
            console.log("Error al obtener precio de servicio: ", error);
          }
        })
      return quotationResult;
},
  },
  {
    name: "Ridery",
    url: process.env.RIDERY_URL,
    headers: {
      "content-type": "application/json",
    },
    quotation: "estimated_fare",
    services_type_id: process.env.RIDERY_SERVICES_TYPE_IDS.split(","),
    is_min_fare_surge: [],
    surge_multiplier: [],
    async getDistance(originLat, originLon, destinationLat, destinationLon) {
      const response = await fetch(
        `${process.env.RIDERY_DISTANCE_URL}${originLat},${originLon}%3B${destinationLat},${destinationLon}?alternatives=false&overview=false&steps=false`,
        {
          method: "GET",
          "content-type": "application/json",
        }
      );
      const data = await response.json();
      const { distance, duration } = data.routes[0];
      const roundedDistance = Math.round(distance);
      const roundedDuration = Math.round(duration);
      return { roundedDistance, roundedDuration };
    },

    async getBody(originLat, originLon, destinationLat, destinationLon) {
      const distanceTime = await this.getDistance(
        originLat,
        originLon,
        destinationLat,
        destinationLon
      );
      return {
        destination_latitude: destinationLat,
        destination_longitude: destinationLon,
        distance: distanceTime.roundedDistance,
        time: distanceTime.roundedDuration,
        pickup_latitude: originLat,
        pickup_longitude: originLon,
        service_type_id: this.services_type_id,
        token: process.env.RIDERY_TOKEN,
        user_id: process.env.RIDERY_USER_ID,
        is_min_fare_surge: this.is_min_fare_surge,
        surge_multiplier: this.surge_multiplier
      };
    },

    getDay: (day) => {
      switch (day) {
        case "D":
          return 0;
        case "L":
          return 1;
        case "M":
          return 2;
        case "X":
          return 3;
        case "J":
          return 4;
        case "V":
          return 5;
        case "S":
          return 6;
      }
    },

    isInRange: (startHour, endHour, currentHour) => {
      if (startHour <= endHour) {
        return currentHour >= startHour && currentHour <= endHour;
      } else {
        return currentHour >= startHour || currentHour <= endHour;
      }
    },

    convertHourToMinutes: (hour) => {
      const [hours, minutes] = hour.split(":");
      return parseInt(hours) * 60 + parseInt(minutes);
    },

    async getSurgeHours(serviceType) {
      if (!this.surge_multiplier) this.surge_multiplier = [];
      if (!this.is_min_fare_surge) this.is_min_fare_surge = [];

      // Obtener la hora actual y el día
      const currentTime = getCurrentTimeInTimezone();
      const currentDay = currentTime[0]; 
      const currentHour = currentTime.slice(3);
      console.log("Hora actual: ", currentHour);


      const currentTimeInMinutes = this.convertHourToMinutes(currentHour);


      serviceType.forEach((service) => {
        if (service.startsWith("6747")) {
          // Lógica para "Moto Baratica"
          this.surge_multiplier.push("Moto Baratica");
          this.is_min_fare_surge.push(1);
        } else {
          // Lógica para otros servicios
          if (this.isInRange(this.convertHourToMinutes("01:00"), this.convertHourToMinutes("05:59"), currentTimeInMinutes)) {
            this.surge_multiplier.push(1.4);
            this.is_min_fare_surge.push(1);
          } else if (this.isInRange(this.convertHourToMinutes("22:00"), this.convertHourToMinutes("00:59"), currentTimeInMinutes)) {
            this.surge_multiplier.push(1.2);
            this.is_min_fare_surge.push(1);
          } else {
            this.surge_multiplier.push(1);
            this.is_min_fare_surge.push(0);
          }
        }
      });
    },

    getQuotation(services) {
      const names = {
        0: "Económico",
        1: "Ridery Premium",
        2: "Baratico",
        3: "Ridery Abuelos",
        4: "Camioneta",
        5: "Ridery Mascotas",
        6: "Ellas x Ellas",
        7: "Moto",
        8: "Moto Baratica",
      }
      let quotationResult = {
        Automovil: {
          services: [],
        },
        Moto: {
          services: []
        },
      };
      services.map((service) => {
        const index = this.services_type_id.indexOf(service.service_type_id);
        const name = names[index];
        if(index >= 7)
          quotationResult.Moto.services.push({name, price: service.estimated_fare})
        else
          quotationResult.Automovil.services.push({name, price: service.estimated_fare})
      });
      return quotationResult;
    },
  },
];
app.post("/api/quotation", async (req, res) => {
  const { origin, destination } = req.body;
  const { lat: originLat, lon: originLon } = origin;
  const { lat: destinationLat, lon: destinationLon } = destination;
  try {
    const requests = APIS.map(async (api) => {
      if(api.services_type_id) {
        await api.getSurgeHours(api.services_type_id);
      }

      const options = {
        method: "POST",
        headers: api.headers,
        body: JSON.stringify(
          await api.getBody(
            originLat,
            originLon,
            destinationLat,
            destinationLon
          )
        ),
      };

      const response = await fetch(api.url, options);
      const data = await response.json();
      const services = eval(`data.${api.quotation}`);
      const quotation = api.getQuotation(services); 
      const {Automovil, Moto} = quotation;
      return { name: api.name, quotation };
  });

    const results = await Promise.all(requests);
    console.log("Results: ", results);
    res.send(results);

  } catch (error) {
    console.error(`Error al obtener informacion de la api: ${error}`);
    res.status(500).send("Error al obtener informacion de la api");
  }
});

/*

app.post("/api/surge_hours", async (req, res) => {
  const response = await fetch(
    proccess.env.RIDERY_SURGE_HOURS
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        city: "",
        country: "",
        country_code: "VE",
        destination_latitude: "10.496400",
        destination_longitude: "-66.848960",
        is_new_user: true,
        latitude: "10.499257",
        longitude: "-66.847156",
        push_channel_id: "",
        token: "0BrK3QfW4dH9ttulZNMWagzu0UrCr9lG",
        user_id: "60b29296cad3f9514d12e476",
      }),
    }
  );
  const data = await response.json();
  res.send(
    data.citytypes.map((city) => {
      return city.service_types.map((service) => {
        return {
          name: service.typename,
          surge_hours: service.surge_hours,
        };
      });
    })
  );
});

*/

app.listen(3000, () => {
  console.log("Server started");
});
